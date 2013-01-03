"use strict";

var prime = require('prime')

var output = prime({

    inherits: require('./'),

    up: function(callback){
        callback(null, "console.log('hi')")
    }

})

module.exports = function(modules, options){
    return new output(modules, options)
}
