var pg = require('co-pg')(require('pg'));
var koaPg = require('koa-pg');
var session = require('koa-generic-session');
var PgStore = require('koa-pg-session');

//left in case we want to use pg-gen later on
var defaults = {};
defaults.user = process.env.PGUSER;
defaults.database = process.env.PGDATABASE;
defaults.password = process.env.PGPASS;
defaults.host = process.env.PGHOST;
defaults.port = process.env.PGPORT;
defaults.poolSize = process.env.PGPOOLSIZE || 10;
defaults.pool = (process.env.PGPOOLSIZE === "0" ? false : 10);

var connectionString = process.env.DATABASE_URL || `postgres://${defaults.user}:${defaults.password}@${defaults.host}:${defaults.port}/${defaults.database}`;
console.log('cont    ++++++',connectionString);

module.exports = {
  middleware: function(app){
    app.use(koaPg(connectionString));
    var pgStore = new PgStore(connectionString);
    app.keys = [process.env.SECRET];
    app.use(session({store:pgStore}));
    pgStore.setup().then(function() {
    	console.log("PGStore setup completed");
    });
  },
  connectionString
};
