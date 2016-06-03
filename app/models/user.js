/*var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// define the schema for our user model
var userSchema = mongoose.Schema({

    local            : {
        email        : String,
        password     : String,
    },
    facebook         : {
        id           : String,
        token        : String,
        email        : String,
        name         : String
    },
    twitter          : {
        id           : String,
        token        : String,
        displayName  : String,
        username     : String
    },
    google           : {
        id           : String,
        token        : String,
        email        : String,
        name         : String
    }

});

// methods ======================
// generating a hash
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
*/

"use strict";
var db  = require ('../../config/db');

const connectionString = require('../../config/db').connectionString;
const pg = require('pg');
const co = require('co');
const coPg = require('co-pg')(pg);


const _auditlog = require('./auditlog'); // load audit log model

function * setSession(id, name, email, authToken, type, session) {
  session = session || this.session;
  session.id = id;
  session.name = name;
  session.email = email;
  session.user = email;
  session.user_type = type;
  if (session.access_token != undefined) {
    session.access_token = authToken;
  }
}

function *isAdmin(){
  console.log("user.isloggedin   " + !(typeof this.session === 'undefined') + "    what type? "+ this.session.user_type);
  return !(typeof this.session === 'undefined') && !(typeof this.session.id === 'undefined') && (this.session.user_type === 'admin');
}

function *isLoggedIn(){
  console.log("user.isloggedin   " + !(typeof this.session === 'undefined'));
  return !(typeof this.session === 'undefined') && !(typeof this.session.id === 'undefined');
}

function *login (email, authToken) {

  var rows = (yield (this.pg.db.client.query_(`SELECT * FROM "users" WHERE email = $1`, [email]))).rows;
  //TODO: Handle other cases, 0, 2, etc

  if(rows.length == 1) {
    let data = rows[0];
    let logging = yield _auditlog.writelog({model:"users",operation:"LOGIN",user_id:data.id,pkey:data.id,details:"'USER_LOGGEDIN'"});
    console.log("We logged a user in: ", data);
    yield setSession(data.id, data.name, data.email, authToken, data.type, this.session);
    return true;
  }
  return false;
}


function *logout() {
  this.session.id = "";
  this.session.name = "";
  this.session.email = "";
  this.session.user = "";
  this.session.user_type = "";
}

function *checkUser(name){    
  var rows = (yield (this.pg.db.client.query_(`SELECT * FROM "users" where name = $1`, [name]))).rows;   
      console.log("rows",rows)    
      return rows;    
  }   


function *signup(name, email, access_token) {
  //Check if it exists first.
  var rows = (yield (this.pg.db.client.query_(`SELECT * FROM "users" WHERE email = $1`, [email]))).rows;
  if(rows.length == 1) {
    return false;
  }
  //TDOO nonquery
  rows = (yield (this.pg.db.client.query_(`INSERT INTO users(name, email, access_token) VALUES ('${name}', '${email}', '${access_token}') RETURNING id`))).rows;
  console.log("We just inserted a new user, got back ", rows, rows[0]);

  let logging = yield _auditlog.writelog({model:"users",operation:"CREATE",user_id:rows[0].id,pkey:rows[0].id,details:"'USER_CREATION'"});

  yield setSession(rows[0].id, name, email, access_token, 'user', this.session);
  //this.session.access_token = access_token;
  return true;
}


function *getUsers() {
  return (yield (this.pg.db.client.query_("SELECT * FROM users"))).rows;
}

function *getUserByID(id) {
  let query = "SELECT * FROM users WHERE id = $1 LIMIT 1";
  let conxData = yield coPg.connectPromise(connectionString);
  let client = conxData[0];
  let done = conxData[1];
  try {
    let response = yield client.queryPromise(query, [id]);
    done();
    if(response && response.rows && response.rows.length) {
      return yield Promise.resolve(response.rows[0]);
    }
    else
    {
      return yield Promise.resolve(null);
    }
  }
  catch(e) {
    console.error(e);
    done();
    return yield Promise.resolve(null);
  }
}


var user = {
  id:"",
  name: "",
  email:"",
  token:"",

  getUserByEmail: function(name) {

  },
  userExistsByEmail: function(email) {
    return false;
  },
  isAdmin: isAdmin,

  //TODO sanitize email?
  login: login,
  logout: logout,
  signup: signup,
  getUsers: getUsers,
  getUserByID,
  setSession,
  isLoggedIn: isLoggedIn,
 checkUser: checkUser
};
module.exports = user;
