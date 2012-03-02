var cache = {}, require = function(id){
	if (id == null) return null
	var module
	if (module = cache[id]) return module.exports
	module = cache[id] = {exports: {}}
	var exports = module.exports
	modules[id].call(exports, require, module, exports, window)
	return module.exports
}
