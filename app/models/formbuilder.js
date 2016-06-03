"use strict";

const crypto = require('crypto');
const connectionString = require('../../config/db').connectionString;
const pg = require('pg');
const co = require('co');
const coPg = require('co-pg')(pg);
const errors = require('../errors');
const twilio = require('twilio');
const uuid = require('uuid');

const ejs = require('ejs');
const URL = require('../../config/url');

const formbuilder = {


saveQuestion: co.wrap(function* (param) {

      try {

      var isNew = yield this.isNew(param);
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let stmt = '';
      let uniuqeid = '';
      if(param.qtype=='range')
        param.title = '';
      
     if(isNew=='0'){
        uniuqeid = uuid.v4();
        //let values = "'"+uniuqeid+"','"+param.formid+"','"+param.orderid+"','"+param.qtype+"','"+param.question+"','"+param.is_hide+"'";
        stmt = `INSERT INTO "questions" ("id","formid","orderid","type","question","is_hide") VALUES ($4,$5,$6,$1,$2,$3)`;
        let result = yield client.queryPromise(stmt,[param.qtype,param.question,param.is_hide,uniuqeid,param.formid,param.orderid]);
                     done();
                     if(result.rowCount===1) {
                       return yield Promise.resolve(uniuqeid);
                     }
                     return yield Promise.resolve(null);
      }
      else {
        uniuqeid = isNew;
        stmt = `UPDATE "questions" SET  type=$1, question=$2, is_hide=$3  where id=$4`;
        let result = yield client.queryPromise(stmt,[param.qtype,param.question,param.is_hide,uniuqeid]);
         done();
         if(result.rowCount===1) {
           return yield Promise.resolve(uniuqeid);
         }
         return yield Promise.resolve(null);
      }
   
    }catch(err){
      return yield Promise.reject(err);
    }
}),

isNew: co.wrap(function* (param) {

      try {

      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      
      if(param.qtype=='range')
        param.title = '';
      
      //let stmt = "select id from \"questions\" where formid='"+param.formid+"' AND orderid="+param.orderid+" limit 1";
      let stmt = `select id from "questions" where formid=$1 AND orderid=$2 limit 1`;
      console.log(stmt)
      let result = yield client.queryPromise(stmt,[param.formid,param.orderid]);
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows[0]['id']);
      }
      return yield Promise.resolve(0);
    }catch(err){
      return yield Promise.reject(err);
    }
}),

getQuestions: co.wrap(function* (formid) {

try {

      
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      
      let result = yield client.queryPromise('SELECT * from questions where formid = $1 ORDER BY orderid asc ', [ formid]);
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
}),

removeQuestion: co.wrap(function* (param) {

	try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let result = yield client.queryPromise('DELETE from questions where formid = $1 AND orderid= $2 RETURNING *', [param.formid,param.orderid]);
      done();
      console.log(result.rows,'result.rows')
      if(result.rows.length) {
        return yield Promise.resolve(result.rows[0]);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
}),

isQuestionExist: co.wrap(function* (formid) {

  try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise('SELECT count(id) as total from questions where formid='+"'"+formid+"'");
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows[0]);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
}),

isResponseReceived: co.wrap(function* (formid) {

  try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let result = yield client.queryPromise('select count(id) as total from responders where formid =$1',[formid] );
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
module.exports = formbuilder;
