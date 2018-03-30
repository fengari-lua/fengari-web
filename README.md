# fengari-web

Provides anything you need to run [Fengari](https://github.com/fengari-lua/fengari) in the browser.

## Building

```bash
git clone https://github.com/fengari-lua/fengari-web.git
npm install
npm run build
```

The built file can then be found in the `dist` directory.


## Getting started

Load fengari-web in your web page:

```html
<script src="dist/fengari-web.js" type="text/javascript"></script>
```

Now any script of type `application/lua` will be run by fengari:

```html
<script type="application/lua">
print("hello world !")
</script>

<script src="/my-script.lua" type="application/lua" async></script>
```

Note that if you use a `src` tag, it is strongly recommended for it to be [`async`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-async).


## Compatability

fengari-web should work in all modern browsers.

Verified to work in:

  - Chrome >= 38
  - Firefox >= 19
  - Safari >= 8
  - Microsoft IE 11
  - Microsoft Edge


## API

As well as running `<script type="application/lua">` tags, fengari-web creates a `fengari` global that contains the [core `fengari` API](https://github.com/fengari-lua/fengari#the-js-api) supplemented with:

  - `L`: the main `lua_State` (in which script tags are run)
  - `interop`: containing the [fengari-interop](https://github.com/fengari-lua/fengari-interop)
  - `load(source, chunkname)`: a function that loads the lua code in `source` with the optional chunk name `chunkname` and returns it as a function.
    This function can be used to programmatically run lua code in the main `lua_State` from JavaScript. e.g.
    ```js
    console.log(fengari.load('return 1+1')())
    ```
