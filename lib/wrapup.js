"use strict";
// WrapUp base class

var isWindows = process.platform === "win32"

// core requires

var fs       = require("fs"),
    path     = require("path"),
    Stream   = require('stream').Stream,
    exists   = fs.existsSync || path.existsSync,
    readFile = fs.readFileSync,
    pathsep = path.sep || (isWindows ? '\\' : '/')

//@* i love sebmarkbage
var Module = require("module")

// dependencies

var esprima = require("esprima"),
    prime   = require("prime")

// Error objects

var errors                = require('./errors'),
    WrapUpNativeError     = errors.NativeError,
    WrapUpNotInPathError  = errors.NotInPathError,
    WrapUpNamespaceError  = errors.NamespaceveError,
    WrapUpResolveError    = errors.ResolveError,
    WrapUpJavaScriptError = errors.JavaScriptError

// util methods

var util = require('./util')

var outputCallback = function(wrup, callback){
    return function(err, code){
        if (err) wrup.emit(wrup.watching ? "warn" : "error", err)
        else if (code != null) wrup.emit("data", code)
        if (!wrup.watching) wrup.emit("end")
        if (callback) callback(err, code)
    }
}

var handleGoError = function(wrup, err){
    wrup.emit("error", err)
    wrup.emit("end")
    return wrup
}

// WrapUp

var WrapUp = prime({

    inherits: Stream,

    // public API

    constructor: function(options){
        Stream.call(this)

        this.readable = true
        this.paused = false

        this.required = []
        this.options(options)
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

    // public API

    options: function(options){
        var _options = this._options || (this._options = {})
        if (!options) options = {}
        if (options.globalize != null) _options.globalize = options.globalize
        if (options.compress != null) _options.compress = options.compress
        if (options.inPath != null) _options.inPath = options.inPath
        if (options.output != null) _options.output = options.output
        if (options.sourcemap != null) _options.sourcemap = options.sourcemap
        if (options.sourcemapRoot != null) _options.sourcemapRoot = options.sourcemapRoot
        if (options.sourcemapURL != null) _options.sourcemapURL = options.sourcemapURL
        if (options.ast != null) _options.ast = options.ast
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
        return this.browser(callback)
    },

    browser: function(callback){
        var err = this.go()
        if (err) return handleGoError(this, err)
        require('./output/browser')(this, outputCallback(this, callback))
        return this
    },

    amd: function(callback){
        var err = this.go()
        if (err) return handleGoError(this, err)
        require('./output/amd')(this, outputCallback(this, callback))
        return this
    },

    graph: function(callback){
        var err = this.go()
        if (err) return handleGoError(this, err)
        require('./output/graph')(this, outputCallback(this, callback))
        return this
    },

    watch: function(method, callback){
        var self = this

        if (!this.watching){
            this.watching = true

            // make CTRL+C call the exit event
            process.on("SIGINT", function(){
                process.exit()
            })
            process.on("exit", function(){
                self.emit("end")
                ;(callback || util.noop)()
            })
        }

        // this flag prevents re-watching when building isn't ready yet.
        this._watchBuilding = true

        this[method](function(err){
            if (err) self.emit("warn", err)
            self._watchBuilding = false
            self._watch(function(err){
                if (err) self.emit("warn", err)
                else if (!self._watchBuilding) self.watch(method, callback)
            })
        })
        return this
    },

    // private API

    _watch: function(callback){
        var self = this, watchers = {}

        var changed = function(file){
            for (var p in watchers) watchers[p].close()
            self.emit("change", file)
            callback()
        }

        prime.each(this.modules, function(module, fullpath){
            fs.readFile(fullpath, "utf-8", function(err, src){
                if (err) return callback(err)
                // we need an throttle, because it can happen sometimes that the
                // watch callback is called multiple times for the same change.
                watchers[fullpath] = fs.watch(fullpath, util.throttle(function(){
                    fs.readFile(fullpath, "utf-8", function(err, now){
                        // the file was removed
                        if (err && err.code == 'ENOENT') changed(fullpath)
                        // something else gone wrong
                        else if (err) callback(err)
                        // file has changed its content
                        else if (now != src) changed(fullpath)
                    })
                }))
            })
        })
    },

    // fill the modules, named and nameless objects, by processing each file.
    go: function(){

        this.packages = {}
        this.modules  = {}
        this.named    = {}
        this.nameless = []
        this.index    = 0
        var err

        this.required.some(function(m){
            var namespace = m[0], module = m[1]

            if (namespace && this.named[namespace]){
                err = new WrapUpNamespaceError(namespace, module)
                return true
            }

            var id = module && this.scan(module, null)
            if (id){
                if (namespace) this.named[namespace] = id
                else if (this.nameless.indexOf(id) === -1) this.nameless.push(id)
            }
        }, this)

        // check if there are any modules required
        if (!err && util.empty(this.modules)){
            err = new errors.EmptyError()
        }

        return err
    },

    // now we use esprima, the scan doesn't have to be sync actually, but it's
    // a lot simpler, and easier to read.
    scan: function(what, from){

        var modulefull = this.resolve(what, from)

        if (modulefull == null){
            this.emit("warn", new WrapUpResolveError(what, from))
            return
        }

        if (modulefull === true){
            this.emit("warn", new WrapUpNativeError(what, from))
            return
        }

        if (modulefull === false){
            this.emit("warn", new WrapUpNotInPathError(what, from, this._options.inPath))
            return
        }

        var module = this.modules[modulefull]
        if (module) return module.uid

        var src
        try {
            src = readFile(modulefull, "utf-8")
        } catch(e){
            // It is possible that .resolve still resolves the file correctly,
            // but that the file actually doesn't exist anymore. Then still
            // fire the "warn" event that the file cannot be resolved
            if (e.code == 'ENOENT'){
                this.emit("warn", new WrapUpResolveError(what, from))
                return
            }
            throw e
        }

        var ast
        try {
            // parse the code with esprima to see if there are any errors
            // and so we can walk through the AST to find require()s
            ast = esprima.parse(src, {
                source: util.relative(modulefull), // see https://github.com/ariya/esprima/pull/148
                loc: true
            })
        } catch (err){
            // add to the object so it will be watched for newer versions
            this.modules[modulefull] = {err: true}
            // ujs.parse already logs this error, but yes, twice doesn't hurt
            // for now
            this.emit("warn", new WrapUpJavaScriptError(modulefull, from, err.line, err.col))
            return
        }

        module = this.modules[modulefull] = {
            uid: (this.index++).toString(36),
            full: modulefull,
            deps: [], // dependencies
            requires: [], // require APT nodes
            ast: ast
        }

        this.walkASTForRequires(module)

        return module.uid
    },

    walkASTForRequires: function(module){
        var self = this
        var ast = module.ast
        var sourcemap = this._options.sourcemap && ast.loc && !ast.loc.source
        var source = sourcemap && util.relative(module.full)
        util.astWalker(module.ast, function(ast, parent, key){
            // temporary fix until https://github.com/ariya/esprima/pull/148
            // is pulled and released.
            if (sourcemap && key == 'loc'){
                ast.source = source
                return true
            }
            if (ast && (ast.type == "CallExpression" || ast.type == "NewExpression") && ast.callee.name == "require"){
                module.requires.push({require: ast, parent: parent, key: key})
                var dep = ast['arguments'].length == 1 && ast['arguments'][0].value
                var k = dep && self.scan(dep, module.full)
                // note that deps now also contains "null" values if the module
                // could not be resolved. This way an output prime can determine
                // to remove the require, or do something else with it.
                module.deps.push(k || null)
                return true
            }
        })
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

        var inPath = this._options.inPath
        if (inPath && !util.inPath(inPath, module)) return false

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
    }

})

module.exports = WrapUp
