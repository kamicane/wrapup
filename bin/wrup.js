#!/usr/bin/env node

var wrup = require("../lib/main")(),
	clint = require("clint")(),
	fs = require("fs"),
	json = require("../package")

// consolize wrup errors

wrup.on("error:js", function(module, from, err){
	console.error("  ERROR: the module %s required by %s had a javascript error: %j", module, from || 'you', err)
})

wrup.on("error:resolve", function(module, from){
	console.error("  ERROR: the module %s required by %s could not be resolved", module, from || 'you')
})

wrup.on("error:native", function(module, from){
	console.error("  ERROR: the module %s required by %s is a native require", module, from || 'you')
})

wrup.on("error:package", function(pkg){
	console.error("  ERROR: the package %s could not be resolved", pkg)
})

wrup.on("error:namespace", function(namespace){
	console.error("  ERROR: the namespace %s was already in use", namespace)
})

wrup.on("warning:access", function(){
	console.error("  WARNING: both --globalize and --wrup are turned off, you might not be able to access the required modules")
})

wrup.on("error:empty", function(){
	console.error("  ERROR: no modules required")
})

wrup.on("error:internal", function(err){
	console.error("  ERROR: kami, fix WrapUp because it doesnt work: %j", err)
})

// header

console.warn("   , , , __  __.  _   . . _  ")
console.warn("  (_(_/_/ (_(_/|_/_)_(_/_/_)_")
console.warn("                /       /  " + json.version + "\n")

var specify = function(value){
	if (value === 'no' || value === 'false') return false
	return true
}

clint.command('--help', '-h',
             'general usage information.')

clint.command('--version',
             '-v', 'prints the version number.')

clint.command('--module', '-m',
             'one module to require, accepts one path or one path and one namespace. `-m path/to/x` or `-m path/to/x y`')

clint.command('--package', '-p',
             'valid package / packages to require, accepts multiple paths.' +
             ' `-p` for cwd(), or `-p path/to/package` or `-p p/t/package1 p/t/package2 ...`')

clint.command('--compress', '-c',
             'compresses output using uglify-js mangle and squeeze. defaults to no|false, `-c` or `-c yes` to enable.', specify)

clint.command('--wrup', '-w',
             'includes the wrup client, to retrieve required namespaces with `wrup(namespace)`. defaults to no|false, `-w yes` to enable.', specify)

clint.command('--globalize', '-g',
             'defined namespaces go to global scope. defaults to yes|true, `-g no` to disable.', specify)

clint.command('--output', '-o',
             'wraps up the contents of your required modules to the specified filename, instead of stdout. `-o path/to/file`')

var help = function(err){
	console.log(clint.help())
	process.exit(err)
}

var args = process.argv.slice(2)

if (!args.length) help(1)

clint.on('command(--help)', function(){
	help(0)
})

clint.on('command(--version)', function(){
	console.log("\n  " + json.version + "\n")
	process.exit(0)
})

var pass = false

clint.on('chunk(--module)', function(module, namespace){
	pass = true
	wrup.module(module, namespace)
})

clint.on('command(--package)', function(required){
	pass = true
	wrup.package(required)
})

var options = {}

clint.on('command(--wrup)', function(result){
	options.wrup = result;
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

	var result


	result = wrup.up(options)

	if (result){

		if (fileName){
			fs.writeFileSync(fileName, result)
			console.warn("  DONE: the file " + fileName + " has been written.\n")
		} else {
			console.log(result)
			console.warn("\n  DONE.\n")
		}

		process.exit(0)

	} else {
		console.error("")
		process.exit(1)
	}

})

clint.parse(args)
