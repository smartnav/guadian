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

creategroup: co.wrap(function* (ownerid,data,email) {
		try{
		let conxData = yield coPg.connectPromise(connectionString);
        let client = conxData[0];
        let done = conxData[1];
        var uniqueid = uuid.v4();
        let result = yield client.queryPromise("INSERT INTO user_groups (id,group_name,user_id,creator_id,creator_email) VALUES($1,$2,$3,$4,$5)",[uniqueid,data.name,[ownerid],ownerid,email]);
        if(result.rowCount===1) {
        let logging = yield _auditlog.writelog({model:"user_groups",operation:"ADD_GROUP",user_id:ownerid,pkey:uniqueid,details:"'Add_Group'"});
        return yield Promise.resolve(result);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
}),

showgroup: co.wrap(function* (ownerid){
		try{
		let conxData = yield coPg.connectPromise(connectionString);
        let client = conxData[0];
        let done = conxData[1];
        let result = yield client.queryPromise("SELECT id,group_name,created,creator_email from user_groups WHERE $1 = any(user_id)",[ownerid]);
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
    let result = yield client.queryPromise("SELECT forms.*,user_groups.group_name,(SELECT count(status) FROM responders WHERE formid=forms.id AND status=\'approved\') as approved_count,(SELECT count(status) FROM responders WHERE formid=forms.id AND status=\'unapproved\') as unapproved_count FROM forms, user_groups WHERE forms.status!=\'trashed\' AND forms.owner_id!= $1 AND user_groups.id = forms.owner_group_id AND $1 = any (user_groups.user_id) LIMIT "+limit+" OFFSET "+offset ,[ownerid]);
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

getCountByGroup: co.wrap(function* (ownerid) {
	try{
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let result =yield client.queryPromise( `SELECT count(*) as total FROM "forms" f WHERE f.owner_group_id is not null AND f.status!='trashed' AND f.owner_id!= $1`,[ownerid]);
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
        console.log("result");
            if(result.rowCount===1) {
              let length = yield client.queryPromise(`SELECT array_length(user_id, 1) FROM "user_groups" WHERE id=$1`,[groupID]);
            if(length.rows[0].array_length>0)
            {  
              console.log("length greater than 0");
              let logging = yield _auditlog.writelog({model:"user_groups",operation:"Delete_User",user_id:owner_id,pkey:uniuqeid,details:"'Delete_User'"});
              done();
              return yield Promise.resolve(length);
            }
            else
            {
              console.log("length less than 0");
              let delgroup = yield client.queryPromise(`DELETE FROM user_groups WHERE id=$1`,[groupID]);
              if(delgroup.rowCount===1)
              {
                console.log("group deleted successfully");
                let delFormid = yield client.queryPromise(`UPDATE forms SET owner_group_id=null WHERE owner_group_id=$1`,[groupID]);
                done();
                if(delFormid) {
                  console.log("form owner_group_id updated successfully");
                  return yield Promise.resolve(delFormid);
                }
              }
            }
            }
            return yield Promise.resolve(null);
     
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

 addUser: co.wrap(function* (owner_id,userEmail,groupID) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      
      let uniuqeid = uuid.v4();
    //  let user_id = "{"+owner_id+"}";
      let UserExist = 0;
      
      let result1 = yield client.queryPromise(`SELECT * FROM "users" WHERE email = $1`, [userEmail]);
      done();
      if (result1.rowCount===1) {
        var userID = result1.rows[0].id;
        let res = yield client.queryPromise(`SELECT * FROM "user_groups" WHERE ${userID} = any (user_id) AND id=$1`,[groupID]);
        done();
        if(res.rowCount==0)
        {
          UserExist = 1;
          let result = yield client.queryPromise(`UPDATE "user_groups" SET user_id = ${userID} || user_id WHERE id = $1`,[groupID]);
          done();
          if(result.rowCount===1) {
            let logging = yield _auditlog.writelog({model:"user_groups",operation:"ADD_USER",user_id:owner_id,pkey:uniuqeid,details:"'Add_USER'"});
            return yield Promise.resolve(UserExist);
            }
        }
        else
        {
          UserExist = 2;
          return yield Promise.resolve(UserExist);
        }
        return yield Promise.resolve(null);
      }
      else
      {
        console.log("in user doesnot exist");
        return yield Promise.resolve(UserExist);
      }
     
      
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

  delGroup: co.wrap(function* (groupID) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let uniuqeid = uuid.v4();
              let delgroup = yield client.queryPromise(`DELETE FROM user_groups WHERE id=$1`,[groupID]);
              if(delgroup.rowCount===1)
              {
                console.log("group deleted successfully");
                let delFormid = yield client.queryPromise(`UPDATE forms SET owner_group_id=null WHERE owner_group_id=$1`,[groupID]);
                done();
                if(delFormid) {
                  console.log("form owner_group_id updated successfully");
                  return yield Promise.resolve(delFormid);
                }
              }
            return yield Promise.resolve(null);
     
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

  leaveGroup: co.wrap(function* (data) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
                let delFormid = yield client.queryPromise(`UPDATE forms SET owner_group_id=null WHERE owner_group_id=$1 AND id=$2`,[data.groupID,data.formID]);
                done();
                console.log(delFormid);
                if(delFormid.rowCount==1) {
                  console.log("form owner_group_id updated successfully");
                  return yield Promise.resolve(delFormid);
                }
            return yield Promise.resolve(null);
     
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

}

module.exports = usergroup;