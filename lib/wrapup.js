"use strict";
// WrapUp base class

var isWindows = process.platform === "win32"

// core requires

var fs          = require("fs"),
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
    Emitter = require("prime/util/emitter")

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

// templates
var ipath = path.join(__dirname, "../includes/")
var wrapperAST = ujs.parse(readFile(ipath + "wrapper.js", "utf-8", {
    filename: 'wrapper.js'
}))
var moduleAST = ujs.parse(readFile(ipath + "module.js", "utf-8", {
    filename: 'module.js'
}))
// find the AST_ObjectProperty
moduleAST = moduleAST.body[0].definitions[0].value.properties[0]

// deep clone the AST tree
var cloneAST = function(ast){
    return ast.transform(new ujs.TreeTransformer(function(node, descend){
        node = node.clone()
        descend(node, this)
        return node
    }))
}

// ast for "require('module id')"
var createRequireAST = function(mid){
    return new ujs.AST_Call({
        expression: new ujs.AST_SymbolDefun({name: 'require'}),
        args: [
            new ujs.AST_String({value: mid})
        ]
    })
}

// ast for "global[name] = require('module id')"
var createGlobalizeAST = function(global, name, mid){
    return new ujs.AST_SimpleStatement({
        body: new ujs.AST_Assign({
            left: new ujs.AST_Sub({
                expression: new ujs.AST_SymbolDefun({
                    name: global
                }),
                property: new ujs.AST_String({
                    value: name
                })
            }),
            right: createRequireAST(mid),
            operator: '='
        })
    })
}

// WrapUp

var WrapUp = prime({

    inherits: Emitter,

    constructor: function(){
        this.packages = {}
        this.modules  = {}
        this.named    = {}
        this.nameless = []
        this.required = []

        this.index = 0
    },

    exclude: function(){
        if (!this.excludes) this.excludes = []
        Array.prototype.push.apply(this.excludes, Array.prototype.slice.call(arguments))
        return this
    },

    scan: function(what, from){

        var modulefull = this.resolve(what, from)

        if (modulefull == null){
            this.emit("error:resolve", what, from)
            return null
        }

        if (modulefull === true){
            this.emit("error:native", what, from)
            return null
        }

        var module = this.modules[modulefull]

        if (module) return module.uid

        var src = readFile(modulefull, "utf-8").toString()

        // custom excludes
        src = exclude(src, this.excludes)

        var ast
        try {
            // parse the code with ujs to see if there are any errors
            // and so we can walk through the AST to find require()s
            ast = ujs.parse(src, {
                filename: path.relative(process.cwd(), modulefull)
            })
        } catch (err){
            // TODO improve uglify-js2 error handling
            this.emit("error:js", modulefull, from, err)
            this.modules[modulefull] = {err: true}
            return null
        }

        module = this.modules[modulefull] = {
            uid: (this.index++).toString(36),
            deps: []
        }

        var self = this

        var unresolved, require_call
        var walker = new ujs.TreeTransformer(function(node, descend){
            if (node instanceof ujs.AST_Call && node.start.value == 'require'){
                // we're in a require() call
                var tmp1 = require_call, tmp2 = unresolved, ret
                require_call = node
                // walk require() arguments
                descend(node, this)
                require_call = tmp1
                // require was unresolved, replace node with AST_Null
                if (unresolved) ret = new ujs.AST_Null({
                    start: node.start,
                    end: node.end
                })
                unresolved = tmp2
                return ret
            }
            if (require_call && node instanceof ujs.AST_String){
                // found a require("dep")
                var dep = node.getValue()
                var k = self.scan(dep, modulefull)
                if (k){
                    module.deps.push(k)
                    node.value = k
                } else {
                    unresolved = true
                }
            }
        })

        module.ast = ast.transform(walker)

        return module.uid
    },

    resolve: function(what, from){
        // this makes sure we always use the same directory for a specified package (the first it encounters)
        // this might not be ideal, but duplicating packages for the web is even worse

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

    nodeResolve: function(module, from){ //resolve module from cwd or relative to another module.
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

    require: function(namespace, module){

        this.required.push([namespace, module])

        if (module == null){ // either [namespace, module] or [module]
            module = namespace
            namespace = null
        }

        var id = null
        if (!namespace || !this.named[namespace]){
            if (module == null) return this
            id = this.scan(module)
            if (id){
                if (namespace) this.named[namespace] = id
                else if (this.nameless.indexOf(id) === -1) this.nameless.push(id)
            }
        } else {
            this.emit("error:namespace", namespace, module)
        }
        return this
    },

    log: function(prefix){

        if (this.logging) return this

        if (prefix == null) prefix = "ERROR: "

        this.on("error:js", function(module, from, err){
            console.error(prefix + "the module %s required by %s had a javascript error at line %d, column %d: %s", module, from || 'you', err.line, err.col, err.message)
        })

        this.on("error:resolve", function(module, from){
            console.error(prefix + "the module %s required by %s could not be resolved", module, from || 'you')
        })

        this.on("error:native", function(module, from){
            console.error(prefix + "the module %s required by %s is a native require", module, from || 'you')
        })

        this.on("error:package", function(pkg){
            console.error(prefix + "the package %s could not be resolved", pkg)
        })

        this.on("error:namespace", function(namespace, module){
            console.error(prefix + "the namespace %s was already in use, could not include %s", namespace, module)
        })

        this.on("error:access", function(){
            console.error(prefix + "both --globalize and --wrup are false, modules are not accessible")
        })

        this.on("error:empty", function(){
            console.error(prefix + "no modules required")
        })

        this.on("error:graphviz", function(err){
            console.error(prefix + "graphviz not found")
        })

        this.on("error:internal", function(err){
            console.error(prefix + "internal wrapup error at line %d, column %d: %s", err.line, err.col, err.message)
        })

        this.logging = true

        return this

    },

    up: function(options){

        if (options == null) options = {}

        if (options.wrup == null) options.wrup = false
        if (options.wrup === true) options.wrup = "wrup"
        if (options.globalize == null) options.globalize = "window"
        if (options.compress == null) options.compress = false
        if (options.watch == null) options.watch = false
        if (options.output == null) options.output = false
        if (options.sourcemap == null) options.sourcemap = false
        if (options.sourcemapRoot == null) options.sourcemapRoot = false
        if (options.sourcemapIn == null) options.sourcemapIn = false

        if (!options.wrup && !options.globalize){
            this.emit("error:access")
            return ""
        }

        var flat     = [],
            modules  = {}

        var self = this

        var watch = function(fullpath){

            var filedata = readFile(fullpath, "utf-8")

            watchFile(fullpath, {interval: 10}, function(oldStat, newStat){

                if (newStat.mtime.getTime() === oldStat.mtime.getTime()) return

                var data = readFile(fullpath, "utf-8")
                if (filedata !== data){

                    for (var p in self.modules) unwatchFile(p) // unwatch everything

                    self.emit("change", fullpath)
                    var required = self.required // save current requires
                    self.constructor() // resets WrapUp
                    required.forEach(function(r){ // re-requires
                        self.require(r[0], r[1])
                    })
                    self.up(options)
                }
            })

        }

        for (var fullpath in this.modules){
            var mod = this.modules[fullpath]

            if (!mod.err){

                flat.push({id: mod.uid, ast: mod.ast})

                modules[path.relative(process.cwd(), fullpath)] = mod.deps.map(function(dep){
                    for (var fullpath in this.modules){
                        if (this.modules[fullpath].uid === dep) return path.relative(process.cwd(), fullpath)
                    }
                }, this)

            }

            if (options.watch) watch(fullpath)
        }

        if (options.graph){

            var graphviz
            try {
                graphviz = require('graphviz')
            } catch (err){
                this.emit("error:graphviz")
                return ""
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
                var ext = path.extname(options.output)
                graph.output(ext.slice(1), options.output)
            }

            this.emit("done", dot)
            return dot
        }

        if (flat.length === 0){
            this.emit("error:empty")
            return ""
        }

        var ast = cloneAST(wrapperAST);

        // the position where we can insert the require("x") calls

        var body = ast.body[0].body.expression.body

        // the window["foo"] = require("x")

        for (var ns in self.named){
            body.push(createGlobalizeAST(options.globalize, ns, self.named[ns]))
        }

        // the simple require("x")

        this.nameless.forEach(function(mid){
            body.push(createRequireAST(mid))
        })

        // add the modules to the modules object

        var properties = ast.body[0].body.args[0].properties

        flat.forEach(function(m){
            var ast = cloneAST(moduleAST)
            // and add the module ast to the modules object
            ast.key = m.id
            ast.value.body.push(m.ast)
            properties.push(ast)
        })

        // compress

        if (options.compress){
            ast.figure_out_scope()
            var sq = ujs.Compressor({warnings: true})
            ast = ast.transform(sq)
            ast.figure_out_scope()
            ast.compute_char_frequency()
            ast.mange_names()
        }

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

        if (options.sourcemap){
            var map = sourcemap.toString()
            writeFile(options.sourcemap, map, "utf-8")
            js += "//@ sourceMappingURL=" + options.sourcemap
        }

        if (options.output){
            writeFile(options.output, js, "utf-8")
        }

        this.emit("done", js)

        // TODO improve error handling
        // TODO implement the compress option, and maybe some way to
        // pass uglify-js options (for example for comments)

        return js

    }

})

WrapUp.prototype.toString = WrapUp.prototype.up

module.exports = WrapUp
