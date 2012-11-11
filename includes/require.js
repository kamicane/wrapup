var cache = {}, require = function(id){
    var module = cache[id]
    if (!module){
        module = cache[id] = {}
        var exports = module.exports = {}
        modules[id].call(exports, require, module, exports, global)
    }
    return module.exports
}
