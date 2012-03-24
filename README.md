![wrapup](http://github.com/kamicane/wrapup/raw/master/assets/wrapup.png)

## WrapUp?

 * WrapUp compiles CommonJS 1.0 modules for the browser.
 * Wrapup does not try to have a working `require` implementation for the browser, infact the loader WrapUp uses is [incredibly simple](https://github.com/kamicane/wrapup/blob/master/includes/require.js).
 * WrapUp ignores duplicates that may be present when using npm to install packages.
 * Wrapup supports building multiple versions of the same package.
 * Wrapup supports circular module dependencies.

## Installation

WrapUp is installed via npm:

```
npm install wrapup -g
```

After that, you will have access to `wrup` in your cli.

```
wrup --help
```

You can also install locally:

```
npm install wrapup
```

And require WrapUp in your node javascripts:

```javascript
var wrup = require("wrapup")
```

## Usage

In a nutshell, you tell WrapUp you require `something`, it calculates dependencies for `something` using static analysis, and compiles a single javascript file that only exposes that `something` you required. `require` paths inside modules are replaced with unique identifiers for brevity, and you will only be able to access directly that `something` you required, never dependencies (unless specifically required).

### require()

The main WrapUp method is `require(namespace, module)`.

It resolves a module using node's own modules and packages logic, so for instance, `wrup.require("colors")` would look in your `node_modules` folder for a package named colors, then proceed to load its `main`. The namespace parameter is optional, but it's used to expose the module to the browser. Without a namespace, the module will be required immediately without further action. Exactly like doing `var x = require(y)` vs `require(y)`.

#### cli

```
wrup --require colors colors --require someName ./path/to/otherModule --require someOtherPackage
```

#### js

```javascript
var wrup = require("wrapup")() // require + instantiate

wrup.require("colors", "colors").require("someName", "./path/to/otherModule").require("someOtherPackage").up(/*...options...*/) //returns a string
```

the above would let you access colors and someName, while having someOtherPackage simply required without being assigned to any variable.

### Options

 - `globalize` if set to true, will attach namespaces to the `window` object. Defaults to true.
 - `compress` if set to true, will compress the resulting javascript file using uglify-js. Defaults to false.
 - `wrup` if set to true, will attach the wrup method to the window object, allowing you to sort-of-require _the specified namespaces_ at any given time. This is especially useful since modules are only executed when first required, and sometimes might be a good idea to execute a module only when the dom is fully loaded, for instance, or conditionally. Defaults to false.

#### cli

```
wrup --require ... --globalize yes --wrup no --compress yes
```

#### js

```javascript
wrup.require(/*...*/).up({globalize: true, wrup: false, compress: true})
```

### Examples

coming soon... :)
