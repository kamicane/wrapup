"use strict";

var prime  = require('prime')
var Stream = require('stream').Stream

module.exports = prime({

    inherits: Stream,

    constructor: function(wrup, options){
        Stream.call(this)
        this.readable = true
        this.paused = false

        this.modules  = wrup.modules
        this.named    = wrup.named
        this.nameless = wrup.nameless

        this.setOptions(options || {})
    },

    setOptions: function(options){
        this.options = options
        return this
    },

    // stream methods

    pause: function(){
        this.paused = true
    },

    resume: function(){
        this.paused = false
        if (this.buffer) this.emit("data", this.buffer)
    },

    setEncoding: function(){},

    destroy: function(){
        this.readable = false
        this.emit("close")
    },

    // generate output

    up: function(callback){
        callback()
    }

})
