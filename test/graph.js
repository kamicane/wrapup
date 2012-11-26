"use strict";

var fs     = require('fs')
var assert = require('assert')
var colors = require('colors')
var wrup   = require('../lib/main')()
var passed = require('./run').passed

var stream = fs.createWriteStream(__dirname + '/output/graph.result.dot')

wrup.options({
    output: __dirname + '/output/graph-out.result.png'
})

wrup.pipe(stream)

wrup.on("error", function(err){
    assert.fail(err, undefined, "no errors should occur")
})

wrup.require(__dirname + '/fixtures/b').graph(function(err, actual){
    assert.ifError(err)
    var should = fs.readFileSync(__dirname + '/output/graph.dot')
    assert.equal(should, actual, "the generated dot should be equal")
    var stat = fs.statSync(__dirname + '/output/graph-out.result.png')
    assert.ok(stat.size > 0)
    passed("graph")
})


