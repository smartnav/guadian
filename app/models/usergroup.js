"use strict";

const crypto = require('crypto');
const connectionString = require('../../config/db').connectionString;
const pg = require('pg');
const co = require('co');
const coPg = require('co-pg')(pg);
const uuid = require('uuid');
const url = require('url');

const _auditlog = require('./auditlog'); // load audit log model
const usergroup = {

creategroup: co.wrap(function* (ownerid,data) {
		try{
		let conxData = yield coPg.connectPromise(connectionString);
        let client = conxData[0];
        let done = conxData[1];
        var uniqueid = uuid.v4();
        let result = yield client.queryPromise("INSERT INTO user_groups (id,group_name,user_id) VALUES($1,$2,$3)",[uniqueid,data.name,[ownerid]]);
        done();
        if(result)
        {
            return yield Promise.resolve(result);
        }
        return yield Promise.resolve(null);
        }catch(err){
      return yield Promise.reject(err);
    }
}),

showgroup: co.wrap(function* (){
		try{
		let conxData = yield coPg.connectPromise(connectionString);
        let client = conxData[0];
        let done = conxData[1];
        let result = yield client.queryPromise("SELECT id,group_name,created from user_groups");
        done();
        if(result)
        {
            return yield Promise.resolve(result.rows);
        }
        return yield Promise.resolve(null);
        }catch(err){
      return yield Promise.reject(err);
    }
}),

getFormByGroupId: co.wrap(function* (ownerid,limit,offset) {
	try{
	let conxData = yield coPg.connectPromise(connectionString);
	console.log(ownerid);
    let client = conxData[0];
    let done = conxData[1];
    let result = yield client.queryPromise("SELECT forms.*,user_groups.group_name,(SELECT count(status) FROM responders WHERE formid=forms.id AND status=\'approved\') as approved_count,(SELECT count(status) FROM responders WHERE formid=forms.id AND status=\'unapproved\') as unapproved_count FROM forms, user_groups WHERE forms.status!=\'trashed\' AND user_groups.id = forms.owner_group_id AND $1 = any (user_groups.user_id) LIMIT "+limit+" OFFSET "+offset ,[ownerid]);
    done();
    if(result)
        {
            return yield Promise.resolve(result.rows);
        }
        return yield Promise.resolve(null);
        }catch(err){
      return yield Promise.reject(err);
    }
	}),

getCountByGroup: co.wrap(function* () {
	try{
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let queryStatement = `SELECT count(*) as total FROM "forms" f WHERE f.owner_group_id is not null AND f.status!='trashed' `;
      let result = yield client.queryPromise(queryStatement);
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows[0]);
      }
      return yield Promise.resolve(null);
      }catch(err){
      return yield Promise.reject(err);
    }
  }),

delUser: co.wrap(function* (owner_id,userid,groupID) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let uniuqeid = uuid.v4();
      let result = yield client.queryPromise(`UPDATE "user_groups" SET user_id = array_remove(user_id, ${userid}) WHERE id = $1`,[groupID]);
      
            if(result.rowCount===1) {
              let logging = yield _auditlog.writelog({model:"user_groups",operation:"Delete_User",user_id:owner_id,pkey:uniuqeid,details:"'Delete_User'"});
              return yield Promise.resolve(result);
            }
            return yield Promise.resolve(null);
     
    }catch(err){
      return yield Promise.reject(err);
    }
  }),
}

module.exports = usergroup;