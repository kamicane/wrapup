#!/usr/bin/env node

var WrapUp = require("../lib/wrapup"),
    clint = require("clint")(),
    fs = require("fs"),
    colors = require("colors"),
    json = require("../package")

var specify = function(value){
    if (value === 'no' || value === 'false') return false
    if (value === 'yes' || value === 'true') return true
    return value
}

clint.command('--help', '-h',
             'general usage information.')

clint.command('--version',
             '-v', 'prints the version number.')

// clint.command('--module', '-m',
//              'one module to require, accepts one path or one path and one namespace. ' + '-m path/to/x'.green + ' or ' + '-m path/to/x y'.green)
//
// clint.command('--package', '-p',
//              'valid package / packages to require, accepts multiple paths.' +
//              ' ' + '-p'.green + ' for cwd(), or ' + '-p path/to/package'.green + ' or ' + '-p p/t/package1 p/t/package2'.green + ' ...')


clint.command('--require', '-r', 'requires a module with a namespace. uses node to resolve modules.' +
              ' -r namespace path/to/module'.green + ' or' + ' -r path/to/module'.green)

clint.command('--compress', '-c',
             'compresses output using uglify-js mangle and squeeze. defaults to no|false, ' + '-c'.green + ' or ' + '-c yes'.green + ' to enable', specify)

clint.command('--wrup', '-w',
             'includes the wrup client, to retrieve required namespaces with ' + 'wrup(namespace)' + '. defaults to no|false, ' + '-w yes'.green + ' to enable', specify)

clint.command('--globalize', '-g',
             'defined namespaces go to global scope. defaults to yes|true, ' + '-g no'.green + ' to disable', specify)

clint.command('--output', '-o',
             'wraps up the contents of your required modules to the specified filename, instead of stdout. ' + '-o path/to/file'.green)

clint.command('--xclude', '-x')


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

clint.on('command(--help)', function(){
    help(0)
})

clint.on('command(--version)', function(){
    console.log(json.version)
    process.exit(0)
})

 //initialize wrapup
var wrup = new WrapUp()
// consolize wrup errors
wrup.log("ERROR".red.inverse + ": ")

var pass = false

clint.on('chunk(--require)', function(namespace, module){
    pass = true
    wrup.require(namespace, module)
})

clint.on('command(--xclude)', function(x){ wrup.exclude(x) })

var options = {}

clint.on('command(--wrup)', function(result){
    options.wrup = result == null ? true : result;
})

clint.on('command(--globalize)', function(result){
    options.globalize = result;
})

clint.on('command(--compress)', function(result){
    options.compress = result;
})

var fileName;

clint.on('command(--output)', function(fn){
    fileName = fn
})

clint.on('complete', function(){

    if (!pass) help(1)

    //build result
    var result = wrup.up(options)

    if (result){

        if (fileName){
            fs.writeFileSync(fileName, result)
            console.warn("DONE".green.inverse + ": the file " + fileName.grey + " has been written")
        } else {
            console.log(result)
            console.warn("DONE".green.inverse)
        }

        process.exit(0)

    } else {
        process.exit(1)
    }

})

clint.parse(args)
