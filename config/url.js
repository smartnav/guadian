'use strict';
let env = process.env;
module.exports = `${env.PROTOCOL}://${env.DOMAIN}${env.HIDE_PORT ? '' : ':' + env.PORT}`;

