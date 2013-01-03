"use strict";

var assert = require('assert')
var fs     = require('fs')
var wrapup = require('../lib/main')
var test   = require('./run')

var wrup = wrapup()

wrup.options({
    output: __dirname + "/output/compress.result.js",
    compress: true
})

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

wrup.require(__dirname + "/fixtures/up").up(function(err){
    assert.ifError(err)

    fs.stat(__dirname + "/output/compress.result.js", function(err, stat){
        assert.ifError(err)
        assert.ok(stat.size < 600) // up.result.js is ~900 bytes
        assert.ok(stat.size > 100)
        test.passed('compress')
    })

})
