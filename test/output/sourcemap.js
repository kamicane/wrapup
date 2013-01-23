(function (modules) {
    var cache = {}, require = function (id) {
            var module = cache[id];
            if (!module) {
                module = cache[id] = {};
                var exports = module.exports = {};
                modules[id].call(exports, require, module, exports, window);
            }
            return module.exports;
        };
    require('0');
}({
    '0': function (require, module, exports, global) {
        require('1');
        var a = require('2').name;
        var b = new (require('2'))();
        var c = new require('2');
        var d = { a: require('2') };
        var e = require('1') + require('1');
        module.exports = require('2')();
    },
    '1': function (require, module, exports, global) {
        module.exports = 'e';
    },
    '2': function (require, module, exports, global) {
        module.exports = function () {
            console.log('up1');
        };
    }
}));
