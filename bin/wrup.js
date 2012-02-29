#!/usr/bin/env node

var wrup = require("../lib/main")(),
	clio = require("../lib/clio")(),
	fs = require("fs"),
	json = require("../package")

console.warn("   , , , __  __.  _   . . _  ")
console.warn("  (_(_/_/ (_(_/|_/_)_(_/_/_)_")
console.warn("                /       /  " + json.version + "\n")

var bool = function(value){
	if (value == 'no' || value == 'false') return false
	return true
}

var parsed =

	clio.option('--help', '-h', 'general usage information.', function(){
		return true
	})
	.option('--version', '-v', 'prints the version number.', function(){
		return true
	})
	.option('--require', '-r', 'the list of paths and|or files that you require. defaults to cwd.', function(){
		return arguments.length ? Array.prototype.slice.call(arguments) : [process.cwd()]
	})
	.option('--compress', '-c', 'compresses output using uglify-js mangle and squeeze. defaults to no|false.', bool)
	.option('--wrup', '-w', 'includes the wrapup client, a 3-lines require-like implementation to dynamically require anything included. defaults to yes|true.', bool)
	.option('--globalize', '-g', 'sets the mains of the modules you specifically required to the global scope. defaults to no|false.', bool)
	.option('--output', '-o', 'wraps up the contents of your modules to the specified file, instead of stdout.', function(dir){
		return dir
	})

	.parse(process.argv.slice(2))


if (!parsed || parsed.help){
	console.log(clio.help())
	process.exit()
}

if (parsed.version){
	console.log("\n  " + json.version + "\n")
	process.exit()
}

if (parsed.require){
	
	parsed.require.forEach(function(require){
		wrup.require(require)
	})
	
	var result
	var opts = {}
	
	try {
		result = wrup.up({globalize: parsed.globalize, compress: parsed.compress, wrup: parsed.wrup})
	} catch(err){
		console.warn("\n  there was a problem parsing your javascripts. " + err + "\n")
		process.exit(1)
	}

	if (parsed.output){
		fs.writeFileSync(parsed.output, result)
		console.warn("  the file " + parsed.output + " has been written.\n")
	} else {
		console.warn("\n  ######################################################################################\n")
		console.log(result)
		console.warn("\n  ######################################################################################\n")
		console.warn("  enjoy.\n")
	}

}

