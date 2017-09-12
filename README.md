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

Now any script of type `text/lua` will be run by fengari:

```html
<script type="text/lua">
print("hello world !")
</script>

<script src="/my-script.lua" type="text/lua" async></script>
```

Note that if you use a `src` tag, it is strongly recommended for it to be [`async`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-async).
