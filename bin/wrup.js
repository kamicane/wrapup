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

var handleErr = function(err){

    var title = err.message, message, dmessage

    switch (err.type){
        case "graphviz": break

        case "js":
            dmessage = "on " + err.module.yellow +
                " required by " + err.source.yellow +
                " at line " + err.line + ", column " + err.col
            message = err.module + " on line " + err.line + ", column " + err.col
            break

        case "resolve":
            dmessage = "on module " + err.module.yellow + " required by " + err.source.yellow
            message  = err.module + " < " + err.source
            break

        case "empty": break

        case "namespace":
            dmessage = err.namespace.yellow + " already in use by " + err.module.yellow
            message = err.namespace + " in use by " + err.module
            break

        case "native":
            dmessage = "on module " + err.module.yellow + " required by " + err.source.yellow
            message = "on module " + err.module + " required by " + err.source
            break

        case "not-in-path":
            dmessage = "on module " + err.module.yellow + " required by " +
                err.source.yellow + ". File should be in " + err.path.yellow
            message = "on module " + err.module + " required by " +
                err.source + ". File should be in " + err.path
            break

        case "out-of-scope":
            dmessage = "on file " + err.file.yellow
            message = "on file " + err.file
            break

    }

    console.error(title.red.inverse + (dmessage ? ": " + dmessage : ""))

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

clint.command('--globalize', '-g',
             'define the global scope where named modules are attached to. ' +
             'Defaults to using global var statements. ' +
             '-g MyNameSpace'.green)

clint.command('--output', '-o',
             'wraps up the contents of your required modules to the specified filename, instead of stdout. ' + '-o path/to/file'.green)

clint.command('--in-path', null,
             'Enforce that all required modules are in this specified path' + '--in-path path/to/modules'.green)

clint.command('--watch', '-w',
              'watches changes to every resolved module and wraps up', bool)

clint.command('--source-map', null,
             'write a sourcemap to a file ' + '--source-map path/to/file.map'.green)

clint.command('--source-map-root', null,
             'the path to the original source to be included in the source map ' +
             '--source-map-root http://localhost/src'.green)

clint.command('--source-map-url', null,
             'relative or absolute URL to find the source map file ' +
             '--source-map-url http://localhost/js/wrup.map'.green)

clint.command('--xclude', '-x')
clint.command('--digraph', '-dg', null, bool)

clint.command('--amd', null,
              "Convert CommonJS modules to AMD modules. The --output option is used " +
              "as output directory and is required.", bool)

clint.command('--ast', null,
              "Output AST JSON structure, so it can be used by other tools, " +
              "like uglifyjs2 with " + "--spidermonkey".green, bool)

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

        case "--help"            : help(0);                                              break
        case "--version"         : console.log(json.version); process.exit(0);   break
        case "--digraph"         : options.graph = value == null ? true : value; break
        case "--amd"             : options.amd = value == null ? true : value;   break
        case "--globalize"       : options.globalize = value;                    break
        case "--compress"        : options.compress = true;                      break
        case "--output"          : options.output = value || false;              break
        case "--in-path"         :
            options.inPath = path.resolve(process.cwd(), value) || false
            break
        case "--watch"           : options.watch = value == null ? true : value; break
        case "--source-map"      : options.sourcemap = value || false;           break
        case "--source-map-url"  : options.sourcemapURL = value || false;        break
        case "--source-map-root" : options.sourcemapRoot = value || false;       break
        case "--ast"             : options.ast = value == null ? true : value;   break

    }

})

clint.on('complete', function(){

    if (!pass) help(1)

    if (!options.output){
        options.watch = false
    }

    wrup.options(options)

    wrup.on("change", function(fullpath){
        console.warn("=>".blue.inverse + " " + path.relative(process.cwd(), fullpath).grey + " was changed")
    })

    wrup.on("data", function(chunk){
        if (!options.output) console.log(chunk)
    })

    wrup.on("output", function(file){
        console.warn("The file " + file.grey + " has been written")
    })

    var exit = 0

    wrup.on("end", function(){
        console.warn("DONE".green.inverse)
        if (exit) process.exit(exit)
    })

    wrup.on("warn", handleErr)
    wrup.on("error", function(err){
        handleErr(err)
        exit = 1
    })

    var method
    if (options.graph) method = 'graph'
    else if (options.amd) method = 'amd'
    else method = 'browser'

    if (options.watch) wrup.watch(method)
    else wrup[method]()

})

clint.parse(args)
