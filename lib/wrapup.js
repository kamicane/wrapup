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
    parser  = ujs.parser,
    uglify  = ujs.uglify


var prime   = require("prime/prime"),
    Emitter = require("prime/util/emitter")

// util methods

var replaces = function(str, obj){
    for (var key in obj) str = str.replace(new RegExp("@" + key, "g"), function(){
        return obj[key]
    })
    return str
}

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

var ipath = path.join(__dirname, "../includes/"),
    boil  = "(function(modules){" + readFile(ipath + "require.js", "utf-8") + "\n@wrup\n@named\n@nameless})({@modules})",
    wrup  = "window['@wrup'] = function(id){return (id = map[id]) ? require(id) : null}",
    req   = "require('@id')",
    glob  = 'window@object["@name"] = ' + req,
    mods  = "'@id': function(require, module, exports, global){@src}"

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
            ast = parser.parse(src)
        } catch (err){
            this.emit("error:js", modulefull, from, err)
            this.modules[modulefull] = {err: true}
            return null
        }

        module = this.modules[modulefull] = {
            uid: (this.index++).toString(36),
            deps: []
        }

        var self = this

        var walkAST = function(ast){
            if (ast[0] == 'call'){
                // is it a require() call
                if (ast[1][0] == 'name' && ast[1][1] == 'require'){
                    // get the first argument, it should be a string
                    var dep = ast[2][0] && ast[2][0][0] == 'string' && ast[2][0][1]
                    if (dep !== false){
                        var k = self.scan(dep, modulefull)
                        if (k){
                            module.deps.push(k)
                            ast[2][0][1] = k
                        } else {
                            ast[0] = 'name'
                            ast[1] = 'null'
                            ast.pop()
                        }
                        return
                    }
                }
            }
            // no require call; recurse into the other subtrees
            for (var i = 0; i < ast.length; i++){
                if (Array.isArray(ast[i])) walkAST(ast[i])
            }
        }

        walkAST(ast)
        module.src = uglify.gen_code(ast)

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

        if (!options.wrup && !options.globalize){
            this.emit("error:access")
            return ""
        }

        var flat     = [],
            globals  = [],
            map      = {},
            requires = [],
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

                flat.push(replaces(mods, {id: mod.uid, src: mod.src}))

                modules[path.relative(process.cwd(), fullpath)] = mod.deps.map(function(dep){
                    for (var fullpath in this.modules){
                        if (this.modules[fullpath].uid === dep) return path.relative(process.cwd(), fullpath)
                    }
                }, this)

            }

            if (options.watch) watch(fullpath)
        }

        if (options.graph){

            try {
                var graphviz = require('graphviz')
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

        for (var ns in this.named){
            if (options.globalize) globals.push(replaces(glob, {
                object: (options.globalize === "window") ? '' : '["' + options.globalize + '"]',
                id: this.named[ns],
                name: ns
            }))
            map[ns] = this.named[ns]
        }

        this.nameless.forEach(function(mid){
            requires.push(replaces(req, {id: mid}))
        })

        var js = replaces(boil, {
            modules: flat.join(","),
            named: (options.globalize) ? globals.join("\n") : "",
            nameless: requires.join("\n"),
            wrup: (options.wrup) ? ", map = " + JSON.stringify(map) + "\n" + replaces(wrup, {wrup: options.wrup}) : ""
        })

        try {

            var ast = parser.parse(js)

            if (options.compress){
                ast = uglify.ast_mangle(ast)
                ast = uglify.ast_squeeze(ast)
            }

            js = uglify.gen_code(ast, {beautify: !options.compress})

            if (options.output) writeFile(options.output, js, "utf-8")

            this.emit("done", js)

            return js

        } catch(err){
            this.emit("error:internal", err)
        }

        return ""

    }

})

WrapUp.prototype.toString = WrapUp.prototype.up

module.exports = WrapUp
