// WrapUp base class. Feel free to cherry-pick this if needed.

// core requires

var readFileSync = require('fs').readFileSync,
	path = require('path')

//@* i love sebmarkbage
var Module = require('module')

// dependencies

var ujs = require('uglify-js'),
	parser = ujs.parser,
	uglify = ujs.uglify

// util

var replaces = function(str, obj){
	for (var key in obj) str = str.replace(new RegExp("@" + key, "g"), obj[key])
	return str
}, camelize = function(self){
	return (self + '').replace(/-\D/g, function(match){
		return match.charAt(1).toUpperCase()
	})
}

// templates

var ipath = path.join(__dirname, '../includes/'),
	boil = "(function(modules){\n"+ readFileSync(ipath + 'require.js', "utf-8") + "\n@wrup\n@globals\n})({@modules})",
	wrup = "window.wrup = function wrup(id){return (id = table[id]) ? require(id) : null}",
	glob = "window.@name = require('@id')",
	mods = "'@id': function(require, module, exports, global){@src}"

// WrapUp

var WrapUp = function(){
	this.packages = {}
	this.modules = {}
	this.required = {}
	this.mains = {}

	this.index = 0
}

WrapUp.prototype.resolve = function(what, from){

	var modulefull = this.find(what, from)
	if (!modulefull){
		console.warn("  WARNING: could not find module " + what + " required by " + (from || "you"))
		return null
	}

	if (modulefull.indexOf('/') !== 0){
		console.warn("  WARNING: native require in " + modulefull + " required by " + (from || "you"))
		return null
	}

	var module = this.modules[modulefull]

	if (module) return module.uid

	var src = readFileSync(modulefull, "utf-8").toString()

	// same version check for poor people
	// could break complex requires
	// for (var p in this.modules){
	// 	var d = this.modules[p]
	// 	if (d.src === src) return d.uid
	// }

	module = this.modules[modulefull] = {
		uid: (this.index++).toString(36)
	}

	var modulepath = path.dirname(modulefull),
		modulename = path.basename(modulefull, '.js')

	// performing dead-code removal before finding require calls,
	// as well as nuking comments to avoid catching useless requires and / or requires within comments.
	try {
		var ast = parser.parse(src)
		ast = uglify.ast_squeeze(ast, {make_seqs: false, dead_code: true})
		src = uglify.gen_code(ast)
	} catch (err){
		console.error("  ERROR: javascript error in module " + modulefull + " required by " + (from || "you"))
		return null
	}

	var self = this

	module.src = src.replace(/require\(\s*["']([^'"\s]+)["']\s*\)/g, function(match, dependency){
		var k = self.resolve(dependency, modulefull)
		return k ? "require('" + k + "')" : "null"
	})

	return module.uid
}

WrapUp.prototype.package = function(pkg){
	var name, main, json, pkgpath
		resolved = path.resolve(pkg),
		basename = path.basename(resolved, '.json')

	// if it is a package.json file, try to find it
	// else append package.json and prey
	var jsonpath = (basename === "package") ? this.find(resolved) : this.find(path.join(resolved, "package.json"))

	if (jsonpath){
		pkgpath = path.dirname(jsonpath)
		json = require(jsonpath)// just require the json
		name = json.name
		main = this.find(pkgpath)
		return this.module(name, main)
	}

	console.warn(" WARNING: package.json not found in " + pkg)

	return this
}

WrapUp.prototype.module = function(namespace, module){
	var id = null
	if (!this.required[namespace]){
		id = this.resolve(module)
		if (id) this.required[namespace] = id
	} else {
		console.warn("  WARNING: Namespace " + namespace + " is already in use. Could not resolve " + module)
	}
	return this
}

WrapUp.prototype.find = function(module, from){ //resolve module from cwd or relative to another module.
	from = (from == null) ? path.join(process.cwd(), 'wrup') : path.resolve(from)
	var m = new Module(from)
	m.filename = from
	m.paths = Module._nodeModulePaths(path.dirname(from))
	try {
		return Module._resolveFilename(module, m)
	} catch (err){}
	return null
}

WrapUp.prototype.up = WrapUp.prototype.toString = function(options){
	if (options == null) options = {}

	if (options.wrup == null) options.wrup = false
	if (options.globalize == null) options.globalize = true
	if (options.compress == null) options.compress = false

	var flat = [],
		globals = [],
		table = {}

	for (var fullpath in this.modules){
		var mod = this.modules[fullpath]
		flat.push(replaces(mods, {id: mod.uid, src: mod.src}))
	}

	if (flat.length === 0){
		console.error("  ERROR: empty module list")
		return ""
	}

	if (!options.wrup && !options.globalize){
		console.error("  ERROR: both wrup and globalize are turned off, you cannot access modules")
		return ""
	}

	for (var ns in this.required){
		globals.push(replaces(glob, {id: this.required[ns], name: camelize(ns)}))
		table[ns] = this.required[ns]
	}

	var js = replaces(boil, {
			modules: flat.join(','),
			globals: options.globalize ? globals.join('\n') : "",
			wrup: (options.wrup) ? ", table = " + JSON.stringify(table) + "\n" + wrup : ""
		});


	try {
		var ast = parser.parse(js)
		if (options.compress){
			ast = uglify.ast_mangle(ast)
			ast = uglify.ast_squeeze(ast)
			ast = uglify.ast_lift_variables(ast)
		}
		return uglify.gen_code(ast, {beautify: !options.compress})
	} catch(err){
		console.error("  ERROR: problem parsing javascript source: " + err)
	}

	return ""

}

module.exports = WrapUp
