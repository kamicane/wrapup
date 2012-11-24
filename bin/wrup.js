#!/usr/bin/env node
"use strict";

var WrapUp = require("../lib/wrapup"),
    clint  = require("clint")(),
    colors = require("colors"),
    json   = require("../package"),
    path   = require("path")

var bool = function(value){
    if (value === 'no' || value === 'false') return false
    if (value === 'yes' || value === 'true') return true
    return value
}

clint.command('--help', '-h',
             'general usage information.')

clint.command('--version', '-v',
              'prints the version number.')

clint.command('--require', '-r',
              'requires a module with a namespace. uses node to resolve modules.' +
              ' -r namespace path/to/module'.green + ' or' + ' -r path/to/module'.green)

clint.command('--compress', '-c',
             'compresses output using uglify-js mangle and squeeze. defaults to no|false, ' +
             '-c'.green + ' or ' + '-c yes'.green + ' to enable', bool)

clint.command('--wrup', null,
             'includes the wrup client, to retrieve required namespaces with ' +
             'wrup(namespace)' + '. defaults to no|false, ' + '--wrup yes'.green + ' to enable', bool)

clint.command('--globalize', '-g',
             'defined namespaces go to global scope. defaults to yes|true, ' + '-g no'.green + ' to disable', bool)

clint.command('--output', '-o',
             'wraps up the contents of your required modules to the specified filename, instead of stdout. ' + '-o path/to/file'.green)

clint.command('--source-map', null,
             'write a sourcemap to a file' + '-m path/to/file.map'.green)

clint.command('--source-map-root', null,
             'the path to the original source to be included in the source map')

clint.command('--in-source-map', null,
             "input source map, useful if you're compressing JS that was generated from some other original code")

clint.command('--watch', '-w',
              'watches changes to every resolved module and wraps up', bool)

clint.command('--xclude', '-x')
clint.command('--digraph', '-dg', null, bool)


var help = function(err){
    // header
    console.warn(" , , , __  __.  _   . . _  ".white)
    console.warn("(_(_/_/ (_(_/|_/_)_(_/_/_)_".grey)
    console.warn("              /       /  " + json.version.white + "\n")

    console.log(clint.help(2, " : ".grey))
    process.exit(err)
}

var args = process.argv.slice(2)

if (!args.length) help(1)

 //initialize wrapup

var wrup = new WrapUp()

var pass = false

// parse require chunk

clint.on('chunk', function(name){

    if (name === "--require"){
        pass = true
        wrup.require(arguments[1], arguments[2])
    }

})

var options = {}, fileName

// parse other options

clint.on("command", function(name, value){

    switch (name){

        case "--help"            : help(0);                                      break
        case "--version"         : console.log(json.version); process.exit(0);   break
        case "--xclude"          : if (value != null) wrup.exclude(value);       break
        case "--digraph"         : options.graph = value == null ? true : value; break
        case "--globalize"       : options.globalize = value;                    break
        case "--compress"        : options.compress = true;                      break
        case "--watch"           : options.watch = value == null ? true : value; break
        case "--output"          : options.output = value || false;              break
        case "--source-map"      : options.sourcemap = value || false;           break
        case "--source-map-root" : options.sourcemapRoot = value || false;       break
        case "--in-source-map"   : options.sourcemapIn = value || false;         break

    }

})

clint.on('complete', function(){

    if (!pass) help(1)

    if (!options.output) options.watch = false

    wrup.options(options)

    wrup.on("change", function(fullpath){
        console.warn("=>".blue.inverse + " " + path.relative(process.cwd(), fullpath).grey + " was changed")
    })

    wrup.on("end", function(data){
        if (options.output){
            console.warn("DONE".green.inverse + ": the file " + options.output.grey + " has been written")
        } else {
            console.log(data)
            console.warn("DONE".green.inverse)
        }
    })

    wrup.on("warn", function(err){
        console.error(err.message.red)
    })

    var error = function(err){
        if (err) throw err
    }

    if (options.graph) wrup.graph(error)
    else if (options.watch) wrup.watch()
    else wrup.up(error)

})

clint.parse(args)
