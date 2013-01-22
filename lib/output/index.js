"use strict";

var prime = require('prime')

module.exports = prime({

    constructor: function(wrup, options){
        this.wrup     = wrup
        this.modules  = wrup.modules
        this.named    = wrup.named
        this.nameless = wrup.nameless
        this._options = wrup._options
    },

    // generate output

    up: function(callback){
        callback()
    }

})
