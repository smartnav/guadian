"use strict";

const crypto = require('crypto');
const connectionString = require('../../config/db').connectionString;
const pg = require('pg');
const co = require('co');
const coPg = require('co-pg')(pg);
const uuid = require('uuid');
const url = require('url');

const _auditlog = require('./auditlog'); // load audit log model

const RATING_MAX = 5;
const RATING_MIN = 1;

const form = {

  nonce: {
    InvalidNonce: class InvalidNonce extends Error{},

    /**
     * Creates a nonce to work in conjunction with posting data to the given
     * form ID.
     *
     * The nonce will expire after one hour.
     */
    create: co.wrap(function* (formID) {
      const nonce = crypto.randomBytes(8).toString('hex');

      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let stmt = 'INSERT INTO "nonces" ("formid", "value") VALUES' +
                 "($1, $2)";

      yield client.queryPromise(stmt, [formID, nonce]);
      done();
      return yield Promise.resolve(nonce);
    }),

    /**
     * Verifies that the nonce was created in conjunction with the given ID.
     * This function is not idempotent: once the nonce is validated it is
     * deleted so it may not be used multiple times.
     *
     * Returns a promise that is resolved with true or false depending on the
     * validity of the nonce.
     */
    validate: co.wrap(function* (nonce, formID) {
      try {
        let conxData = yield coPg.connectPromise(connectionString);
        let client = conxData[0];
        let done = conxData[1];
        let result = yield client.queryPromise('SELECT true ' +
            'AS valid FROM "nonces" WHERE "value" = $1 AND "formid" = $2 ' +
            'AND "expires" > now() limit 1',
            [nonce, formID]);
        // remove stale nonces
        yield client.queryPromise('DELETE FROM "nonces" WHERE ' +
              '("value" = $1 AND "formid" = $2) OR "expires" <= NOW()',
              [nonce, formID]);
        done();
        if(!result.rows.length) {
          return yield Promise.resolve(false);
        }
        return yield Promise.resolve(result.rows[0].valid);
      }catch(err){
        console.error(err);
        return yield Promise.reject(err);
      }
    })
  },

  /**
   * Populates an object with the associated form's properties and null
   * if none found.
   */
  get: co.wrap(function* (id) {
    try {
      let valid =
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

      if(!valid.test(id)) {
        return yield Promise.resolve(null);
      }
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let result = yield client.queryPromise('SELECT * FROM "forms" WHERE ' +
          '"id" = $1 LIMIT 1', [id]);
      done();
      if(result.rows.length) {
        let f = result.rows[0];
        f.location = f.allowed_origins;
        if(f.allowed_origins) {
          f.allowed_origins = f.allowed_origins.map((o)=>{
            let p = url.parse(o);
            return p.protocol + '//' + p.host;
          });
        }
        return yield Promise.resolve(f);
      }
      return yield Promise.resolve(null);
    }catch(err){
      console.error(err);
      return yield Promise.reject(err);
    }
  }),



  /**
   * Creates a new form from the data supplied
   *
   * owner_id is the id of the createForm
   * data is an object that contains data about the form being created
   *    type
   *    facility
   *    yelp
   *    google_plus
   *    allowed_origins
   *    redirect_url
   * Please see schema for if updates to the data object are not reflected in these comments
   */
   create: co.wrap(function* (owner_id, data) {
    try {
       let uniuqeid = uuid.v4();
       let conxData = yield coPg.connectPromise(connectionString);
       let client = conxData[0];
       let done = conxData[1];
       let expected = 'type,facility,yelp,google_plus,allowed_origins,redirect_url';

       let vars = expected.split(',')
         .reduce((a, b, index)=>{return `${a},$${index+2}`},'');
       let vals = expected.split(',').map((a)=>{ return data[a]; });
       console.log(`INSERT INTO "forms" (id,${expected},owner_id) VALUES(${uniuqeid} ${vars}, ${owner_id})`);
       let result = yield client.queryPromise(`INSERT INTO "forms" (id,${expected},owner_id) VALUES($1 ${vars}, ${owner_id})`, [uniuqeid].concat(vals));
       let logging = yield _auditlog.writelog({model:"forms",operation:"CREATE",user_id:owner_id,pkey:uniuqeid,details:"'FORM_CREATION'"});
       done();
       return Promise.resolve(uniuqeid);
       }catch(err){
       return yield Promise.reject(err);
     }
   }),


   /**
   * Saves an existing form from the data supplied
   *
   * owner_id is the id of the createForm
   * data is an object that contains data about the form being created
   *    type
   *    facility
   *    yelp
   *    google_plus
   *    allowed_origins
   *    redirect_url
   * Please see schema for if updates to the data object are not reflected in these comments
   */
   saveFacilityData: co.wrap(function* (owner_id, form_id,data) {
    try {
       let conxData = yield coPg.connectPromise(connectionString);
       let client = conxData[0];
       let done = conxData[1];
       
       //TODO: Allow allowed_origins
       console.log(data);
       console.log( `UPDATE "forms" SET type=$3,
                                        facility=$4,
                                        yelp=$5,
                                        google_plus=$6,
                                        redirect_url=$7
                                    WHERE owner_id=$1
                                    AND id=$2, [${owner_id}, ${form_id}, ${data.type}, ${data.facility}, ${data.yelp}, ${data.google_plus}, ${data.redirect_url}]`);
       let result = yield client.queryPromise(`UPDATE "forms" SET type=$3,
                                        facility=$4,
                                        yelp=$5,
                                        google_plus=$6,
                                        redirect_url=$7
                                    WHERE owner_id=$1
                                    AND id=$2`, [owner_id, form_id, data.type, data.facility, data.yelp, data.google_plus, data.redirect_url]);
       let logging = yield _auditlog.writelog({model:"forms",operation:"UPDATE",user_id:owner_id,pkey:form_id,details:"'FORM_EDIT'"});
       done();
       return Promise.resolve(result);
       }catch(err){
       return yield Promise.reject(err);
     }
   }),


   getForms: co.wrap(function* () {

     try {


       let conxData = yield coPg.connectPromise(connectionString);
       let client = conxData[0];
       let done = conxData[1];

       let result = yield client.queryPromise("SELECT * FROM forms WHERE status='published'");
       done();
       if(result.rows.length) {
         return yield Promise.resolve(result.rows);
       }
       return yield Promise.resolve(null);
     }catch(err){
       return yield Promise.reject(err);
     }

   }),





  /**
   * Populates an object with the forms that belong to the owner and null
   * if none found.
   *
   * owner_id is the user id of the user that created the form
   * limit is the limit of the amount of forms to return
   *
   */
  getByOwner: co.wrap(function* (owner_id, limit,offset) {
    try {


      if(limit < 0) //TODO: Better test on limit? Does it matter if it is not exposed publicly.
        return yield Promise.resolve(null);

      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      //let result = yield client.queryPromise('SELECT * FROM "forms" WHERE ' + '"owner_id" = $1 LIMIT ' + limit, [owner_id]);
      let queryStatement = 'SELECT f.*,(SELECT count(status) FROM "responders" WHERE formid=f.id AND status=\'approved\') as approved_count,(SELECT count(status) FROM "responders" WHERE formid=f.id AND status=\'unapproved\') as unapproved_count FROM "forms" f WHERE f.owner_id = '+owner_id+' AND f.status IS NULL OR f.owner_id = '+owner_id+' AND f.status!=\'trashed\' order by  CASE WHEN(f.status = \'unpublished\') THEN 0 WHEN(f.status = \'published\') THEN 1 ELSE 2 END    LIMIT '+limit+' OFFSET '+offset;
      console.log("This is the query:", queryStatement);
      let result = yield client.queryPromise(queryStatement);
      done();
      console.log("Result:", result.rows);
      if(result.rows.length) {
        return yield Promise.resolve(result.rows);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),


  /* Rahul get total number of rows */

  getCountByOwner: co.wrap(function* (owner_id) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];


      let queryStatement = `SELECT count(*) as total FROM "forms" f WHERE f.owner_id = ${owner_id} AND f.status IS NULL OR f.status!='trashed' `;
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

  /* Rahul for Publish un Publish and trash */

  toggleStatus: co.wrap(function* (owner_id,id,status,coutRes) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      id = "'"+id+"'";
      if (coutRes == 1) {
        var query = 'UPDATE forms SET status ='+status+' WHERE "id" = '+id;
      }
      else
      {
        let formDel = yield client.queryPromise('DELETE FROM questions WHERE formid = '+id);
        var query = 'DELETE FROM forms WHERE id = '+id;
      }
      let result = yield client.queryPromise(query);
      done();
      if(result.rowCount===1) {
        let logging = yield _auditlog.writelog({model:"forms",operation:"STATUS_CHANGED",user_id:owner_id,pkey:id.replace(/["']/g, ""),details:status});
        return yield Promise.resolve(id);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

  /* Rahul for Publish un Publish and trash */



  /**
   * Consumes form data and stores it in the database.
   *
   * formid is the form being submitted to
   * nonce is used to prevent duplicate submissions and curtail spam
   *
   * data should be an object containing these properties:
   *
   * - name // optional. the name of the submitter.
   * - email // optional. the email of the submitter
   * - phone // optional. the phone number of the submitter
   * - ip // required. the IP address of the user
   */
  receive: co.wrap(function* (formid, nonce, data) {
    yield validateSubmission(formid, nonce, data);
    let uniuqeid = uuid.v4();
    let conxData = yield coPg.connectPromise(connectionString);
    let client = conxData[0];
    let done = conxData[1];
    let expected = 'id,formid,name,email,phone,ip';


    let result = yield client.queryPromise(`INSERT INTO "responders" (${expected}) VALUES('${uniuqeid}','${formid}','${data.name}','${data.email}','${data.phone}','${data.ip}')`);
    if(result.rowCount==1){
      delete data.nonce
      delete data.name
      delete data.email
      delete data.ip
      delete data.phone
      data.responderid = uniuqeid;
     yield saveResponses(data);

    done();
    return Promise.resolve(true);
    }
  })
};

// for hoisting purposes
function validateSubmission(){};
validateSubmission = co.wrap(function* (formid, nonce, data) {
    

    if( !(yield form.nonce.validate(nonce, formid)) ) {
      console.error(`Invalid Nonce: ${nonce}`);
      throw new form.nonce.InvalidNonce(nonce);
    }

    if(!data.hasOwnProperty('ip')) {
      throw new Error("IP address required under the 'ip' property.");
    }

    
});


function saveResponses(){};
saveResponses = co.wrap(function* (datas) {
     
    let conxData = yield coPg.connectPromise(connectionString);
    let client = conxData[0];
    let done = conxData[1];

    let queryString =  `INSERT INTO "responses" VALUES `;
    let queryCount = 0;

     var keys = Object.keys(datas)
     keys.forEach(function(key){
       let textvalue = ''
       let ratevalue = 1;

      if(key.indexOf('rate-')!==-1){

        ratevalue = datas[key]
        key = key.replace('rate-','');
        textvalue = '';

      }
      else {
        textvalue = datas[key];
        ratevalue = 1
      }

      //check if valid key (uuid)
      let valid =/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

      if(!valid.test(key)) {
        return Promise.resolve(null);
      }


      if(queryCount != 0)
        queryString += ",";
      queryCount++;

      //TODO: Make query safe
      queryString += `('${key}','${datas["responderid"]}','${textvalue}',${ratevalue})`;
      

     })
     console.log("We'll be injecting the following into the database", queryString);
      client.queryPromise(queryString);
    
});

module.exports = form;
