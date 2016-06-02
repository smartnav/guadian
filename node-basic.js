var koa = require('koa');
var render = require('koa-ejs');
var path = require('path');
var logger = require('koa-logger')
var bodyParser = require('koa-bodyparser');


var app = koa();
app.use(logger())
app.use(bodyParser());
var db = require('./config/db').middleware(app);


render(app, {
  root: path.join(__dirname, 'views'),
  layout: 'layout',
  viewExt: 'ejs',
  cache: false,
  debug: true
});


require('./app/routes.js')(app);
//routes
// TODO: Refactor routes into routes.js

if(process.env.CDN == "self")
	process.env.CDN = "";


if (!module.parent) {
	//tempoary hack to make localhost work with node --harmony {app-name}.js
	//i.e. app.listen(process.env.PORT || 3000)
	if(process.env.PORT == undefined )
		app.listen(3000);
	else
		app.listen(process.env.PORT);
}
module.exports = app;
