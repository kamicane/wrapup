"use strict";

var prime = require('prime')

var WrapUpError = prime({

    inherits: Error,

    type: "generic",

    constructor: function WrapUpError(message, module, source){
        this.message = message
        if (module) this.module = module
        this.source = source || "you"
    }

})

var WrapUpNativeError = prime({

    inherits: WrapUpError,

    type: "native",

    constructor: function WrapUpNativeError(module, source){
        WrapUpError.call(this, "Native Module Required", module, source)
        this.type = "native"
    }

})

var WrapUpNamespaceError = prime({

    inherits: WrapUpError,

    type: "namespace",

    constructor: function WrapUpNamespaceError(namespace, module){
        WrapUpError.call(this, "Namespace Already in Use", module)
        this.namespace = namespace
    }

})

var WrapUpResolveError = prime({

    inherits: WrapUpError,

    type: "resolve",

    constructor: function WrapUpResolveError(module, source){
        WrapUpError.call(this, "Resolve Error", module, source)
    }

})

var WrapUpEmptyError = prime({

    inherits: WrapUpError,

    type: "empty",

    constructor: function WrapUpEmptyError(){
        WrapUpError.call(this, "No Modules Required")
    }

})

var WrapUpRequiredOutputError = prime({

    inherits: WrapUpError,

    type: "output",

    constructor: function WrapUpRequiredOutputError(){
        WrapUpError.call(this, "The output option is required")
    }

})

var WrapUpOutOfScopeError = prime({

    inherits: WrapUpError,

    type: "out-of-scope",

    constructor: function WrapUpOutOfScopeError(file){
        WrapUpError.call(this, "File is out of scope, so in a higher directory than the cwd")

        this.file = file
    }
})

var WrapUpJavaScriptError = prime({

    inherits: WrapUpError,

    type: "js",

    constructor: function WrapUpJavaScriptError(module, source, line, col){
        WrapUpError.call(this, "JavaScript Error", module, source)

        this.line = line
        this.col = col
    }

})

var WrapUpGraphvizRequireError = prime({

    inherits: WrapUpError,

    type: "graphviz",

    constructor: function WrapUpGraphvizRequireError(){
        WrapUpError.call(this, "Graphviz Require Error")
    }

})

exports.Error                = WrapUpError
exports.NativeError          = WrapUpNativeError
exports.NamespaceError       = WrapUpNamespaceError
exports.ResolveError         = WrapUpResolveError
exports.EmptyError           = WrapUpEmptyError
exports.RequiredOutputError  = WrapUpRequiredOutputError
exports.OutOfScopeError      = WrapUpOutOfScopeError
exports.JavaScriptError      = WrapUpJavaScriptError
exports.GraphvizRequireError = WrapUpGraphvizRequireError
