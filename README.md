![wrapup](http://github.com/kamicane/wrapup/raw/master/assets/wrapup.png)

## whatwrup?

WrapUp compiles CommonJS 1.0 modules and / or packages for the browser.
It does not try to have a working require implementation for the browser or anything for the sorts. The boilerplate that WrapUp uses is [incredibly simple](https://github.com/kamicane/wrapup/blob/master/includes/require.js).

## installation

```
npm install wrapup -g
```

## usage

wraps up the current folder (will look for ./package.json)

```
wrup --package
```

add a random module

```
wrup --package --module moofx ~/projects/moofx/lib/index.js
```

and another package

```
wrup --package --module moofx ~/projects/moofx/lib/index.js --package ~/projects/emi
```

packages will be automatically resolved to modules by node, if you wish to assign a custom namespace

```
wrup --module moofx ~/projects/moofx
```

once built, namespaces will be available on window if you wish so (--globalize defaults to true):

```
wrup --module moofx ~/projects/moofx --globalize
```

```javascript
moofx(div).animate(...)
```

or if you prefer, namespaces will be retrievable using the wrup client (--wrup defaults to false):

```
wrup --module moofx ~/projects/moofx --wrup
```

```javascript
wrup('moofx')(div).animate(...)
```

moar help:

```
wrup --help
```
