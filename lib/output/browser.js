"use strict";

var fs        = require('fs')
var prime     = require('prime')
var escodegen = require('escodegen')
var esmangle  = require('esmangle')
var async     = require('async')
var util      = require('../util')

var getWrapperAST  = util.getAST('browser-wrapper')
var getModuleAST   = util.getAST('browser-module')
var getNamedAST    = util.getAST('browser-named')
var getNamelessAST = util.getAST('browser-nameless')

var getVarNamedAST   = util.getAST('var-named')
var getVarWrapperAST = util.getAST('var-wrapper')

var output = prime({

    inherits: require('./'),

    up: function(callback){
        var self = this
        var vars = this._options.globalizeVars
        async.parallel([
            vars ? getVarWrapperAST : getWrapperAST,
            vars ? getVarNamedAST   : getNamedAST,
            getModuleAST,
            getNamelessAST
        ], function(err, results){
            if (err) return callback(err)
            self.output(callback, results[0], results[1], results[2], results[3])
        })
        return this
    },

    output: function(callback, wrapperAST, namedAST, moduleAST, namelessAST){

        var self = this
        var options = this._options
        var globalize = options.globalize
        var vars = options.globalizeVars
        var compress = options.compress
        var sourcemap = options.sourcemap
        var wrapper = util.clone(wrapperAST)
        var module, id

        // the closure function
        var wrapperClosure = wrapper.body[0]
        wrapperClosure = vars ? wrapperClosure.declarations[0].init : wrapperClosure.expression

        // the position where we can insert the modules
        var properties = wrapperClosure['arguments'][0].properties

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

        // body where to place "require('0')" and "window['foo'] = require('1')"
        var wrapperBody = wrapperClosure.callee.body.body

        // "global[name] = require('...')" named modules, that need to be exported
        prime.each(this.named, function(id, name){
            var named = util.clone(namedAST.body[0])
            if (vars){
                // adding var statements at the end of the file
                var declaration = named.declarations[0]
                declaration.id.name = name
                declaration.init['arguments'][0].value = id
                wrapper.body.push(named)
            } else {
                // adding modules to the global object inside the wrapper closure
                var expression = named.expression, left = expression.left
                left.object.name = globalize
                left.property.value = name
                expression.right['arguments'][0].value = id
                wrapperBody.push(named)
            }
        })

        // nameless requires, "require("...")"
        this.nameless.forEach(function(id){
            var nameless = util.clone(namelessAST.body[0])
            nameless.expression['arguments'][0].value = id
            wrapperBody.push(nameless)
        })

        if (compress) wrapper = esmangle.mangle(wrapper)

        var code, map

        var escodegenOptions = {
            format: compress ? {
                renumber: true,
                hexadecimal: true,
                escapeless: true,
                compact: true,
                semicolons: false,
                parentheses: false
            } : {}
        }

        if (sourcemap){
            map = escodegen.generate(wrapper, util.merge({
                sourceMap: true,
                // see https://github.com/Constellation/escodegen/pull/82
                sourceMapRoot: options.sourcemapRoot
            }, escodegenOptions))
            // temp fix for https://github.com/Constellation/escodegen/pull/82
            if (options.sourceRoot){
                map = JSON.parse(map)
                map.sourceRoot = options.sourcemapRoot
                map = JSON.stringify(map)
            }
        }

        if (!options.ast){
            code = escodegen.generate(wrapper, escodegenOptions)
            if (sourcemap) code += "\n//@ sourceMappingURL=" + (options.sourcemapURL || sourcemap) + "\n"
        } else {
            if (compress) code = JSON.stringify(wrapper)
            else code = JSON.stringify(wrapper, null, 2)
        }

        var tasks = []

        if (sourcemap){
            tasks.push(function(callback){
                fs.writeFile(sourcemap, map + "", "utf-8", function(err){
                    if (!err) self.wrup.emit("output", sourcemap)
                    callback(err)
                })
            })
        }

        if (options.output){
            tasks.push(function(callback){
                fs.writeFile(options.output, code, "utf-8", function(err){
                    if (!err) self.wrup.emit('output', options.output)
                    callback(err)
                })
            })
        }

        async.parallel(tasks, function(err){
            callback(err, code)
        })
    }

})

module.exports = function(modules, callback){
    new output(modules).up(callback)
}
