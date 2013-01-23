"use strict";

var assert = require('assert')
var fs     = require('fs')
var wrup   = require('../lib/main')()
var test   = require('./run').test

var root = "http://localhost:8000"
var url = "http://localhost:8000/test/output/sourcemap.result.map"

wrup.options({
    output: __dirname + "/output/sourcemap.result.js",
    sourcemap: __dirname + "/output/sourcemap.result.map",
    sourcemapRoot: root,
    sourcemapURL: url
})

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

wrup.require(__dirname + '/fixtures/up').up(function(err, code){
    assert.ifError(err)

    assert.ok(code.indexOf('sourceMappingURL=' + url) != -1,
        'should have correct sourceMappingURL')

    var file = __dirname + '/output/sourcemap.result.map'
    fs.readFile(file, "utf-8", function(err, json){
        assert.ifError(err)
        var map = JSON.parse(json)
        assert.equal(map.sourceRoot, root, "sourcRoot should be present")
        assert.equal(map.sources.length, 3, "sources array should contain the original files")

        test('sourcemap')
    })
})

// To see if it actually works in a browser, run
//     python -m SimpleHTTPServer
// in the wrapup directory, then open, and checkout the sources tab
//     http://localhost:8000/test/output/sourcemap.html
