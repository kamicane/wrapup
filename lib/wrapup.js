// WrapUp base class

// core requires

var readFile = require("fs").readFileSync,
    path     = require("path")

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
    for (var key in obj) str = str.replace(new RegExp("@" + key, "g"), obj[key])
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
    boil  = "(function(modules){'use strict';\n"+ readFile(ipath + "require.js", "utf-8") + "\n@wrup\n@named\n@nameless})({@modules})",
    wrup  = "window['@wrup'] = function(id){return (id = map[id]) ? require(id) : null}",
    req   = "require('@id')",
    glob  = "window@object['@name'] = " + req,
    mods  = "'@id': function(require, module, exports, global){@src}"

// WrapUp

var WrapUp = prime({

    inherits: Emitter,

    constructor: function(){
        this.packages = {}
        this.modules  = {}
        this.named    = {}
        this.nameless = []

        this.index = 0
    },

    exclude: function(){
        if (!this.excludes) this.excludes = []
        this.excludes.push.apply(this.excludes, arguments)
        return this
    },

    scan: function(what, from){

        var modulefull = this.resolve(what, from)
        if (!modulefull){
            this.emit("error:resolve", what, from)
            return null
        }

        if (modulefull.indexOf("/") !== 0){
            this.emit("error:native", modulefull, from)
            return null
        }

        var module = this.modules[modulefull]

        if (module) return module.uid

        var src = readFile(modulefull, "utf-8").toString()

        // custom excludes
        src = exclude(src, this.excludes)

        try { // parse the code with ujs to see if there are any errors
            var ast = parser.parse(src)
            src = uglify.gen_code(ast)
        } catch (err){
            this.emit("error:js", modulefull, from, err)
            return null
        }

        module = this.modules[modulefull] = {
            uid: (this.index++).toString(36),
            deps: []
        }

        var modulepath = path.dirname(modulefull),
            modulename = path.basename(modulefull, ".js")

        var self = this

        module.src = src.replace(/require\(\s*["']([^'"\s]+)["']\s*\)/g, function(match, dependency){
            var k = self.scan(dependency, modulefull)
            if (k){
                module.deps.push(k)
                return "require('" + k + "')"
            }
            return "null"
        })

        return module.uid
    },

    resolve: function(what, from){

        // this makes sure we always use the same directory for a specified package (the first it encounters)
        // this might not be ideal, but duplicating packages for the web is even worse

        if (what.indexOf(".") != 0 && what.indexOf("/") != 0){ //requiring a package

            var parts  = what.split("/"),
                pkg    = parts.splice(0, 1)[0],
                module = parts.join("/")

            var resolved = this.nodeResolve(pkg, from)
            if (!resolved) return null
            var jsonpath = this.findJSON(resolved)
            if (!jsonpath) return null

            var json = require(jsonpath)
            var id = json.name + "@" + json.version

            var prevPackage = this.packages[id]

            var pkgpath = prevPackage || (this.packages[id] = path.dirname(jsonpath))

            what = path.join(pkgpath, module)

        }

        return this.nodeResolve(what, from)
    },

    nodeResolve: function(module, from){ //resolve module from cwd or relative to another module.
        from = (from == null) ? path.join(process.cwd(), "wrup") : path.resolve(from)
        var m = new Module(from)
        m.filename = from
        m.paths = Module._nodeModulePaths(path.dirname(from))
        try {
            return Module._resolveFilename(module, m)
        } catch (err){}
        return null
    },

    findJSON: function(file){
        var json
        var dirname = file
        while(dirname = path.dirname(dirname)){
            var jsonpath = path.join(dirname, "package.json")
            try {
                json = this.resolve(jsonpath)
                if (json) break
            } catch(err){}
            if (dirname === "/") break
        }
        return json
    },

    require: function(namespace, module){

        if (module == null){ // either [namespace, module] or [module]
            module = namespace
            namespace = null
        }

        var id = null
        if (!namespace || !this.named[namespace]){
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

        if (!options.wrup && !options.globalize){
            this.emit("error:access")
            return ""
        }

        var flat     = [],
            globals  = [],
            map      = {},
            requires = [],
            modules  = {}

        for (var fullpath in this.modules){
            var mod = this.modules[fullpath]
            flat.push(replaces(mods, {id: mod.uid, src: mod.src}))

            modules[path.relative(process.cwd(), fullpath)] = mod.deps.map(function(dep){
                for (var fullpath in this.modules) if (this.modules[fullpath].uid === dep) return path.relative(process.cwd(), fullpath)
            }, this)
        }

        if (flat.length === 0){
            this.emit("error:empty")
            return ""
        }

        for (var ns in this.named){
            if (options.globalize) globals.push(replaces(glob, {
                object: (options.globalize === "window") ? "" : "['" + options.globalize + "']",
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
        });

        try {
            var ast = parser.parse(js)
            if (options.compress){
                ast = uglify.ast_mangle(ast)
                ast = uglify.ast_squeeze(ast)
                ast = uglify.ast_lift_variables(ast)
            }
            return uglify.gen_code(ast, {beautify: !options.compress})
        } catch(err){
            this.emit("error:internal", err)
        }

        return ""

    }

})

WrapUp.prototype.toString = WrapUp.prototype.up

module.exports = WrapUp
