"use strict";

var fs     = require('fs')
var assert = require('assert')
var colors = require('colors')
var wrup   = require('../lib/main')()
var test   = require('./run').test

var stream = fs.createWriteStream(__dirname + '/output/pipe.result.js')

wrup.pipe(stream)

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

wrup.require(__dirname + '/fixtures/e').up(function(err){
    assert.ifError(err)
    test('pipe')
})
