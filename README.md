![wrapup](http://github.com/kamicane/wrapup/raw/master/assets/wrapup.png)

## whatwrup?

WrapUp compiles CommonJS 1.0 modules and / or packages for the browser.
It does not try to have a working require implementation for the browser or anything for the sorts. The boilerplate that WrapUp uses is [incredibly simple](https://github.com/kamicane/wrapup/blob/master/includes/require.js).

## installation

```
npm install wrapup -g
```

## usage

### packages

This is how you wrap up the package in the current folder (will look for ./package.json)

```
wrup --package
```

```
wrup --package ./
```

When requiring a package, node looks inside the node_modules folders. If you have installed moofx in the current directory with `npm install moofx`, for instance, this will work:

```
wrup --package moofx
```

If you also installed emi, this will also work:

```
wrup --package moofx emi
```

But this doesn't mean you cant require a package that is installed somewhere else:

```
wrup --package ~/projects/moofx
```

### modules

This is how you wrapup a random module. window.color (if --globalize is true) will be created, with the namespace retrieved from the file name.

```
wrup --module ~/projects/moofx/lib/color.js
```

Like packages, modules are resolved automatically by node, so you can cherry-pick easily:

```
wrup --module moofx/lib/color
```

You can also assign a custom namespace, especially useful when requiring modules that are indices or mains:

```
wrup --module ~/projects/moofx/lib/main.js moofx
```

...which is equivalent of

```
wrup --package ~/projects/moofx
```

Except the namespace is given by you, rather than read from `package.json`

### packages + modules

Packages and modules can be mixed:

```
wrup --package ./ ~/projects/emi --module ~/projects/moofx/lib/color.js
```

### on the browser

Once built, namespaces will be available on window if you wish so (--globalize defaults to true):

```
wrup --package moofx --module ... --module ... --globalize yes
```

```javascript
moofx(div).animate(...)
```

If you prefer, namespaces will be retrievable using the wrup client (--wrup defaults to false):

```
wrup --package moofx --wrup yes --globalize no
```

```javascript
wrup('moofx')(div).animate(...)
```

This is especially useful since modules are only executed when first required. Attaching them to window also means they are immediately required. Using the wrup client might (or might not) save some resources in some situations.

moar help:

```
wrup --help
```
