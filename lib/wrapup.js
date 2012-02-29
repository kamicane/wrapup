// WrapUp class. Feel free to cherry-pick this.

// core requires

var readFileSync = require('fs').readFileSync,
	path = require('path')

// dependencies

var semver = require('semver'),
	ujs = require('uglify-js'),
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
	header = "/*\n---\npackage: @name@@version\ndescription: @description\nhomepage: @homepage\nauthor: @author\nlicense: @license\n...\n*/",
	boil = "(function(modules, versions, mains){\n" + readFileSync(ipath + 'require.js') + "\n@wrup\n@globals\n})({@modules}@tables);",
	wrup = readFileSync(ipath + 'wrup.js').toString(),
	glob = "window[@name] = require(@id);",
	mods = "'@id': function(require, module, exports, global){@src}"

// WrapUp

var WrapUp = function(){
	this.packages = {}
	this.required = []
	this.latests = {}
	this.mains = {}
}

WrapUp.prototype.resolve = function(module, from){

	var modulefull = this.findModule(module, from)
	if (!modulefull){
		console.warn("  WARNING: could not find module " + module)
		return null
	}

	var packagefull = this.findJSON(modulefull)
	if (!packagefull){
		console.warn("  WARNING: could not find package.json for " + module)
		return null
	}

	var packagepath = path.dirname(packagefull),
		mainfull = this.findModule(packagepath)
	if (!mainfull){
		console.warn("  WARNING: could not find the main for " + module)
		return null
	}
	
	var json = require(packagefull),
		ns = json.name
	
	var version = semver.clean(json.version)
	
	var moduleid = ns + "@" + version
	
	var modulepath = path.dirname(modulefull),
		modulename = path.basename(modulefull, '.js')
	
	var mainpath = path.dirname(mainfull),
		mainname = path.basename(mainfull, '.js')
	
	var relativepath = path.relative(packagepath, modulepath)
	
	var key = path.join(relativepath, modulename)
	
	var pkg = this.packages[ns] || (this.packages[ns] = {}),
		modules = pkg[version] || (pkg[version] = {})
	
	this.mains[moduleid] || (this.mains[moduleid] = path.join(moduleid, path.relative(packagepath, mainpath), mainname))
	
	if (!modules[key]){ //already scanned otherwise
		
		modules[key] = true

		var filedata = readFileSync(modulefull).toString()
		
		// performing dead-code removal before finding require calls,
		// as well as nuking comments to avoid catching useless requires and / or requires within comments.
		// at this stage, there is no mangle or or squeeze
		var ast = parser.parse(filedata)
		ast = uglify.ast_squeeze(ast, {make_seqs: false, dead_code: true})
		filedata = uglify.gen_code(ast)
		
		var self = this

		filedata = filedata.replace(/require\(\s*["']([^'"\s]+)["']\s*\)/g, function(match, dependency){
			var k = self.resolve(dependency, modulepath)
			return k ? "require('" + k + "')" : "null"
		})

		modules[key] = filedata
	}

	return path.join(moduleid, key)
}

WrapUp.prototype.require = function(module){
	id = this.resolve(module)
	if (id) this.required.push(id)
	return this
}

WrapUp.prototype.findModule = function(module, from){
	if (from == null) from = process.cwd()
	
	var relative = module.indexOf('.') === 0,
		absolute = module.indexOf('/') === 0
	
	if (relative){
		try {
			return require.resolve(path.resolve(from, module))
		} catch (err){}
		return null
	}
	if (absolute){
		try {
			return require.resolve(module)
		} catch (err){}
		return null
	}
	
	var parts = path.resolve(from).split(/\//)
	
	while (parts.length){
		try {
			return require.resolve(path.join(parts.join('/'), 'node_modules', module))
		} catch (err){}
		parts.pop()
	}

	return null
}

WrapUp.prototype.findJSON = function(module){
	var dir = path.dirname(module),
		parts = dir.split(/\//)

	while (parts.length){
		try {
			return require.resolve(path.join(parts.join('/'), 'package.json'))
		} catch (err){}
		parts.pop()
	}
	return null
}

WrapUp.prototype.up = WrapUp.prototype.toString = function(options){
	if (options == null) options = {}

	if (options.wrup == null) options.wrup = true
	if (options.globalize == null) options.globalize = false
	if (options.compress == null) options.compress = false
	
	var name, versions
	
	for (name in this.packages){
		versions = this.packages[name]
		var aversions = Object.keys(versions).sort(semver.rcompare)
		var latest = aversions[0]
		this.latests[name] = name + "@" + latest
		if (aversions.length > 1) console.warn("  WARNING: multiple versions of " + name + " are being included: " + aversions)
	}
	
	var mains = {}, mn
	for (mn in this.mains) if (this.required.indexOf(this.mains[mn]) > -1) mains[mn] = this.mains[mn]
	var rmains = {}
	for (mn in mains) rmains[mains[mn]] = mn
	
	var flat = [],
		idpackages = {},
		modmains = {}
	
	for (name in this.packages){
		versions = this.packages[name]
		for (var version in versions){
			var modules = versions[version]
			for (path in modules){
				var src = modules[path],
					id = name + "@" + version,
					m = "" + id + "/" + path
				idpackages[m] = name
				modmains[m] = mains[id]
				flat.push(replaces(mods, {id: m, src: src}))
			}
		}
	}

	var globals = []
	
	if (options.globalize){
		var globalized = {}
		
		this.required.forEach(function(r){
			var identifier = rmains[r]
			if (identifier){ //is a main
				var id = idpackages[r],
					v = identifier.split("@")[1]
				if (!globalized[id] || semver.gt(v, globalized[id])) globalized[id] = v
			} else {
				console.warn("  WARNING: cannot globalize " + r + " because it was cherry-picked")
				if (!options.wrup){
					if (modmains[r]) console.warn("  WARNING: you might not be able to access " + r + " unless it's exported by its main (" + modmains[r] + ") because wrup was not included")
					else console.warn("  WARNING: you will not be able to access " + r + " because it has no main and wrup was not included")
				}
			}
		})
		
		for (var idg in globalized){
			globals.push("window['" + camelize(idg) + "'] = require('" + this.mains[idg + "@" + globalized[idg]] + "');")
		}
	}
	
	var getwrup = options.wrup ? wrup : "",
		gettables = options.wrup ? "," + JSON.stringify(this.latests) + ',' + JSON.stringify(mains) : ""
	
	var js = replaces(boil, {modules: flat.join(','), wrup: getwrup, globals: globals.join("\n"), tables: gettables}),
		ast = parser.parse(js)

	if (options.compres){
		ast = uglify.ast_mangle(ast)
		ast = uglify.ast_squeeze(ast)
		ast = uglify.ast_lift_variables(ast)
	}
	
	return uglify.gen_code(ast, {beautify: !options.compress})
}

module.exports = WrapUp
