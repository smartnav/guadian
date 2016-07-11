var pm2 = require('pm2');

var instances = process.env.WEB_CONCURRENCY || -1; // Set by Heroku or -1 to scale to max cpu core -1
var maxMemory = process.env.WEB_MEMORY || 512;    // " " "

pm2.connect(function() {
  pm2.start({
    script    : 'node-basic.js',
    name      : 'production-app',     // ----> THESE ATTRIBUTES ARE OPTIONAL:
    exec_mode : 'cluster',            // ----> https://github.com/Unitech/PM2/blob/master/ADVANCED_README.md#schema
    instances : instances,
    max_memory_restart : maxMemory + 'M',   // Auto restart if process taking more than XXmo
    env: {                            // If needed declare some environment variables
      "NODE_ENV": "production",
      "PGPASSWORD": process.env.PGPASSWORD,
      "PGHOST": process.env.PGHOST,
      "PGUSER": process.env.PGUSER,
      "PGDATABASE": process.env.PGDATABASE,
      "PGPORT": process.env.PGPORT,
      "PGPOOLSIZE": process.env.PGPOOLSIZE,
      "PGPASS": process.env.PGPASS,
      "SECRET": process.env.SECRET,
      "GOOGLE_CLIENT_ID": process.env.GOOGLE_CLIENT_ID,
      "GOOGLE_CLIENT_SECRET": process.env.GOOGLE_CLIENT_SECRET,
      "GOOGLE_CALLBACK_URI": process.env.GOOGLE_CALLBACK_URI,
      "GOOGLE_API_KEY": process.env.GOOGLE_API_KEY,
      "PROTOCOL": process.env.PROTOCOL,
      "DOMAIN": process.env.DOMAIN,
      "HIDE_PORT": process.env.HIDE_PORT,
      "PORT": process.env.PORT,
      "CDN": process.env.CDN,
      "GMAIL_PASSWORD": process.env.GMAIL_PASSWORD,
      "GMAIL_USER": process.env.GMAIL_USER,
      "TWILIO_AUTH_TOKEN": process.env.TWILIO_AUTH_TOKEN,
      "TWILIO_PHONE_NUMBER": process.env.TWILIO_PHONE_NUMBER,
      "TWILIO_SID": process.env.TWILIO_SID
    },
  }, function(err) {
    if (err) return console.error('Error while launching applications', err.stack || err);
    console.log('PM2 and application has been succesfully started');
    
    // Display logs in standard output 
    pm2.launchBus(function(err, bus) {
      console.log('[PM2] Log streaming started');

      bus.on('log:out', function(packet) {
       console.log('[App:%s] %s', packet.process.name, packet.data);
      });
        
      bus.on('log:err', function(packet) {
        console.error('[App:%s][Err] %s', packet.process.name, packet.data);
      });
    });
      
  });
});