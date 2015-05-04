var fs = require("fs");
var koa = require("koa");
var ssdom = require("../../");

var app = koa();

app.use(ssdom());

app.use(function *() {
  if(this.url == "/") {
    this.type = "html";
    this.body = yield function(cb) { fs.readFile(__dirname + "/public/index.html", cb); };
  }
});

app.listen(80);
