#!/usr/bin/env node

var wrup = require("../lib/main")(),
	clint = require("clint")(),
	fs = require("fs"),
	json = require("../package")

console.warn("   , , , __  __.  _   . . _  ")
console.warn("  (_(_/_/ (_(_/|_/_)_(_/_/_)_")
console.warn("                /       /  " + json.version + "\n")

var specify = function(value){
	if (value === 'no' || value === 'false') return false
	return true
}

clint.option('--help', '-h',
             'general usage information.')

clint.option('--version',
             '-v', 'prints the version number.')

clint.option('--module', '-m',
             'a manually named module to require <name /path/to/module> or <name package>')

clint.option('--package', '-p',
             'a valid package to require </path/to> or </path/to/package.json> or <package>')

clint.option('--compress', '-c',
             'compresses output using uglify-js mangle and squeeze. defaults to no|false.', specify)

clint.option('--wrup', '-w',
             'includes the wrup client, to retrieve named modules as wrup(name).', specify)

clint.option('--globalize', '-g',
             'sets the mains of the modules you specifically required to the global scope. defaults to no|false.', specify)

clint.option('--output', '-o',
             'wraps up the contents of your modules to the specified file, instead of stdout.')

var help = function(err){
	console.log(clint.help())
	process.exit(err)
}

var args = process.argv.slice(2)

if (!args.length) help(1)

clint.on('--help', function(){
	help(0)
})

clint.on('--version', function(){
	console.log("\n  " + json.version + "\n")
	process.exit(0)
})

var modname, pass = false

clint.on('--module', function(required){
	if (!modname){
		modname = required
	} else {
		pass = true
		wrup.module(modname, required)
		modname = null
	}
})

clint.on('--package', function(required){
	pass = true
	wrup.package(required)
})

var options = {}

clint.on('--wrup', function(result){
	options.wrup = result;
})

clint.on('--globalize', function(result){
	options.globalize = result;
})

clint.on('--compress', function(result){
	options.compress = result;
})

var fileName;

clint.on('--output', function(fn){
	fileName = fn
})

clint.on('complete', function(){

	if (!pass) help(1)

	var result


	result = wrup.up(options)

	if (result){

		if (fileName){
			fs.writeFileSync(fileName, result)
			console.warn("  the file " + fileName + " has been written.\n")
		} else {
			console.warn("")
			console.log(result)
			console.warn("")
		}

		process.exit(0)

	} else {
		console.error("")
		process.exit(1)
	}

})

clint.parse(args)
