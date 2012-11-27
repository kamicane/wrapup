"use strict";

var assert = require('assert')
var wrup   = require('../lib/main')()
var test   = require('./run').test

wrup.options({
    output: __dirname + "/output/exclude.result.js"
})

wrup.exclude('a', 'b')

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

wrup.require(__dirname + '/fixtures/exclude').up(function(err){
    assert.ifError(err)
    test('exclude')
})
