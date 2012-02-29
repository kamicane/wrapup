window.wrup = function(id){
	var path = id.replace(/^\/|\/$/g, "").split("/"), module;
	if (id = versions[path[0]]){
		id = (path = path.slice(1)).length ? id + '/' + path.join('/') : mains[id];
		if ((module = modules[id]) || (module = modules[id = id + '/index'])) return require(id);
	}
	return null;
};