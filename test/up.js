"use strict";

var fs     = require('fs')
var assert = require('assert')
var colors = require('colors')
var wrup   = require('../lib/main')()
var test   = require('./run').test

wrup.options({
    output: __dirname + "/output/up.result.js"
})

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

wrup.require(__dirname + '/fixtures/up').up(function(err){
    assert.ifError(err)
    test('up')
})
