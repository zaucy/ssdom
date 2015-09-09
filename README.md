## ssdom - Server Side DOM
This is a standalone application to create a server side dom. I made it to replace my old server side dom [sdom](https://github.com/zaucy/node-sdom).

ssdom __heavily__ uses [jsdom](https://github.com/tmpvar/jsdom) to run the server side dom. If there are any dom features not present I'd recommend forking jsdom and implementing it there.

The goal of ssdom is to be light weight and simple. I plan to improve jsdom instead of ssdom.

Currently ssdom uses my version of jsdom because of a small change I needed. [zaucy/jsdom](/zaucy/jsdom)

## How to use ssdom

#### Single site command line:
```
ssdom /my-website/main.html --port 80
```
#### Mutli site command line:

Use `{HOSTNAME}` in the path argument to insert the hostname to the html path.
```
ssdom /sites/{HOSTNAME}/main.html --port 80
```

#### Programatically
Provide html path string.
```js
var ssdom = require("ssdom");

var server = ssdom("/my-website/main.html");
server.listen(80);
```

ssdom will then run on your script tags with the attribute `context`. Valid values for the context attribute are `server` or `server-only`. The attribute is completely optional. However if the context attribute is omitted the script will _not_ run on the server.

```html
...
<body>
  <script context="server">
    // this script will run on both the client and server.
  </script>

  <script context="server-only">
    // this script will only run on the server.
  </script>

  <script>
    // this script will only run on the client.
  </script>
</body>
...
```

If a `server` or `server-only` script affects the document's source in anyway it will show up on the client's browser. For example if a `server-only` script appends a `<div>` to the body it will be present on the client's browser.

This allows you to handle sensitive data on the server while using the dom or just remove or add content depending on whos viewing it.

## FAQ
_(These aren't actually frequently asked questions. I just made them up.)_

**Q:** Custom attributes are supposed to be prefixed with `data-`. Using an attribute like `context` is ilegal!
<br>
**A:** *Valid* `context` attributes get removed before being sent to clients, so this should be a non-issue.
