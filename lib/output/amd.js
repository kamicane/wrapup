"use strict";

var path      = require('path')
var fs        = require('fs')
var prime     = require('prime')
var mkdirp    = require('mkdirp')
var escodegen = require('escodegen')
var async     = require('async')
var util      = require('../util')

var getDefineAST = util.getAST('amd-module')

var relative = function(from, to){
    var file
    if (path.dirname(from) == path.dirname(to)){
        file = './' + path.relative(path.dirname(from), to)
    } else {
        file = path.relative(from, to)
    }
    var ext = path.extname(file)
    if (ext == '.js') file = file.slice(0, -3)
    return file
}

var parent = require('./')

var output = prime({

    inherits: parent,

    up: function(callback){
        var self = this
        getDefineAST(function(err, ast){
            if (err) callback(err)
            else self.output(callback, ast)
        })
        return this
    },

    options: function(options){
        if (!options.output) options.output = process.cwd() + '/__amd'
    },

    output: function(callback, defineAST){

        var modules = this.modules
        var output = this._options.output
        var modulesByID = {}
        var tasks = []
        var self = this
        var i = 0

        prime.each(modules, function(module){
            modulesByID[module.uid] = module
        })

        prime.each(modules, function(module, full){

            var define = util.clone(defineAST)
            var ast = module.ast
            var body = define.body[0].expression['arguments'][1].body.body

            // put the module JS into the module function
            for (var i = 0; i < ast.body.length; i++){
                body.push(ast.body[i])
            }

            var deps = define.body[0].expression['arguments'][0].elements
            var params = define.body[0].expression['arguments'][1].params

            var paths = {}

            module.requires.forEach(function(req, i){
                var dep = modulesByID[module.deps[i]]

                var path = relative(full, dep.full)
                var param = paths[path]

                if (!paths[path]){

                    param = (paths[path] = '__' + i.toString(36))

                    deps.push({
                        type: "Literal",
                        value: path
                    })

                    params.push({
                        type: "Identifier",
                        name: param
                    })

                }

                req.parent[req.key] = {
                    type: "Identifier",
                    name: param
                }

            })

            var code = escodegen.generate(define)

            var file = output + '/' + util.relative(full)
            var dir = path.dirname(file)

            tasks.push(function(callback){
                mkdirp(dir, function(err){
                    if (err) return callback(err)
                    fs.writeFile(file, code, function(err){
                        if (err) return callback(err)
                        self.wrup.emit("output", file)
                        callback()
                    })
                })
            })

        })

        async.parallel(tasks, callback)
    }

})

module.exports = function(wrup, callback){
    new output(wrup).up(callback)
}
