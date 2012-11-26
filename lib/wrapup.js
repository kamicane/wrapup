"use strict";
// WrapUp base class

var isWindows = process.platform === "win32"

// core requires

var fs          = require("fs"),
    Stream      = require('stream').Stream,
    readFile    = fs.readFileSync,
    writeFile   = fs.writeFileSync,
    watchFile   = fs.watchFile,
    unwatchFile = fs.unwatchFile,
    path        = require("path"),
    exists      = fs.existsSync || path.existsSync

var pathsep = path.sep || (isWindows ? '\\' : '/');

//@* i love sebmarkbage
var Module = require("module")

// dependencies

var ujs     = require("uglify-js"),
    prime   = require("prime/prime"),
    async   = require("async")

// util methods

var exclude = function(src, excludes){
    if (!excludes || !excludes.length) return src
    return src.replace(/\/\*\(([\w\s.&]+)\)\?\*\/([\s\S]*?)\/\*\:([\w\s.]+)?\*\//g, function(match, exclusions, method, otherwise){
        if (otherwise === undefined) otherwise = ""
        exclusions = exclusions.split("&&").map(function(x){
            return x.trim()
        })
        for (var i = 0, l = exclusions.length; i < l; i++) if (excludes.indexOf(exclusions[i]) > -1) return otherwise
        return method
    })
}

var empty = function(object){
    for (var k in object) return false
    return true
}

var slice = Array.prototype.slice

var noop = function(){}

var relative = function(file){
    return path.relative(process.cwd(), file)
}

var asts = {}
var getAST = function(file, callback){
    if (asts[file]) return callback(null, asts[file])
    fs.readFile(file, "utf-8", function(err, src){
        if (err) return callback(err)
        try {
            asts[file] = ujs.parse(src, {filename: relative(file)})
        } catch(e){
            return callback(e)
        }
        callback(null, asts[file])
    })
}

// templates

var ipath = path.join(__dirname, "../includes/")

var getWrapperAST = async.apply(getAST, ipath + "wrapper.js")

var getModuleAST = function(callback){
    getAST(ipath + 'module.js', function(err, ast){
        if (err) callback(err)
        else callback(null, ast.body[0].definitions[0].value.properties[0])
    })
}

// deep clone an AST tree

var cloneAST = function(ast){
    return ast.transform(new ujs.TreeTransformer(function(node, descend){
        node = node.clone()
        descend(node, this)
        return node
    }))
}

// AST for "require('module id')"

var createRequireAST = function(mid){
    return new ujs.AST_Call({
        expression: new ujs.AST_SymbolDefun({name: 'require'}),
        args: [new ujs.AST_String({value: mid})]
    })
}

// AST for "global[name] = require('module id')"

var createGlobalizeAST = function(global, name, mid){
    return new ujs.AST_SimpleStatement({
        body: new ujs.AST_Assign({
            left: new ujs.AST_Sub({
                expression: new ujs.AST_SymbolDefun({name: global}),
                property: new ujs.AST_String({value: name})
            }),
            right: createRequireAST(mid),
            operator: '='
        })
    })
}

// WrapUp

var WrapUp = prime({

    inherits: Stream,

    // public API

    constructor: function(){
        Stream.call(this)
        this.required = []
        this._options = {}
        this.readable = true
        this.paused = false
    },

    options: function(options){
        if (options == null) options = this._options
        if (options.globalize == null) options.globalize = "window"
        if (options.compress == null) options.compress = false
        if (options.output == null) options.output = false
        if (options.sourcemap == null) options.sourcemap = false
        if (options.sourcemapRoot == null) options.sourcemapRoot = false
        if (options.sourcemapIn == null) options.sourcemapIn = false
        this._options = options
        return this
    },

    exclude: function(){
        if (!this.excludes) this.excludes = []
        Array.prototype.push.apply(this.excludes, slice.call(arguments))
        return this
    },

    require: function(namespace, module){
        if (module == null){
            module = namespace
            namespace = null
        }
        this.required.push([namespace, module])
        return this
    },

    up: function(callback){
        this.go()._up(callback || noop)
        return this
    },

    graph: function(callback){
        this.go()._graph(this.relativeModules(), callback || noop)
        return this
    },

    watch: function(callback){
        var self = this

        if (!this.watching){
            this.watching = true

            // make CTRL+C call the exit event
            process.on("SIGINT", function(){
                process.exit()
            })
            process.on("exit", function(){
                self.emit("end")
                ;(callback || noop)()
            })
        }

        this.go()._up(function(err){
            if (err) self.emit("warn", err)
            for (var fullpath in self.modules){
                self._watch(fullpath, self.watch.bind(self))
            }
        })
        return this
    },

    // stream methods

    pause: function(){
        this.paused = true
    },

    resume: function(){
        this.paused = false
        if (this.buffer) this.emit("data", this.buffer)
    },

    setEncoding: function(){},

    destroy: function(){
        this.readable = false
        this.emit("close")
    },

    // private API

    // fill the modules, named and nameless objects, by processing each file.
    go: function(){

        this.packages = {}
        this.modules  = {}
        this.named    = {}
        this.nameless = []
        this.index    = 0

        this.required.forEach(function(m){
            var namespace = m[0], module = m[1]

            if (namespace && this.named[namespace]){
                throw this.error("namespace", namespace, module)
            }

            if (module == null) return

            var id = this.scan(module)
            if (id){
                if (namespace) this.named[namespace] = id
                else if (this.nameless.indexOf(id) === -1) this.nameless.push(id)
            }
        }, this)

        return this
    },

    // scan and stuff needs to be sync, because when we traverse the AST in
    // walkASTForRequires we need to know immediately if the required module
    // exists or not, so we can replace the AST node if necessary
    scan: function(what, from){

        var self = this
        var modulefull = this.resolve(what, from)

        if (modulefull == null){
            this.emit("warn", this.error("resolve", what, from))
            return
        }

        if (modulefull === true){
            this.emit("warn", this.error("native", what, from))
            return
        }

        var module = this.modules[modulefull]

        if (module) return module.uid

        var src = readFile(modulefull, "utf-8")

        var ast
        try {
            // parse the code with ujs to see if there are any errors
            // and so we can walk through the AST to find require()s
            ast = ujs.parse(src, {filename: relative(modulefull)})
        } catch (err){
            // add to the object so it will be watched for newer versions
            this.modules[modulefull] = {err: true}
            // ujs.parse already logs this error, but yes, twice doesn't hurt
            // for now
            this.emit("warn", this.error("js", modulefull, from, err))
            return
        }

        module = this.modules[modulefull] = {
            uid: (this.index++).toString(36),
            deps: []
        }

        module.ast = self.walkASTForRequires(ast, modulefull, module.deps)

        return module.uid
    },

    walkASTForRequires: function(ast, modulefull, deps){

        var self = this
        var unresolved, requireCall

        var walker = new ujs.TreeTransformer(function(node, descend){
            if (node instanceof ujs.AST_Call && node.start.value == 'require' && node.expression.end.value == 'require'){
                // we're in a require() call
                var tmp1 = requireCall, tmp2 = unresolved, ret
                requireCall = node
                // walk require() arguments
                descend(node, this)
                requireCall = tmp1
                // require was unresolved, replace node with AST_Null
                if (unresolved) ret = new ujs.AST_Null({
                    start: node.start, end: node.end
                })
                unresolved = tmp2
                return ret
            }
            if (requireCall && node instanceof ujs.AST_String){
                // found a require("dep")
                var dep = node.getValue()
                var k = self.scan(dep, modulefull)
                if (k){
                    deps.push(k)
                    node.value = k
                } else {
                    unresolved = true
                }
            }
        })
        return ast.transform(walker)
    },

    // this makes sure we always use the same directory for a specified package (the first it encounters)
    // this might not be ideal, but duplicating packages for the web is even worse
    resolve: function(what, from){

        var module = this.nodeResolve(what, from)

        if (!module) return null // cannot find module
        if (isWindows){
            if (!module.match(/^([\w]:)/)) return true
        } else {
            if (module.indexOf("/") !== 0) return true // native require
        }

        if (this.modules[module]) return module

        var jsonpath = this.findJSON(module)
        if (!jsonpath) return module // not part of any package

        var pkgpath = path.dirname(jsonpath) + pathsep
        var modulepath = module.replace(pkgpath, "")

        var json = require(jsonpath)
        var id = json.name + "@" + json.version
        var prevpkgpath = this.packages[id]
        pkgpath = prevpkgpath || (this.packages[id] = pkgpath)

        return prevpkgpath ? this.nodeResolve(path.join(pkgpath, modulepath), from) : module
    },

    //resolve module from cwd or relative to another module.
    nodeResolve: function(module, from){
        from = (from == null) ? path.join(process.cwd(), "wrup.js") : path.resolve(from)
        var m = new Module(from)
        m.filename = from
        m.paths = Module._nodeModulePaths(path.dirname(from))
        try {
            return Module._resolveFilename(module, m)
        } catch (err){}
        return null
    },

    findJSON: function(file){
        var dirname = file
        while (dirname = path.dirname(dirname)){
            var json = path.join(dirname, "package.json")
            if (exists(json)) return json
            if (dirname === "/" || isWindows && dirname.match(/^[\w]:\\$/)) break
        }
        return null
    },

    // output methods

    _graph: function(modules, callback){
        var graphviz, options = this._options
        try {
            graphviz = require('graphviz')
        } catch (err){
            return callback(this.error("graphviz"))
        }

        var graph = graphviz.digraph("G")

        for (var x in modules){
            var xn = graph.addNode(x)
            var deps = modules[x]
            deps.forEach(function(dep){
                graph.addEdge(x, dep)
            })
        }

        var dot = graph.to_dot()

        if (options.output){
            // TODO node-graphviz output gives some troubles with its "dot"
            // child process, probably to just use UNIX pipes for now:
            // wrup -r ... --digraph | dot -Tpng -o test.png
            var ext = path.extname(options.output)
            graph.output(ext.slice(1), options.output)
        }

        this.emit("data", dot)
        this.emit("end")
        callback(null, dot)
    },

    relativeModules: function(){
        var modules = {}
        for (var fullpath in this.modules){
            var mod = this.modules[fullpath]
            if (mod.err) return
            modules[relative(fullpath)] = mod.deps.map(function(dep){
                for (var fullpath in this.modules){
                    if (this.modules[fullpath].uid === dep) return relative(fullpath)
                }
            }, this)
        }
        return modules
    },

    _watch: function(fullpath, callback){
        var self = this
        async.waterfall([
            async.apply(fs.readFile, fullpath, "utf-8"),
            function(src, callback){
                watchFile(fullpath, {interval: 10}, function(oldStat, newStat){
                    if (newStat.mtime.getTime() === oldStat.mtime.getTime()) return
                    fs.readFile(fullpath, "utf-8", function(err, newdata){
                        if (err) return callback(err)
                        if (newdata != src) callback()
                    })
                })
            }
        ], function(err){
            for (var p in self.modules) unwatchFile(p) // unwatch everything
            self.emit("change", fullpath)
            callback()
        })
    },

    _up: function(callback){
        var self = this
        async.parallel([
            getWrapperAST,
            getModuleAST
        ], function(err, results){
            if (err) return callback(err)
            self.output(cloneAST(results[0]), results[1], callback)
        })
    },

    output: function(ast, module, callback){

        if (empty(this.modules)){
            var err = this.error("empty")
            this.emit("error", err)
            this.emit("end")
            return callback(err)
        }

        var self = this
        var options = this._options

        // the position where we can insert the require("x") calls
        var body = ast.body[0].body.expression.body

        // the window["foo"] = require("x")

        for (var ns in this.named){
            body.push(createGlobalizeAST(options.globalize, ns, this.named[ns]))
        }

        // the simple require("x")

        this.nameless.forEach(function(mid){
            body.push(createRequireAST(mid))
        })

        // add the modules to the modules object

        var properties = ast.body[0].body.args[0].properties

        prime.each(this.modules, function(m){
            if (!m.ast) return;
            var ast = cloneAST(module)
            // and add the module ast to the modules object
            ast.key = m.uid
            ast.value.body.push(m.ast)
            properties.push(ast)
        })

        // create source map

        var sourcemap
        if (options.sourcemap){
            var inMap
            if (options.sourcemapIn){
                inMap = readFile(options.sourcemapIn, "utf-8")
            }
            sourcemap = ujs.SourceMap({
                file: options.output,
                root: options.sourcemapRoot,
                orig: inMap
            })
        }

        // generate JS output

        var stream = ujs.OutputStream({
            beautify: !options.compress,
            comments: !options.compress,
            source_map: sourcemap
        })

        ast.print(stream)
        var js = stream.toString()

        var map
        if (options.sourcemap){
            map = sourcemap.toString()
        }

        if (options.compress){
            var compressed = this.compress(js, map)
            js = compressed.js
            map = compressed.map
        }

        if (options.sourcemap){
            js += "\n//@ sourceMappingURL=" + options.sourcemap + "\n"
        }

        var tasks = []

        if (options.sourcemap){
            tasks.push(async.apply(fs.writeFile, options.sourcemap, map + "", "utf-8"))
        }

        if (options.output){
            tasks.push(async.apply(fs.writeFile, options.output, js, "utf-8"))
        }

        // do not emit data if the stream is paused, and do nothing at all if
        // the stream is not readable
        if (this.readable){
            if (!this.paused) this.emit("data", js)
            else this.buffer = js
        }

        async.parallel(tasks, function(err){
            if (err) self.emit("error", err)
            if (!self.watching) self.emit("end")
            callback(err, js)
        })

    },

    compress: function(js, map){

        var options = this._options

        // re-parse
        var ast = ujs.parse(js)

        // compress
        ast.figure_out_scope()
        var sq = ujs.Compressor({
            warnings: false
        })
        ast = ast.transform(sq)

        // mangle
        ast.figure_out_scope()
        ast.compute_char_frequency()
        ast.mangle_names()

        // output

        var sm = ""
        if (options.sourcemap) sm = ujs.SourceMap({
            file: options.sourcemap,
            orig: map,
            root: options.sourcemapRoot
        })

        var stream = ujs.OutputStream({source_map: sm})
        ast.print(stream)

        return {
            js: stream + "",
            map: sm + ""
        }
    },

    error: function(type){
        var args = slice.call(arguments, 1), msg = ""

        switch (type){
            case "namespace":
                msg = "the namespace " + args[0] + " was already in use, could not include " + args[1]
                break
            case "resolve":
                msg = "the module " + args[0] + " required by " + (args[1] || "you") + " could not be resolved"
                break
            case "native":
                msg = "the module " + args[0] + " required by " + (args[1] || "you") + " is a native require"
                break
            case "js":
                msg = "the module " + args[0] + " required by " + (args[1] || "you") + " had a javascript error at line " + args[2].line + ", column " + args[2].col + ": " + args[2].message
                break
            case "empty":
                msg = "no modules required"
                break
        }

        return new Error("ERROR: " + msg)
    }

})

module.exports = WrapUp
