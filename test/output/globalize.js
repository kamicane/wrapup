(function(modules) {
    var cache = {}, require = function(id) {
        var module = cache[id];
        if (!module) {
            module = cache[id] = {};
            var exports = module.exports = {};
            modules[id].call(exports, require, module, exports, window);
        }
        return module.exports;
    };
    this["testing"] = require("0");
})({
    "0": function(require, module, exports, global) {
        module.exports = "e";
    }
});
