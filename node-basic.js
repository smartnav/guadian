var koa = require('koa');
var render = require('koa-ejs');
var path = require('path');
var logger = require('koa-logger')
var bodyParser = require('koa-bodyparser');
const transporter = require('nodemailer').createTransport({
	host: 'smtp.gmail.com',
	port: 465,
	secure: true, // use SSL
	auth: {
		user: process.env.GMAIL_USER,
		pass: process.env.GMAIL_PASSWORD
	}
});
const URL = require('./config/url');
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

app.use(function *(next) {
  try {
    // yield downstream
    yield next;
  } catch (err) {
    this.status = err.status || 500;
    this.body = err.message;
    transporter.sendMail({
            from: `<no-reply@${URL}>`,
            to: "smartdata.nav@gmail.com",
            subject: 'Error '+this.status,
            text: err.stack
          }, function(error, info) {
            if(error) {
              return console.error(error);
            }
            console.log('Email sent', info);
          });
  }
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
