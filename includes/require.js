var cache = {}, require = function(id){
	var module;
	if (module = cache[id]) return module.exports;
	module = cache[id] = {exports: {}};
	modules[id](module, require, window, module.exports);
	return module.exports;
};
