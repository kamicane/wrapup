"use strict";

var path    = require('path')
var fs      = require('fs')
var esprima = require('esprima')
var type    = require('prime/type')

var empty = function(object){
    for (var k in object) return false
    return true
}

var slice = Array.prototype.slice

var noop = function(){}

var throttle = function(fn){
    var timer
    return function(){
        var args = arguments
        clearTimeout(timer)
        timer = setTimeout(function(){
            fn.apply(null, args)
        }, 100)
    }
}

var relative = function(file){
    return path.relative(process.cwd(), file)
}

var inPath = function(filepath, file){
    return path.relative(filepath, file).slice(0, 2) != '..'
}

var cache = {}
var getAST = function(name){
    return function(callback){
        if (cache[name]) return callback(null, cache[name])
        fs.readFile(__dirname + '/../includes/' + name + '.js', 'utf-8', function(err, code){
            if (err) return callback(err)
            try { cache[name] = esprima.parse(code) }
            catch (e){ err = e }
            callback(err, cache[name])
        })
    }
}

var astWalker = function(ast, action){

    var walker = function(ast, parent, key){
        if (action(ast, parent, key)){
        } else if (Array.isArray(ast)){
            for (var i = 0; i < ast.length; i++) walker(ast[i], ast, i)
        } else if (typeof ast == 'object'){
            for (var j in ast) walker(ast[j], ast, j)
        }
    }

    walker(ast)
}

// thanks MooTools!
var cloneOf = function(item){
    switch (type(item)){
        case 'array'  : return cloneArray(item)
        case 'object' : return cloneObject(item)
        default       : return item
    }
}

var cloneObject = function(object){
    var clone = {}
    for (var key in object) clone[key] = cloneOf(object[key])
    return clone
}

var cloneArray = function(array){
    var i = array.length, clone = new Array(i)
    while (i--) clone[i] = cloneOf(array[i])
    return clone
}

var merge = function(object, key, value){
    if (typeof key == 'string'){
        if (type(object[key]) == 'object' && type(value[key]) == 'object'){
            merge(object[key], value)
        } else object[key] = value
    } else for (var i = 0; i < arguments.length; i++){
        var obj = arguments[i]
        for (var k in obj) merge(object, k, obj[k])
    }
    return object
}

exports.empty     = empty
exports.slice     = slice
exports.noop      = noop
exports.throttle  = throttle
exports.relative  = relative
exports.inPath    = inPath
exports.getAST    = getAST
exports.astWalker = astWalker
exports.clone     = cloneOf
exports.merge     = merge
