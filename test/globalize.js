"use strict";

var fs     = require('fs')
var assert = require('assert')
var colors = require('colors')
var wrup   = require('../lib/main')()
var test   = require('./run').test

wrup.options({
    output: __dirname + '/output/globalize.result.js',
    globalize: "this"
})

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

wrup.require("testing", __dirname + '/fixtures/e').up(function(err){
    assert.ifError(err)
    test('globalize')
})
