"use strict";

const crypto = require('crypto');
const connectionString = require('../../config/db').connectionString;
const pg = require('pg');
const co = require('co');
const coPg = require('co-pg')(pg);
const errors = require('../errors');
const twilio = require('twilio');
const file = require('fs');
const transporter = require('nodemailer').createTransport({
	host: 'smtp.gmail.com',
	port: 465,
	secure: true, // use SSL
	auth: {
		user: process.env.GMAIL_USER,
		pass: process.env.GMAIL_PASSWORD
	}
});
const ejs = require('ejs');
const URL = require('../../config/url');


const _auditlog = require('./auditlog'); // load audit log model

let get = co.wrap(function* (id) {
  try {
    let valid = /^[0-9]+$/;

    if(!valid.test(id)) {
      return yield Promise.resolve(null);
    }
    let conxData = yield coPg.connectPromise(connectionString);
    let client = conxData[0];
    let done = conxData[1];
    let result = yield client.queryPromise('SELECT * FROM "responses" WHERE ' +
        '"id" = $1 AND status!=\'trashed\' LIMIT 1', [id]);
    done();
    if(result.rows.length) {
      return yield Promise.resolve(result.rows[0]);
    }
    return yield Promise.resolve(null);
  }catch(err){
    console.error(err);
    return yield Promise.reject(err);
  }
});

const response = {


  /* This function is deprecated, consider pulling out. 
  approve: co.wrap(function* (id, owner_id) {
    console.log("We are approving");
    let r = yield get(id);
    if(r === null) {
      throw new errors.UserNotAllowed();
    }

    let conxData = yield coPg.connectPromise(connectionString);
    let client = conxData[0];
    let done = conxData[1];
    let data = yield client.queryPromise(`SELECT * FROM "forms" WHERE
        "id" = $1 LIMIT 1`, [r.formid]);

    if(!data.rows.length || data.rows[0].owner_id != owner_id) {
      throw new errors.UserNotAllowed();
      done();
    }
    let f = data.rows[0];

    if(r.approved == 'approved') {
      done();
      return yield Promise.resolve(true);
    }

    let result = yield client.queryPromise(`UPDATE "responses" SET status =
        'approved' WHERE "id" = $1`, [id]);
    done();

    // send SMS, if a phone number was given
    if(r.phone) {
      let client = new twilio.RestClient(
        process.env.TWILIO_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      let path = `${__dirname}/../../views/messages/text.ejs`;
      require('fs').readFile(path, 'utf8', (err, result)=>{
        if(err) {
          console.error("Could not open SMS template file.", err);
        }
        client.sendSms({
          to: r.phone,
          from: process.env.TWILIO_PHONE_NUMBER,
          body: ejs.render(result, {
            facility: f.facility,
            yelp: f.yelp
          })
        }, function(error, message) {
          if(error) {
            console.error("Error sending Twilio SMS", error);
          }
          else
          {
            console.log("SMS Sent", message);
          }
        });
      });
    }

    if(r.email) {
      try {
        let path = `${__dirname}/../../views/messages/email.ejs`;
        require('fs').readFile(path, 'utf8', (err, result)=>{
          let rendered = ejs.render(result, {
            yelp: f.yelp,
            google_plus: f.google_plus,
            facility: f.facility,
            reviewer_name: r.name,
            owner_name: f.facility,
            original_message: r.comments
          });
          transporter.sendMail({
            from: `${data.facility} <no-reply@${URL}>`,
            to: r.email,
            subject: 'Thank You!',
            text: rendered
          }, function(error, info) {
            if(error) {
              return console.error(error);
            }
            console.log('Email sent', info);
          });
        });
      }catch(e) {
        console.error(e);
      }
    }
    return yield Promise.resolve(true);
  }),*/

  /**
   * Populates an object with the associated responses's properties and null
   * if none found.
   *
   * id is the id of the response
   */
  get: get,

  generateCommentsFromQuestions:function(data) {
    var message = "";
    for (var i = data.length - 1; i >= 0; i--) {
      message += "\n" + data[i].question;
      message += "\n" + (data[i].textval == "" ? data[i].rateval.toString() + " / 5 stars." : data[i].textval);
      message += "\n";
      console.log(data[i].question, data[i].rateval, data[i].textval);
    }
    return message;
  },

  getGeneratedEmail: co.wrap(function* (form_id, owner_id, response_id) {
    console.log("We are generating an email for form: ", form_id, " from owner: ", owner_id);

    let conxData = yield coPg.connectPromise(connectionString);
    let client = conxData[0];
    let done = conxData[1];
    let data = yield client.queryPromise(`SELECT * 
                                          FROM forms
                                          INNER JOIN responders ON (forms.id = responders.formid)
                                          INNER JOIN responses ON (responses.responderid = responders.id)
                                          INNER JOIN questions ON (responses.questionid = questions.id)
                                          WHERE forms.id = $1
                                          AND responders.id = $2 `, [form_id, response_id]);
    if(!data.rows.length) {
      throw new errors.UserNotAllowed();
      done();
    }




    done();


  



    var message = this.generateCommentsFromQuestions(data.rows);



    let f = data.rows[0];
    if(f.email) {
      try {
        var p = Promise.defer();
        let path = `${__dirname}/../../views/messages/email.ejs`;
        ejs.renderFile(path, {
            yelp: f.yelp,
            google_plus: f.google_plus,
            facility: f.facility,
            reviewer_name: f.name,
            owner_name: f.facility,
            original_message: message
          }, {}, function (err, html) {
            if(err)
              console.log("We have an error", err);
            p.resolve(html);
          });
        return yield p.promise;

          /*transporter.sendMail({
            from: `"${data.facility}" <no-reply@${URL}>`,
            to: r.email,
            subject: 'Thank You!',
            text: rendered
          }, function(error, info) {
            if(error) {
              return console.error(error);
            }
            console.log('Email sent', info);
          });*/

      }catch(e) {
        console.error(e);
        return Promise.resolve(null);
      }
    }
  }),

  sendGeneratedEmail: co.wrap(function* (form_id, owner_id, response_id, emailBody,status) {
    console.log("We are sending an email for form: ", form_id, " from owner: ", owner_id);

    let conxData = yield coPg.connectPromise(connectionString);
    let client = conxData[0];
    let done = conxData[1];
   // yield client.queryPromise('UPDATE "responders" SET contacted_status='+status+' Where "id" = '+response_id);
    let data = yield client.queryPromise(`SELECT *
                                          FROM forms
                                          INNER JOIN responders
                                          ON (forms.id = responders.formid)
                                          WHERE forms.id = $1 LIMIT 1`, [form_id]);
    console.log(data.rows);
    if(!data.rows.length ) {
      throw new errors.UserNotAllowed();
      done();
    }
    done();
    let f = data.rows[0];
    if(f.email && f.contacted_status != 1) {
      try {
        var p = Promise.defer();
        transporter.sendMail({
            from: `"${data.facility}" <no-reply@${URL}>`,
            to: f.email,
            subject: 'Thank You!',
            text: emailBody
          }, function(error, info) {
            if(error) {
              return console.error(error);
            }
            console.log('Email sent', info);
            p.resolve(info);
          });
          return yield p.promise;
      }catch(e) {
        console.error(e);
        return Promise.resolve(null);
      }
    }
  }),


	getReviews: co.wrap(function* () {
    try {
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise('SELECT * FROM "responders"; ');
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

  checkContactedStatus: co.wrap(function* (owner_id,response_id) {
    try{
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise('SELECT contacted_status FROM "responders" WHERE id=$1',[response_id]);
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows);
      }
     return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

updateContactedStatus: co.wrap(function* (owner_id,response_id,status) {
    try{
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise('UPDATE "responders" SET contacted_status=$2 WHERE id=$1',[response_id,status]);
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
   * limit is the limit of the amount of forms to return
   *
   */
  getByForm: co.wrap(function* (form_id, limit) {
    try {

      if(limit < 0) //TODO: Better test on limit? Does it matter if it is not exposed publicly.
        return yield Promise.resolve(null);

      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise('SELECT * FROM "responses" WHERE ' + '"formid" = $1 LIMIT ' + limit, [form_id]);
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

  getAverageValue: co.wrap(function* (form_id, field) {
    try {
      let allowed = ['recommend', 'staff', 'care', 'discharge'];
      if(allowed.indexOf(field) === -1) {
        throw new Error(`${field} is not an allowed field`);
      }

      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise(`SELECT AVG("${field}") AS average
          FROM "responses" WHERE "formid" = $1 AND "status" = 'approved'`,
          [form_id]);
      done();
      if(result.rows.length) {
        console.log("Result: ", result.rows[0]);
        if(result.rows[0].average == null) //no approved responses yet
          return yield Promise.resolve(null);
        return yield Promise.resolve(result.rows[0].average.substr(0,4));
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

  /**
   * Returns randomly-ordered comments that have been approved for the
   * given form.
   */
  getApprovedTextResponses: co.wrap(function* (form_id, limit) {
    try {
      limit = limit || 0;

      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise(`WITH responders_group AS(
                                                 SELECT *
                                                 FROM responders
                                                 WHERE responders.formid = $1
                                                 AND responders.status = 'approved'
                                                 LIMIT $2
                                               )
                                              SELECT forms.id as formid, forms.owner_id, forms.facility, forms.status as form_status,
                                                     responders_group.name, responders_group.created, responders_group.contacted_status, responders_group.status as responder_status, 
                                                     questions.type, questions.question,
                                                     responses.*
                                              FROM forms, responders_group
                                              INNER JOIN responses ON (responses.responderid = responders_group.id)
                                              INNER JOIN questions ON (questions.id = responses.questionid AND questions.is_hide = false)
                                              WHERE forms.id = $1`,  [form_id, limit]);
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
   * offset is to start fetching from specific record
   */


  /* Rahul */

  getLatestByOwner: co.wrap(function* (owner_id, limit,offset) {
    try {

      if(limit < 0) //TODO: Better test on limit? Does it matter if it is not exposed publicly.
        return yield Promise.resolve(null);
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      /* Sorry. I am truely sorry for this query. */
      //SELECT u.id as "user_id", f.id as "form_id",r.id as "response_id",r.comments FROM "users" u, "forms" f, "responses" r WHERE r.formid = f.id AND f.owner_id = u.id AND f.owner_id = 8 LIMIT 2
      let result = yield client.queryPromise('SELECT u.id as "user_id", f.facility, f.id as "form_id",r.id as "response_id",r.status ' +
                                              'FROM "users" u, "forms" f, "responders" r ' +
                                              'WHERE r.formid = f.id AND f.owner_id = u.id AND f.owner_id = $1 AND r.status IS NULL OR r.formid = f.id AND f.owner_id = u.id AND f.owner_id = $1 AND r.status!=\'trashed\' order by  CASE WHEN(r.status = \'unapproved\') THEN 0 WHEN(r.status = \'approved\') THEN 1 ELSE 2 END LIMIT $2 OFFSET $3 ', [owner_id, limit, offset]);
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),


  getCountLatestByOwner: co.wrap(function* (owner_id) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise('SELECT count(u.id) as "total" ' +
                                              'FROM "users" u, "forms" f, "responders" r ' +
                                              'WHERE r.formid = f.id AND f.owner_id = u.id AND f.owner_id =$1 AND r.status!=\'trashed\' OR  r.formid = f.id AND f.owner_id = u.id AND f.owner_id =$1 AND r.status IS NULL ', [owner_id]);
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows[0]);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),
  /* Rahul */

  /* Rahul for Approve , Un Approve, Trash Response */

  toggleStatus: co.wrap(function* (owner_id,id,status) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      let result = yield client.queryPromise(`UPDATE responders SET status = ${status} WHERE "id" = $1`, [id]);
      done();
      if(result.rowCount===1) {
        let logging = yield _auditlog.writelog({model:"responders",operation:"STATUS_CHANGED",user_id:owner_id,pkey:id,details:status});
        return yield Promise.resolve(id);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

  /* Rahul for Approve , Un Approve, Trash Response */

  /* Rahul for Edit Response */
/* Edited by Smartdata*/
  updateResponse: co.wrap(function* (data) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let result =yield client.queryPromise('UPDATE "responses" SET "textval" = $2, "rateval" = $4 WHERE "questionid" = $1 AND "responderid" = $3 ', [data.id,data.response_text,data.responderid,data.response_rating]);
      //let result = yield client.queryPromise('UPDATE responses SET comments ='+comments+' WHERE "id" = $1', [id]); //There is no column named comments in db so we commented this line.
      done();
      if(result.rowCount===1) {
        //let logging = yield _auditlog.writelog({model:"responses",operation:"EDIT",user_id:data.owner_id,pkey:data.responderid,details:"'RESPONSE_UPDATED'"});
        return yield Promise.resolve(data.responderid);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),
  /* Edited by Smartdata*/
  /* Rahul for Edit Response */

 

 /* Rahul For Form Specific Responses */

  //getFormResponsesByOwner: co.wrap(function* (owner_id,formid,status,limit,offset) {
  //  try {
  //
  //    if(limit < 0) //TODO: Better test on limit? Does it matter if it is not exposed publicly.
  //      return yield Promise.resolve(null);
  //    let conxData = yield coPg.connectPromise(connectionString);
  //    let client = conxData[0];
  //    let done = conxData[1];
  //    /* Sorry. I am truely sorry for this query. */
  //    let result = yield client.queryPromise( `WITH responders_group AS(
  //                                               SELECT *
  //                                               FROM responders
  //                                               WHERE responders.formid = $2
  //                                               AND responders.status = $3
  //                                               LIMIT $4
  //                                               OFFSET $5
  //                                             )
  //                                            SELECT forms.id as formid, forms.owner_id, forms.facility, forms.status as form_status,
  //                                                   responders_group.name, responders_group.created, responders_group.contacted_status, responders_group.status as responder_status, 
  //                                                   questions.type, questions.question, questions.is_hide,
  //                                                   responses.*
  //                                            FROM forms, responders_group
  //                                            INNER JOIN responses ON (responses.responderid = responders_group.id)
  //                                            INNER JOIN questions ON (questions.id = responses.questionid)
  //                                            WHERE forms.id = $2
  //                                            AND forms.owner_id = $1`, [owner_id, formid, status, limit, offset]);
  //    
  //    done();
  //    if(result.rows.length) {
  //      return yield Promise.resolve(result.rows);
  //    }
  //    return yield Promise.resolve(null);
  //  }catch(err){
  //    return yield Promise.reject(err);
  //  }
  //}),

  
  
   getFormResponsesByOwner: co.wrap(function* (owner_id,formid,status,limit,offset) {
    try {

      if(limit < 0) //TODO: Better test on limit? Does it matter if it is not exposed publicly.
        return yield Promise.resolve(null);
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      /* Sorry. I am truely sorry for this query. */
      let result = yield client.queryPromise( `WITH responders_group AS(
                                                 SELECT *
                                                 FROM responders
                                                 WHERE responders.formid = $1
                                                 AND responders.status = $2
                                                 LIMIT $3
                                                 OFFSET $4
                                               )
                                              SELECT forms.id as formid, forms.owner_id, forms.facility, forms.status as form_status,
                                                     responders_group.name, responders_group.created, responders_group.contacted_status, responders_group.status as responder_status, 
                                                     questions.type, questions.orderid, questions.question, questions.is_hide,
                                                     responses.*
                                              FROM forms, responders_group
                                              INNER JOIN responses ON (responses.responderid = responders_group.id)
                                              INNER JOIN questions ON (questions.id = responses.questionid)
                                              WHERE forms.id = $1 `, [formid, status, limit, offset]);
      
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

  getFormResponsesCountByOwner: co.wrap(function* (owner_id,formid,status) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      /*let result = yield client.queryPromise('SELECT count(u.id) as "total" ' +
                                              'FROM "users" u, "forms" f, "responses" r ' +
                                              'WHERE r.formid = $2 AND f.id = $2 AND f.owner_id = u.id AND f.owner_id =$1 AND r.status=$3', [owner_id,formid,status]);
      */
     //let result = yield client.queryPromise('SELECT count(re.id) as "total" ' +
     //                                       'FROM "forms" f, "responders" re ' +
     //                                       'WHERE ' +
     //                                         're.formid = $2 ' +
     //                                         'AND f.id = $2 ' +
     //                                         'AND f.owner_id = $1 ' +
     //                                         'AND re.status=$3', [owner_id,formid,status]);
     //
     
     let result = yield client.queryPromise('SELECT count(re.id) as "total" ' +
                                            'FROM "forms" f, "responders" re ' +
                                            'WHERE ' +
                                              're.formid = $1 ' +
                                              'AND f.id = $1 ' +
                                              'AND re.status=$2', [formid,status]);




      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows[0]);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),
  /* Rahul For Form Specific Responses */



   getApprovedResponsesByOwner: co.wrap(function* (owner_id,limit,offset) {
    try {

      if(limit < 0) //TODO: Better test on limit? Does it matter if it is not exposed publicly.
        return yield Promise.resolve(null);
      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      /* Sorry. I am truely sorry for this query. */
      //TODO optimize query by selecting forms first.
      let result = yield client.queryPromise( `WITH responders_group AS(
                                                 SELECT *
                                                 FROM responders
                                                 WHERE responders.status = 'approved'
                                                 LIMIT $2
                                                 OFFSET $3
                                               )
                                              SELECT forms.id as formid, forms.owner_id, forms.facility, forms.status as form_status,
                                                     responders_group.name, responders_group.created, responders_group.contacted_status, responders_group.status as responder_status, 
                                                     questions.type, questions.question,
                                                     responses.*
                                              FROM forms, responders_group
                                              INNER JOIN responses ON (responses.responderid = responders_group.id)
                                              INNER JOIN questions ON (questions.id = responses.questionid)
                                              WHERE forms.id = responders_group.formid 
                                              AND forms.owner_id = $1`, [owner_id, limit, offset]);
      
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),


  getApprovedResponsesCountByOwner: co.wrap(function* (owner_id) {
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];

      
     let result = yield client.queryPromise(`SELECT count(re.id) as "total"
                                             FROM "forms" f, "responders" re 
                                             WHERE f.id = re.formid 
                                              AND f.owner_id = $1 
                                              AND re.status='approved'`, [owner_id]);
      done();
      if(result.rows.length) {
        return yield Promise.resolve(result.rows[0]);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }
  }),

  getEmailId: co.wrap(function* (formid,response_id){
    try {


      let conxData = yield coPg.connectPromise(connectionString);
      let client = conxData[0];
      let done = conxData[1];
      let res = yield client.queryPromise(`SELECT responders.email FROM forms INNER JOIN responders ON (forms.id = responders.formid) WHERE forms.id = $1 and responders.id = $2`,[formid,response_id]);
      if(res.rowCount)
      {
        return yield Promise.resolve(res.rows[0]);
      }
      return yield Promise.resolve(null);
    }catch(err){
      return yield Promise.reject(err);
    }

  })





};



module.exports = response;
