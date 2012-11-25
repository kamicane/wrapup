"use strict";

var fs     = require('fs')
var ujs    = require('uglify-js')
var assert = require('assert')
var path   = require('path')

var parseAndWrite = function(file){
    var code = fs.readFileSync(file, "utf-8")
    var ast = ujs.parse(code)
    var stream = ujs.OutputStream()
    ast.print(stream)
    return stream + ""
}

var relative = function(file){
    return path.relative(process.cwd(), file)
}

exports.test = function(test){
    var result = __dirname + '/output/' + test + '.result.js'
    var should = __dirname + '/output/' + test + '.js'
    var resultCode = parseAndWrite(result)
    var shouldCode = parseAndWrite(should)
    assert.equal(resultCode, shouldCode, relative(result) + " and " + relative(should) + " should be the same")
    console.log(("✔ " + test + " test passed").green)
}

require('./pipe')
require('./globalize')
require('./notresolved')
