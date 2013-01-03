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
    },

    setOptions: function(options){
        parent.prototype.setOptions.call(this, options)
        this.options.output = options.output || process.cwd() + '/__amd'
        return this
    },

    output: function(callback, defineAST){

        var modules = this.modules
        var output = this.options.output
        var modulesByID = {}
        var tasks = []
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

            module.requires.forEach(function(req, i){
                var dep = modulesByID[module.deps[i]]

                deps.push({
                    type: "Literal",
                    value: relative(full, dep.full)
                })

                var param = '_' + (i++).toString(36)

                params.push({
                    type: "Identifier",
                    name: param
                })

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
                    fs.writeFile(file, code, callback)
                })
            })

        })

        async.parallel(tasks, callback)
    }

})

module.exports = function(modules, options){
    return new output(modules, options)
}
