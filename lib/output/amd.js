"use strict";

var path      = require('path')
var fs        = require('fs')
var prime     = require('prime')
var mkdirp    = require('mkdirp')
var escodegen = require('escodegen')
var async     = require('async')
var util      = require('../util')
var errors    = require('../errors')

var getDefineAST = util.getAST('amd-module')

var relative = function(from, to){
    var file = path.dirname(from) == path.dirname(to) ?
        './' + path.relative(path.dirname(from), to) :
        path.relative(from, to)
    return (path.extname(file) == '.js') ? file.slice(0, -3) : file
}

var uid = 0;

var output = prime({

    inherits: require('./'),

    up: function(callback){

        if (!this._options.output){
            callback(new errors.RequiredOutputError())
            return this
        }

        var self = this
        getDefineAST(function(err, ast){
            if (err) callback(err)
            else self.output(callback, ast)
        })
        return this
    },

    output: function(callback, defineAST){

        var modules = this.modules
        var output = this._options.output
        var modulesByID = {}
        var tasks = []
        var self = this
        var i = 0

        prime.each(modules, function(module, full){
            modulesByID[module.uid] = module
            var file = util.relative(full)
            // rename modules if the files are out of scope
            if (file.slice(0, 2) == '..'){
                self.wrup.emit("warn", new errors.OutOfScopeError(full))
                file = '__oos/' + (uid++) + '-' + path.basename(full)
            }
            module.file = file
        })

        prime.each(modules, function(module){

            var file = module.file

            var define = util.clone(defineAST)
            var ast = module.ast
            var body = define.body[0].expression['arguments'][1].body.body

            // put the module JS into the module function
            for (var i = 0; i < ast.body.length; i++){
                body.push(ast.body[i])
            }

            // the AMD dependencies array, and "factory" parameters
            var deps = define.body[0].expression['arguments'][0].elements
            var params = define.body[0].expression['arguments'][1].params

            var paths = {}

            // replace require calls.
            module.requires.forEach(function(req, i){
                var dep = modulesByID[module.deps[i]]
                if (!dep) return

                var path = relative(file, dep.file)
                var param = paths[path]

                // add to AMD dependency array, if necessary
                if (!paths[path]){
                    param = (paths[path] = '__' + i.toString(36))
                    deps.push({type: "Literal", value: path})
                    params.push({type: "Identifier", name: param})
                }

                req.parent[req.key] = {type: "Identifier", name: param}
            })

            var code = escodegen.generate(define)
            var filename = path.normalize(output + '/' + file)

            tasks.push(function(callback){
                async.series([
                    async.apply(mkdirp, path.dirname(filename)),
                    async.apply(fs.writeFile, filename, code)
                ], function(err){
                    if (!err) self.wrup.emit("output", filename)
                    callback(err)
                })
            })

        })

        async.parallel(tasks, callback)
    }

})

module.exports = function(wrup, callback){
    new output(wrup).up(callback)
}
