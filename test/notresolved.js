"use strict";

var assert = require('assert')
var wrup   = require('../lib/main')()
var test   = require('./run').test

wrup.options({
    output: __dirname + '/output/notresolved.result.js'
})

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

var warnings = 0
wrup.on("warn", function(){
    warnings++
})

wrup.require(__dirname + '/fixtures/a').up(function(err){
    assert.ifError(err)
    assert.equal(2, warnings, "there are " + warnings + ", but should be 2")
    test('notresolved')
})
