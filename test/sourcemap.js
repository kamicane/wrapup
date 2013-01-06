"use strict";

var assert = require('assert')
var fs     = require('fs')
var wrup   = require('../lib/main')()
var test   = require('./run').test

wrup.options({
    output: __dirname + "/output/sourcemap.result.js",
    sourcemap: __dirname + "/output/sourcemap.result.map",
    sourcemapRoot: "http://localhost:8000",
    sourcemapURL: "http://localhost:8000/test/output/sourcemap.result.map"
})

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

wrup.require(__dirname + '/fixtures/e').up(function(err, code){
    assert.ifError(err)
    var stat = fs.statSync(__dirname + '/output/sourcemap.result.map')
    assert.ok(stat.size > 0)
    assert.ok(code.indexOf('sourceMappingURL=http://localhost:8000/test/output/sourcemap.result.map') != -1,
        'should have correct sourceMappingURL')
    test('sourcemap')
})

// To see if it actually works in a browser, run
//     python -m SimpleHTTPServer
// in the wrapup directory, then open, and checkout the sources tab
//     http://localhost:8000/test/output/sourcemap.html
