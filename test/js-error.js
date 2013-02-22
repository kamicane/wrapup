"use strict";

var assert = require('assert')
var wrapup = require('../lib/main')
var pass   = require('./run').passed
var errors = require('../lib/errors')

var jsError

var wrup = wrapup()

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

wrup.on("warn", function(err){
    jsError = err
})

wrup.require(__dirname + '/fixtures/js-error').up(function(err, js){
    assert(jsError && jsError instanceof errors.JavaScriptError)
    pass('js-error')
})
