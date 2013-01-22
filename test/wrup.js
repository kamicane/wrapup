"use strict";

var exec   = require('child_process').exec
var assert = require('assert')
var prime  = require('prime')
var async  = require('async')
var passed = require('./run').passed

var shouldExitWith = function(code){
    return function(callback, command){
        return function(err, stdout, stderr){
            assert.equal(err && err.code || 0, code,
                '"' + command + '" should exit with "' + code + '"')
            callback()
        }
    }
}

var commands = {
    // no modules required
    '-r ./test/fixtures/up': shouldExitWith(0),
    '-r ./test/fixtures/not-existing': shouldExitWith(1),
    // requires --output option
    '-r ./test/fixtures/up --amd --output __amd': shouldExitWith(0),
    '-r ./test/fixtures/up --amd': shouldExitWith(1)
}

var tasks = []

prime.each(commands, function(test, command){
    tasks.push(function(callback){
        exec('./bin/wrup.js ' + command, {cwd: __dirname + '/../'}, test(callback, command))
    })
})

async.parallel(tasks, function(){
    passed('wrup command line')
})
