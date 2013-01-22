"use strict";

var path = require('path')
var prime = require('prime')
var WrapUpGraphvizRequireError = require('../errors').GraphvizRequireError
var relative = require('../util').relative

var output = prime({

    inherits: require('./'),

    relativeModules: function(){
        var modules = {}
        for (var fullpath in this.modules){
            var mod = this.modules[fullpath]
            if (mod.err) return
            modules[relative(fullpath)] = mod.deps.filter(function(dep){
                return !!dep
            }).map(function(dep){
                for (var fullpath in this.modules){
                    if (this.modules[fullpath].uid === dep) return relative(fullpath)
                }
            }, this)
        }
        return modules
    },


    up: function(callback){

        var graphviz, options = this._options
        var modules = this.relativeModules()

        try {
            graphviz = require('graphviz')
        } catch (err){
            return callback(new WrapUpGraphvizRequireError())
        }

        var graph = graphviz.digraph("G")

        for (var x in modules){
            graph.addNode(x)
            var deps = modules[x]
            deps.forEach(function(dep){
                graph.addEdge(x, dep)
            })
        }

        var dot = graph.to_dot()

        if (options.output){
            // TODO node-graphviz output gives some troubles with its "dot"
            // child process, probably to just use UNIX pipes for now:
            // wrup -r ... --digraph | dot -Tpng -o test.png
            var ext = path.extname(options.output)
            graph.output(ext.slice(1), options.output)
            this.wrup.emit("output", options.output)
        }

        callback(null, dot)

        return this
    }
})

module.exports = function(modules, callback){
    new output(modules).up(callback)
}
