"use strict";

var fs        = require('fs')
var prime     = require('prime')
var escodegen = require('escodegen')
var async     = require('async')
var util      = require('../util')

var getWrapperAST  = util.getAST('qt-wrapper')
var getModuleAST   = util.getAST('qt-module')
var getNamedAST    = util.getAST('qt-named')
var getNamelessAST = util.getAST('qt-nameless')

var output = prime({

    inherits: require('./'),

    up: function(callback){
        var self = this
        async.parallel([
            getModuleAST,
            getWrapperAST,
            getNamedAST,
            getNamelessAST
        ], function(err, results){
            if (err) callback(err)
            else self.output(callback, results[0], results[1], results[2], results[3])
        })
    },

    output: function(callback, moduleAST, wrapperAST, namedAST, namelessAST){

        var self = this
        var wrapper = util.clone(wrapperAST)
        var module, id, name

        // the position where we can insert the modules
        var properties = wrapper.body[0].declarations[0].init['arguments'][0].properties

        // build the wrapper and modules object
        prime.each(this.modules, function(module, id){

            var ast = module.ast

            // module key and value
            var newAST = util.clone(moduleAST.body[0].declarations[0].init.properties[0])
            newAST.key.value = module.uid
            var body = newAST.value.body.body

            // put the module JS into the module function
            for (var i = 0; i < ast.body.length; i++){
                body.push(ast.body[i])
            }

            // and the module function in the "modules" object
            properties.push(newAST)

            // replace "require('...')" with the module id or replace the
            // entire require() with null if the required module doesn't exist.
            for (var r = 0; r < module.requires.length; r++){
                var req = module.requires[r]
                var dep = module.deps[r]
                if (dep){
                    req.require['arguments'][0].value = module.deps[r]
                } else {
                    req.parent[req.key] = {type: "Literal", value: null}
                }
            }

        })

        // "var name = __require('...')" named modules, that need to be exported
        prime.each(this.named, function(id, name){
            var named = util.clone(namedAST.body[0])
            named.declarations[0].id.name = name
            named.declarations[0].init['arguments'][0].value = id
            wrapper.body.push(named)
        })

        // "require('...')"
        this.nameless.forEach(function(id){
            var nameless = util.clone(namelessAST.body[0])
            nameless.expression['arguments'][0].value = id
            wrapper.body.push(nameless)
        })

        // generate JS
        var code = escodegen.generate(wrapper)

        if (this._options.output){
            fs.writeFile(this._options.output, code, function(err){
                self.wrup.emit('output', this._options.output)
                callback(err, code)
            })
        } else {
            callback(null, code)
        }

    }

})

module.exports = function(modules, callback){
    new output(modules).up(callback)
}
