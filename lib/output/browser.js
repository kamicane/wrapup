"use strict";

var prime  = require('prime')
var escodegen = require('escodegen')
var async  = require('async')
var util   = require('../util')
var errors = require('../errors')

var getWrapperAST  = util.getAST('wrapper')
var getModuleAST   = util.getAST('module')
var getNamedAST    = util.getAST('named')
var getNamelessAST = util.getAST('nameless')

var output = prime({

    inherits: require('./'),

    up: function(callback){
        var self = this
        async.parallel([
            getWrapperAST,
            getModuleAST,
            getNamedAST,
            getNamelessAST
        ], function(err, results){
            if (err) return callback(err)
            self.output(callback, results[0], results[1], results[2], results[3])
        })
    },

    output: function(callback, wrapperAST, moduleAST, namedAST, namelessAST){

        // TODO generalize this.
        if (util.empty(this.modules)){
            var err = new errors.EmptyError()
            this.emit("error", err)
            this.emit("end")
            return callback(err)
        }

        var self = this
        var options = this._options

        var wrapper = util.clone(wrapperAST)
        var module, id

        // the position where we can insert the modules
        var properties = wrapper.body[0].expression['arguments'][0].properties

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
        var reqbody = wrapper.body[0].expression.callee.body.body

        // "global[name] = require('...')" named modules, that need to be exported
        prime.each(this.named, function(id, name){
            var named = util.clone(namedAST.body[0])
            named.expression.left.property.value = name
            named.expression.right['arguments'][0].value = id
            reqbody.push(named)
        })

        // nameless requires, "require("...")"
        this.nameless.forEach(function(id){
            var nameless = util.clone(namelessAST.body[0])
            nameless.expression['arguments'][0].value = id
            reqbody.push(nameless)
        })

        var code = escodegen.generate(wrapper)
        callback(null, code)

        this.emit('data', code)
        this.emit('end')
    },

    compress: function(js, map){
/*
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

        var stream = ujs.OutputStream({source_map: sm, max_line_len: 160})
        ast.print(stream)

        return {
            js: stream + "",
            map: sm + ""
        }
*/
    }


})

module.exports = function(modules, options){
    return new output(modules, options)
}
