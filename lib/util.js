"use strict";

var path    = require('path')
var fs      = require('fs')
var esprima = require('esprima')
var type    = require('prime/util/type')

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

exports.empty    = empty
exports.slice    = slice
exports.noop     = noop
exports.throttle = throttle
exports.relative = relative
exports.getAST   = getAST
exports.clone    = cloneOf
