"use strict";

const crypto = require('crypto');
const connectionString = require('../../config/db').connectionString;
const pg = require('pg');
const co = require('co');
const coPg = require('co-pg')(pg);
const errors = require('../errors');
const twilio = require('twilio');

const ejs = require('ejs');
const URL = require('../../config/url');

const auditlog = {


writelog: co.wrap(function* (param) {

      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      
      let values = "'"+param.model+"','"+param.operation+"','"+param.pkey+"',"+param.user_id+","+param.details+",now()";
      let stmt = 'INSERT INTO "audit_log" ("model","operation","pkey","user_id","details","log_time") VALUES ('+values+')';
      yield client.queryPromise(stmt);
      done();
}),

getLogs: co.wrap(function* (limit,offset) {

try {

      if(limit < 0) 
        return yield Promise.resolve(null);
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      
      let result = yield client.queryPromise('SELECT u.name,model,operation,details,to_char(log_time, \'MM-DD-YYYY HH:MI:SS\') as log_time from audit_log as al left join users as u on al.user_id=u.id LIMIT $1 OFFSET $2 ', [ limit, offset]);
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
}),

getLogsCount: co.wrap(function* () {

	try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise('SELECT count(id) as total from audit_log');
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows[0]);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
}),

}
module.exports = auditlog;
