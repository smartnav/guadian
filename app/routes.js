"use strict";

const route = require('koa-route');
const user = require('./models/user.js')
const _form = require('./models/form');
const _response = require('./models/response');
const uglify = require('uglify-js');
const URL = require('../config/url');
const _usergroup = require('./models/usergroup');
var bodyParser = require('koa-bodyparser');

const _auditlog = require('./models/auditlog'); // load audit log model
const _formbuilder = require('./models/formbuilder'); // load formbuilder model

let env = process.env;
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var CLIENT_ID = env.GOOGLE_CLIENT_ID;
var CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
var REDIRECT_URL = URL + '/auth/google/callback';
var API_KEY = env.GOOGLE_API_KEY;
var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
google.options({ auth: oauth2Client }); // set auth as a global default
var plus = google.plus('v1');




function *index() {
  console.log("Index:", this.session);
  yield this.render('index', {session:this.session || {}});
}

function *about() {
  // Here we have access to this.pg.db.client which is client returned from pg.connect().
  console.log('Starting about page load:')
  var result = yield this.pg.db.client.query_('SELECT now()')
  console.log('result:', result)
  this.body = result.rows[0].now.toISOString()
}

function *login() {
  console.log("Login Page");
  console.log(this.req, this.res);
  //TODO: flash message. req.flash('loginMessage')
  //yield this.render('login', {message: ""});
  this.redirect("/auth/google");
}

function *signup(){
  //TODO: flash message. req.flash('signupMessage')
  yield this.render('signup', {message: "", pageTitle: "Sign Up",session:this.session || {},});
}

function *signupNewUser() {
  console.log("this.request.body",this.request.body);
  if(this.request.body.name == "")
  {
    yield this.render('signup', {message: "Name is Required.", pageTitle: "Sign Up",session:this.session || {},});
    return;
  }

   if(this.request.body.name.length<3) {

   yield this.render('signup', {message: "Please enter a longer name.", pageTitle: "Sign Up",session:this.session || {},});
    return;
   }
   var inviteCodes = ["5d4f7c", "a886e8", "e5264e", "6dccfd", "8ffec5", "704177", "143772", "f3125c", "972e1c", "f6049e", "e551fd", "ed5c4b", "a1338d", "79aeb4", "ca3d6d", "85fae5", "30ccd2", "93c32f", "48c5a7", "7aa6a7"];
   if(inviteCodes.indexOf(this.request.body.invite_code) == -1) {
    yield this.render('signup', {message: "Invalid Invite Code", pageTitle: "Sign Up",session:this.session || {},});
    return;
   }




   var check = user.checkUser.bind(this);
   var result = yield check(this.request.body.name);
   console.log(result.length);
   if(result.length > 0 )
   {
    yield this.render('signup', {message: "Username already exists. please try with other name!", pageTitle: "Sign Up",session:this.session || {},});
   return;
   }

  //they have not attempted to login already:
  if(this.session.signupEmail == undefined) {
    this.session.authAction = "signup";
    this.session.signupName = this.request.body.name;
    this.redirect("/auth/google");
  }
  else {
    var signup = user.signup.bind(this);
    var success = yield signup(this.request.body.name, this.session.signupEmail, this.session.signupToken);
    if(success) {
      //TODO: Sanitize email?
      this.session.user = this.session.signupEmail;
      this.redirect('/dashboard');
    }
    else {
      //TODO: Announce something went wrong.
      yield this.render('signup', {message: "Email already exists. please try with other email id!", pageTitle: "Sign Up",session:this.session || {},});
      return;
    }
  }
}

function *adminDashboard(){
  if(! (yield (user.isLoggedIn.bind(this)))) {
    this.redirect('/login');
    return;
  }
  if(! (yield (user.isAdmin.bind(this)))) {
    this.redirect('/');
    return;
  }
  console.log("Admin Dashboard: ", this.session);

  yield this.render('admin-dashboard', {
    session:this.session || {},
    /*user:this.session.user,
    user_type:this.session.user_type,*/
    //forms:formsByOwner,
    //responses:latestResponsesForOwner,
    pageTitle: 'Admin',
    url: URL
  });
}

function *dashboard(){
  if(! (yield (user.isLoggedIn.bind(this)))) {
    this.redirect('/login');
    return;
  }

  console.log("dashboard: ", this.session);
  //var formsByOwner = yield _form.getByOwner(this.session.id, 100); //TODO: Hard limit forms allowed? Could be premium feature.
  //console.log("Query:", formsByOwner);
  //var latestResponsesForOwner = yield _response.getLatestByOwner(this.session.id,100);
  yield this.render('dashboard', {
    session:this.session || {},
    /*user:this.session.user,
    user_type:this.session.user_type,
    user_type:this.session.user_type,
    user_id:this.session.id,*/
    //forms:formsByOwner,
    //responses:latestResponsesForOwner,
    pageTitle: 'Dashboard',
    url: URL
  });
}


/*created by smartdata(nav)*/
function *groups(){
 yield this.render('groups', {
    session:this.session || {},
    pageTitle: 'Groups',
    url: URL
  });
}
/*end of this function*/

function *contact(){
 yield this.render('contact', {
    session:this.session || {},
    pageTitle: 'Contact Us',
    url: URL
  });
}

function *terms(){
 yield this.render('terms', {
    session:this.session || {},
    pageTitle: 'Terms',
    url: URL
  });
}

function *faq(){
 yield this.render('faq', {
    session:this.session || {},
    pageTitle: 'FAQ',
    url: URL
  });
}

function *logout() {
  //nullify the session
  user.logout();
  this.session = null;
  this.redirect('/');
}
function *googleAuth() {
  var scopes = [
    'email',
    'profile'
  ];

  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
    scope: scopes // If you only need one scope you can pass it as string
  });
  this.redirect(url);
}
function *googleAuthCallback() {
  if(this.session.authAction == undefined) {
    this.session.authAction = "login";
  }
  var p = Promise.defer();
  var code = this.request.query.code;

  oauth2Client.getToken(code, function(err, tokens) {
    // Now tokens contains an access_token and an optional refresh_token. Save them.
    if(!err) {
      p.resolve(tokens);
    }
  });
  var tokens = yield p.promise;
  oauth2Client.setCredentials(tokens);
  //get email, handle login here.

  var p2 = Promise.defer();
  plus.people.get({key:API_KEY, userId:'me'}, function(err, userReturned) {
    //console.log('Result: ' + (err ? err.message : userReturned.emails));
    if(err) {
      console.log("Error in Google Auth Callback " + err.message);
      console.log(err);
    }


    var primaryEmail = userReturned.emails[0].value;
    p2.resolve(primaryEmail);
  });
  var primaryEmail = yield p2.promise;

  if(this.session.authAction == "login") {
    this.session.authAction = null;
    var login = user.login.bind(this);
    var success = yield* login(primaryEmail, tokens);
    console.log("Was it a success?", success)
    if(success) {
      this.session.user = primaryEmail;
      this.redirect('/dashboard');
    }
    else {
      this.session.signupEmail = primaryEmail;
      this.session.signupToken = tokens.access_token;
      this.redirect("/signup");
    }
  }
  else if(this.session.authAction == "signup") {
    //comlete registration.
    this.session.authAction = null;
    var signup = user.signup.bind(this);
    var success = yield signup(this.session.signupName, primaryEmail, tokens.access_token);
    if(success) {
      //TODO: Sanitize email?
      this.session.user = this.session.primaryEmail;
      console.log("Authed the user, redirecting to dashboard")
      this.redirect('/dashboard');
    }
    else {
      //TODO: Announce something went wrong.
      console.log("Something went wrong with signed up user");
      this.redirect('/signup');
    }
  }
}

function *getUsers() {
  var getUsers = user.getUsers.bind(this);
  var u = yield getUsers();
  this.body = u;
}

function *getForms() {
  var u = yield _form.getForms();
  this.body = u;
}
function *getReviews() {
  var u = yield _response.getReviews();
  this.body = u;
}


function *createForm(){
  if(! (yield (user.isLoggedIn.bind(this)))) {
    this.redirect('/login');
    return;
  }

   yield this.render('./form/new',{session:this.session || {}, pageTitle: 'New Form', newForm:true,message:""});
}
function *saveForm(){
 var data = this.request.body;
 var re = /^(http[s]?:\/\/){0,1}(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/;

  if(data.facility == "")
  {
   yield this.render('./form/new',{session:this.session || {}, pageTitle: 'New Form', newForm:true,message:"Please Fill in all the required Fields"});
   return;
  }
  if(data.yelp!="" && !re.test(data.yelp))
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'New Form', newForm:true,message:"Please enter a valid Yelp Url"});
   return;
  }
  if(data.google_plus!="" && !re.test(data.google_plus))
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'New Form', newForm:true,message:"Please enter a valid Google Plus Url"});
   return;
  }
  if(data.caring!="" && !re.test(data.caring))
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'New Form', newForm:true,message:"Please enter a valid Caring.com Url"});
   return;
  }
  if(data.redirect_url!="" && !re.test(data.redirect_url))
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'New Form', newForm:true,message:"Please enter a valid Redirect Url"});
   return;
  }
  if(data.allowed_origins!="" && !re.test(data.allowed_origins))
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'New Form', newForm:true,message:"Please enter a valid Form Location Url"});
   return;
  }
  else{
    var lastInsertedId = yield _form.create(this.session.id, this.request.body);
    this.redirect("/formbuilder/"+lastInsertedId);
}
}
function *shareForm(){
  if(! (yield (user.isLoggedIn.bind(this)))) {
    this.redirect('/login');
    return;
  }

  yield this.render('./form/share',{session:this.session || {}, url: URL, pageTitle: 'Share Form'});
}

function *editFacility(id) {

  let data = yield _form.get(id);

  if(data === null) {
    this.status = 404;
    return;
  }
  var ownerCheck = yield _form.chkFromGroup(this.session.id,id);
    if (ownerCheck == 0) {
      if(this.session.id!=data.owner_id)
      {
      this.redirect('/dashboard');
      return;
    }
  }

  yield this.render('./form/new',{session:this.session || {}, pageTitle: 'Edit Form', newForm:false, existingForm:data, message:""});
}

function *saveFacilityEdits(id) {
  console.log("this.request.body",this.request.body);
  var data = this.request.body;
  let datas = yield _form.get(id);
  var ownerCheck = yield _form.chkFromGroup(this.session.id,id);
  if(ownerCheck==0)
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'Edit Form', newForm:false, existingForm:datas, message:"You do not have permission to edit this form."});
   return;
  }
  datas.yelp = data.yelp;
  datas.google_plus = data.google_plus;
  datas.caring = data.caring;
  var re = /^(http[s]?:\/\/){0,1}(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/;

  if(data.facility == "")
  {
   yield this.render('./form/new',{session:this.session || {}, pageTitle: 'Edit Form', newForm:false, existingForm:datas, message:"Please Fill in all the required Fields"});
   return;
  }
  if(data.yelp!="" && !re.test(data.yelp))
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'Edit Form', newForm:false, existingForm:datas, message:"Please enter a valid Yelp Url"});
   return;
  }
  if(data.google_plus!="" && !re.test(data.google_plus))
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'Edit Form', newForm:false, existingForm:datas, message:"Please enter a valid Google Plus Url"});
   return;
  }
  if(data.caring !="" && !re.test(data.caring))
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'Edit Form', newForm:false, existingForm:datas, message:"Please enter a valid Caring.com Url"});
   return;
  }
  if(data.redirect_url!="" && !re.test(data.redirect_url))
  {
    yield this.render('./form/new',{session:this.session || {}, pageTitle: 'Edit Form', newForm:false, existingForm:datas, message:"Please enter a valid Redirect Url"});
   return;
  }
  var success = yield _form.saveFacilityData(this.session.id, id, data);
  //TODO alert for failure
  console.log("We had a :", success);
  this.body = "Success";
  this.set({'Content-Type': 'application/json'});
  this.redirect("/dashboard");
  return;
}


function *form(id) {
  let data = yield _form.get(id);
  if(data === null) {
    this.status = 404;
    return;
  }
  /*let origins = data.allowed_origins || [''];
  let from = this.request.header.origin;
  let allowed = origins.indexOf(from) !== -1 ? from : origins[0];*/
  let  questions = yield _formbuilder.getQuestions(id);
  console.log(questions,'questions')
  this.set('Access-Control-Allow-Origin','*');
  /*this.set({
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Origin': allowed,
    'X-Frame-Options': `ALLOW-FROM ${allowed}`
  });*/
  var template = this.request.query.hasOwnProperty('m') ? 'form' : 'form-full';
  yield this.render(template, {
    type: data.type,
    status: data.status,
    questions : questions,
    nonce: yield _form.nonce.create(data.id, false),
    isPartial: this.request.query.hasOwnProperty('m'),
    // TODO—doesn't account for non-SSL traffic and relies entirely on client
    // to generate URL
    url: URL,
    postback: `${URL}/form/${id}`,
    layout: false,
    session: {},
    error: ""
  });
}



function *formSubmit(id) {
  let data = this.request.body;
  console.log("Submitted Form",data);
  var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  var illegalChars = /^[a-zA-Z\s]+$/;
  var stripped = data.phone.replace(/[\(\)\.\-\ ]/g, '');
  var flag=0;
  var message = "";
  for(var i in data){
    if(data[i].length > 5000)
    {
      flag=1;
      message="Questions cannot exceed 5000 characters.";
      console.log("in here");
    }
  }
  if((data.name == "" || data.email == "") && flag!=1)
  {
    flag=1;
    message="Please Fill in the Required Fields"; 
  }
  else if( data.name.length<3 )
  {
    flag=1;
    message="Please enter a longer name for the form.";
  }
  else if( data.name.length>50 )
  {
    flag=1;
    message="Please enter a shorter name for the form.";
  }
  else if( !illegalChars.test(data.name) )
  {
    flag=1;
    message="Only letters are permitted here.";
  }
  else if( !re.test(data.email) )
  {
    flag=1;
    message="Please enter a Valid Email.";
  }
  else if( data.phone != "" && isNaN(parseInt(stripped)) )
  {
    flag=1;
    message="Please enter a valid Phone Number.";
  }
  else if( data.phone != "" &&  (stripped.length < 6 || stripped.length > 20 ))
  {
  	flag=1;
  	message="Please enter a valid Phone Number.";
  }
  else
  {
  }
  if(flag==1)
  {
  // 	let data = yield _form.get(id);
  // 	let  questions = yield _formbuilder.getQuestions(id);
  // 	this.set('Access-Control-Allow-Origin','*');
  // 	var template = this.request.query.hasOwnProperty('m') ? 'form' : 'form-full';
  // 	yield this.render(template, {
  //   type: data.type,
  //   status: data.status,
  //   questions : questions,
  //   nonce: yield _form.nonce.create(data.id, false),
  //   isPartial: this.request.query.hasOwnProperty('m'),
  //   // TODO—doesn't account for non-SSL traffic and relies entirely on client
  //   // to generate URL
  //   url: URL,
  //   postback: `${URL}/form/${id}`,
  //   layout: false,
  //   session: {},
  //   error: message
  // });
  this.body = JSON.stringify({message:message})
  this.status = 404;
        this.set({
    'Content-Type': 'application/javascript'
  });
  return;
  }
  else{
    data.ip = this.request.ip;
    let result;
    data.phone = stripped;
    let fdata = yield _form.get(id) || {};
    if(fdata.status=="unpublished")   
      {   
        yield this.render('unpublished',{layout: false});   
        this.status = 400;    
        return;   
      }
    console.log("We got fdata", fdata);
    let redirect = fdata.redirect_url || '/thanks';
    this.session = {
      facilityName : fdata.facility
    }
  
  
    if(fdata.status == 'published') {
      try {
        result = yield _form.receive(id, data.nonce, data);
        console.log('result _________________',result);
      }catch(e) {
        if(e instanceof _form.nonce.InvalidNonce) {
          // silently fail.
          this.redirect(redirect);
          return;
        }
        else
        {
          yield this.render('400', {layout:false});
          this.status = 400;
          console.error(e);
          return;
        }
      }
    } else { //form is not published, send 403 error.
      yield this.render('403', {layout:false});
      this.status = 403;
      return;
    }
    if(!result) {
      yield this.body = JSON.stringify({message:"Failed"})
      return;
    }
    else
    {
    	 if(redirect=='/thanks'){
      this.body = JSON.stringify({message:"Success"})
      this.set({
    'Content-Type': 'application/javascript'
  });
      return;
    	//  	yield this.render(redirect, {
  	  //   layout: false,
  	  //   facility : fdata.facility,
  	  // });
  
       }
       else{
        this.body = JSON.stringify({message:"Success"})
        this.set({
    'Content-Type': 'application/javascript'
  });
      return;
       	// this.redirect(redirect)
       }
    }
}
}


function *clientjsForm(id) {
  yield this.render('clientjs-form', {url: require('../config/url'), layout: false});
  this.body = uglify.minify(this.body, {fromString: true}).code;
  this.set({
    'Content-Type': 'application/javascript'
  });
}

function *clientjsResponse(id) {
  yield this.render('clientjs-response', {url: require('../config/url'), layout: false});
  this.body = uglify.minify(this.body, {fromString: true}).code;
  this.set({
    'Content-Type': 'application/javascript'
  });
}


/*
  We've capped review pulling to 5 at the max, default = 1
*/
function *reviewbox(formid) {
  let f = yield _form.get(formid);
  if(!f) {
    return this.throw('404 / Not Found', 404);
  }
  this.set('Access-Control-Allow-Origin','*');
  var amountOfReviewsToFetch = typeof this.request.query.limit == 'undefined' ? 1 : Math.min(this.request.query.limit, 5)
  yield this.render("review-box", {
    layout: false,
    url: URL,
    facility: f.facility,
    maxlength: 140,
    reviews: yield _response.getApprovedTextResponses(formid, amountOfReviewsToFetch),
    //average: yield _response.getAverageValue(formid, "recommend"),
    average:null,
    max: 5
  });
}




/* Rahul For Pagination Task */
function *getResponses()
{
    var offset = this.request.body.offset;
    var limit = this.request.body.limit;
    offset = limit*(offset-1)
    this.status = 200;
    var latestResponsesForOwner = yield _response.getLatestByOwner(this.session.id,limit,offset);
    this.body = JSON.stringify(latestResponsesForOwner);
    this.set({'Content-Type': 'application/json'});
}


function *getResponsesCount()
{
    this.status = 200;
    var latestResponsesForOwner = yield _response.getCountLatestByOwner(this.session.id);
    this.body = JSON.stringify(latestResponsesForOwner);
    this.set({'Content-Type': 'application/json'});
}
/* Rahul For Pagination Task */

/* Rahul For Active Forms Pagination Task */
function *getActiveForms()
{
    var offset = this.request.body.offset;
    var limit = this.request.body.limit;

    offset = limit*(offset-1)

    this.status = 200;
    var activeForms = yield _form.getByOwner(this.session.id,limit,offset);
    this.body = JSON.stringify(activeForms);
    this.set({'Content-Type': 'application/json'});
}


function *getActiveFormsCount()
{
    this.status = 200;
    var activeForms = yield _form.getCountByOwner(this.session.id);
    console.log(activeForms,'activeForms')
    this.body = JSON.stringify(activeForms);
    this.set({'Content-Type': 'application/json'});
}
/* Rahul For Active Forms Pagination Task */

/* Rahul Response Toggle Status */
function *toggleStatus() {
var ownerCheck = yield _form.chkFromGroup(this.session.id,this.request.body.id);
    if (ownerCheck == 0) {
      if(this.session.id!=this.request.body.owner_id)
      {
      this.status = 400;
      this.render('400');
    }
  }
    var model = this.request.body.model;
    var status = "'"+this.request.body.status+"'";
    let val = '';
    if(model=='forms')
      val =  yield _form.toggleStatus(this.session.id,this.request.body.id,status,this.request.body.coutRes);
    else
      val = yield _response.toggleStatus(this.session.id,this.request.body.id,status);
  
    if(val) {
      this.status = 200;
      this.body = JSON.stringify({changed:this.request.body.id});
      this.set({'Content-Type': 'application/json'});
    }
    else
    {
      this.status = 400;
      this.render('400');
    }
  
}
/* Rahul Response Toggle Status */

/* Rahul for Update Response  */
function *updateResponse() {

      if(this.request.body.response_text.length>5000)
      {
        this.status = 400;
      this.render('400');
      return; 
      }
    var ownerCheck = yield _form.chkFromGroup(this.session.id,this.request.body.formid);
    if (ownerCheck == 0) {
      if(this.session.id!=this.request.body.owner_id)
      {
        this.status = 400;
    this.render('400');
      return;
    }
  }
  // var id = this.request.body.id;
  // var comments = "'"+this.request.body.comments+"'";
let val =  yield _response.updateResponse(this.request.body);
  if(val) {
    this.status = 200;
    this.body = JSON.stringify({updated:val});
    this.set({'Content-Type': 'application/json'});
  }
  else
  {
    this.status = 400;
    this.render('400');
  }


}
/* Rahul for Update Response  */


/* Rahul For Logs */
function *getLogs()
{
    var offset = this.request.body.offset;
    var limit = this.request.body.limit;

    offset = limit*(offset-1)

    this.status = 200;
    var logs = yield _auditlog.getLogs(limit,offset);
    this.body = JSON.stringify(logs);
    this.set({'Content-Type': 'application/json'});
}


function *getLogsCount()
{
    this.status = 200;
    var logs = yield _auditlog.getLogsCount();
    this.body = JSON.stringify(logs);
    this.set({'Content-Type': 'application/json'});
}
/* Rahul For Logs */

/* Rahul for Form Specific Responses */

function *formResponses(id){
  if(! (yield (user.isLoggedIn.bind(this)))) {
    this.redirect('/login');
    return;
  }
  let result = yield _form.get(id);
var ownerCheck = yield _form.chkFromGroup(this.session.id,id);
    if (ownerCheck == 0) {
      if(this.session.id!=result.owner_id)
      {
      this.redirect('/dashboard');
      return;
    }
  }
  yield this.render('form/responses', {
    session:this.session || {},
    pageTitle: 'Form Specific Responses',
    formid   : id
  });
}



function *getApprovedResponses()
{
    var offset = this.request.body.offset;
    var limit = this.request.body.limit;

    offset = limit*(offset-1)
    this.status = 200;
    var latestResponsesForOwner = yield _response.getApprovedResponsesByOwner(this.session.id,limit,offset);
    this.body = JSON.stringify(latestResponsesForOwner);
    console.log(this.body);
    this.set({'Content-Type': 'application/json'});
}


function *getApprovedResponsesCount()
{
    this.status = 200;
    var latestResponsesForOwner = yield _response.getApprovedResponsesCountByOwner(this.session.id);
    this.body = JSON.stringify(latestResponsesForOwner);
    this.set({'Content-Type': 'application/json'});
}





function *getFormResponses()
{
    let result = yield _form.get(this.request.body.formid);
    var ownerCheck = yield _form.chkFromGroup(this.session.id,this.request.body.formid);
    if (ownerCheck == 0) {
      if(this.session.id!=result.owner_id)
      {
      this.redirect('/dashboard');
      return;
    }
  }
    var offset = this.request.body.offset;
    var limit = this.request.body.limit;
    var formid = this.request.body.formid;
    var status = this.request.body.status;

    offset = limit*(offset-1)
    this.status = 200;
    var latestResponsesForOwner = yield _response.getFormResponsesByOwner(this.session.id,formid,status,limit,offset);
    this.body = JSON.stringify(latestResponsesForOwner);
    
    
    this.set({'Content-Type': 'application/json'});
}


function *getFormResponsesCount()
{
    let result = yield _form.get(this.request.body.formid);
var ownerCheck = yield _form.chkFromGroup(this.session.id,this.request.body.formid);
    if (ownerCheck == 0) {
      if(this.session.id!=result.owner_id)
      {
      this.redirect('/dashboard');
      return;
    }
  }
    this.status = 200;
    var formid = this.request.body.formid;
    var status = this.request.body.status;
    var latestResponsesForOwner = yield _response.getFormResponsesCountByOwner(this.session.id,formid,status);
    this.body = JSON.stringify(latestResponsesForOwner);
    
    this.set({'Content-Type': 'application/json'});
}

function *shareResponses(){
  if(! (yield (user.isLoggedIn.bind(this)))) {
    this.redirect('/login');
    return;
  }

  yield this.render('./responses/share',{session:this.session || {}, url: URL, pageTitle: 'Share Responses'});
}

function *showAllResponses() {
  if(! (yield (user.isLoggedIn.bind(this)))) {
    this.redirect('/login');
    return;
  }
  console.log("Show responses");
  yield this.render('./responses/all',{session:this.session || {}, url: URL, pageTitle: 'All Responses'});
}

/* Rahul for Form Specific Responses */

/* Rahul for form builder */

function *buildForm(formid){

  if(! (yield (user.isLoggedIn.bind(this)))) {
    this.redirect('/login');
    return;
  }
  let result = yield _form.get(formid);
  var ownerCheck = yield _form.chkFromGroup(this.session.id,formid);
    if (ownerCheck == 0) {
      if(this.session.id!=result.owner_id)
      {
      this.redirect('/dashboard');
      return;
    }
  }
  
  yield this.render('form-builder', {
    pageTitle: 'Build Form for Responses',
    formid   : formid,
    owner_id : result.owner_id,
    session:this.session || {},
  });
}

function *saveBuild() {
  var ownerFlag = 0;
  var ownerCheck = yield _form.chkFromGroup(this.session.id,this.request.body.formId);
  //if (this.request.body.owner_id) {
    
      if(ownerCheck == 0)
      {
        ownerFlag = 1;
      }
  //}
  if (ownerFlag == 1) {
    this.status = 400;
    this.render('400');
  }
      else{
      var param = {};
      param.formid = this.request.body.formId;
      param.question = this.request.body.question;
      param.orderid = this.request.body.orderid;
      param.qtype = this.request.body.qtype;
      param.is_hide = this.request.body.is_hide;
      let  val = yield _formbuilder.saveQuestion(param);

      if(val) {
      this.status = 200;
      this.body = JSON.stringify(val);
      this.set({'Content-Type': 'application/json'});
      }
      else
      {
      this.status = 400;
      this.render('400');
      }
    }

}

function *listBuild() {

    var formid = this.request.body.formId;
           
    let  val = yield _formbuilder.getQuestions(formid);

    if(val) {
    this.status = 200;
    this.body = JSON.stringify(val);
    this.set({'Content-Type': 'application/json'});
  }
  else
  {
    this.status = 400;
    this.render('400');
  }
       
}

function *removeQuestion() {
var ownerCheck = yield _form.chkFromGroup(this.session.id,this.request.body.formid);
    if (ownerCheck == 0) {
      if(this.session.id!=this.request.body.owner_id)
      {
      this.status = 400;
    this.render('400');
      return;
}
}
            var formid  = this.request.body.formId;
            var orderid = this.request.body.orderid;       
            var param   = {formid:formid,orderid:orderid}; 
            let  val = yield _formbuilder.removeQuestion(param);
      
            if(val) {
            this.status = 200;
            this.body = JSON.stringify(val);
            this.set({'Content-Type': 'application/json'});
          }
          else
          {
            this.status = 400;
            this.render('400');
          }
        

}


function *isQuestionExist()
{
    this.status = 200;
    var formid  = this.request.body.formId;
    var logs = yield _formbuilder.isQuestionExist(formid);
    this.body = JSON.stringify(logs);
    this.set({'Content-Type': 'application/json'});
}

function *isResponseReceived() {

    this.status = 200;
    var formid  = this.request.body.formId;
    var logs = yield _formbuilder.isResponseReceived(formid);
    this.body = JSON.stringify(logs);
    this.set({'Content-Type': 'application/json'});

}


function *getGeneratedEmailText(formid,responseid) {
  var ownerCheck = yield _form.chkFromGroup(this.session.id,formid);
    if (ownerCheck == 0) {
      if(this.session.id!=data.owner_id)
      {
      this.status = 400;
        this.render('400');
      return;
    }
  }
      let val =  yield _response.getGeneratedEmail(formid,this.session.id,responseid);
      let data = yield _form.get(formid);
      let res = yield _response.getEmailId(formid,responseid);
      console.log("res",res);
      console.log("val",val);
      console.log("data",data);
      if(val) {

        this.status = 200;
        this.body = JSON.stringify({emailData:val,data:data,res});
        this.set({'Content-Type': 'application/json'});
      }
      else {
        this.status = 400;
        this.render('400'); 
      }
}


function *sendGeneratedEmailText(formid,responseid) {
  var emailBody  = this.request.body.email;
  let result = yield _response.checkContactedStatus(this.session.id,responseid);
  if(result[0].contacted_status==0)
    {
      var contacted_status = 1;
  let val =  yield _response.sendGeneratedEmail(formid,this.session.id,responseid, emailBody);
  if(val) {
    yield _response.updateContactedStatus(this.session.id,responseid,contacted_status);
    this.status = 200;
    this.body = JSON.stringify({success:"true"});
    this.set({'Content-Type': 'application/json'});
  }
  else {
    this.status = 400;
    this.render('400'); 
  }
}
  else
  {
    this.status =400;
    this.render('400');
  }
}

function *createGroup() {
  console.log("group name",this.request.body);

  if(this.request.body.name=="" || !this.request.body.name)
  {
    this.body = JSON.stringify({message:"Please enter a group name."});
    this.set({'Content-Type': 'application/json'});
    return;
  }

    let check = yield _usergroup.checkname(this.session.id,this.request.body.name);
  if(check)
  {
    this.body = JSON.stringify({message:"Group already exists. Please select a different group name."});
    this.set({'Content-Type': 'application/json'});
    return;
  }
  let result = yield _usergroup.creategroup(this.session.id,this.request.body,this.session.email);
  if(result){
    this.body = JSON.stringify({success:"true"});
    this.set({'Content-Type': 'application/json'});
  }
}

function *showGroup() {
  console.log("in showgroup")
  let result = yield _usergroup.showgroup(this.session.id);
  if(result){
    this.body = JSON.stringify({result});
    this.set({'Content-Type': 'application/json'});
  }
  else
  {
    this.status = 400;
    this.render('400');
  }
}

function *updateGroup() {
  console.log(this.request.body);
  let result = yield _form.updateGroupId(this.request.body);
  if(result){
    this.body = JSON.stringify({result});
    this.set({'Content-Type': 'application/json'});
  }
  else
  {
    this.status = 400;
    this.render('400');
  }
}

function *getGroupFormsCount()
{
    this.status = 200;
    var activeForms = yield _usergroup.getCountByGroup(this.session.id);
    console.log(activeForms,'groupForms')
    this.body = JSON.stringify(activeForms);
    this.set({'Content-Type': 'application/json'});
}

function *getShareForms() {
  var offset = this.request.body.offset;
  var limit = this.request.body.limit;
  offset = limit*(offset-1)
  let result = yield _usergroup.getFormByGroupId(this.session.id,limit,offset);
  var activeForms = yield _form.getByOwner(this.session.id,limit,offset);
  for(var i in activeForms){
    result.push(activeForms[i]);
  }
  if(result){
    this.body = JSON.stringify({result});
    this.set({'Content-Type': 'application/json'});
  }
  else
  {
    this.status = 400;
    this.render('400');
  }
}

function *getFormByGroupId() {
  var offset = this.request.body.offset;
  var limit = this.request.body.limit;

    offset = limit*(offset-1)
  let result = yield _usergroup.getFormByGroupId(this.session.id,limit,offset);
  if(result){
    this.body = JSON.stringify({result});
    this.set({'Content-Type': 'application/json'});
  }
  else
  {
    this.status = 400;
    this.render('400');
  }
}

/* Smartdata*/
function *add_group() {
  //console.log('-------------------------------------------',this.session);
    let val =  yield _form.addGroup(this.session,this.request.body.group_name);
    if(val) {
      this.status = 200;
      this.body = JSON.stringify({changed:this.request.body.id});
      this.set({'Content-Type': 'application/json'});
    }
    else
    {
      this.status = 400;
      this.render('400');
    }
}


function *get_group() {
    let val =  yield _form.getGroup(this.session.id);
    console.log(val);
    if(val) {
      this.status = 200;
      this.body = JSON.stringify({val});
      this.set({'Content-Type': 'application/json'});
    }
    else
    {
      this.status = 400;
      this.render('400');
    }
}


function *addUser() {
    let val =  yield _usergroup.addUser(this.session.id,this.request.body.userEmail,this.request.body.groupID);
        if(val>0)
    {
      this.body = JSON.stringify({value:val});
      this.set({'Content-Type': 'application/json'});
}
    else if(val==0)
{
      this.body = JSON.stringify({value:val});
 this.set({'Content-Type': 'application/json'});
     }
    else
    {
      this.status = 400;
      this.render('400');
    }
}


function *delUser() {
    let val =  yield _usergroup.delUser(this.session.id,this.request.body.userID,this.request.body.groupID);
    console.log(val);
    if(val) {
      this.status = 200;
      this.body = JSON.stringify({message:"Successfully Deleted User."});
      this.set({'Content-Type': 'application/json'});
    }
    else
    {
      this.status = 400;
      this.render('400');
    }
}

function *delGroup() {
    let val =  yield _usergroup.delGroup(this.request.body.groupID);
    console.log(val);
    if(val) {
      this.status = 200;
      this.body = JSON.stringify({message:"Successfully Deleted Group."});
      this.set({'Content-Type': 'application/json'});
    }
    else
    {
      this.status = 400;
      this.render('400');
    }
}

function *leaveGroup() {
  let val = yield _usergroup.leaveGroup(this.request.body);
  if(val) {
      this.status = 200;
      this.body = JSON.stringify({message:"Successfully Leaved Group."});
      this.set({'Content-Type': 'application/json'});
    }
    else
    {
      this.status = 400;
      this.render('400');
    }
}

/* Rahul Response Toggle Status */






/* Rahul for form builder */

module.exports = function(app) {
  //console.log("Authentification done by", passport.authenticate);
  app.use(route.get('/', index));
  app.use(route.get('/about', about));

  app.use(route.get( '/form/new', createForm));
  app.use(route.post('/form/new', saveForm));
  app.use(route.get( '/form/share', shareForm));
  app.use(route.get( '/form/:id', form));
  app.use(route.post('/form/:id', formSubmit));
  app.use(route.get( '/form/:id/facility', editFacility));
  app.use(route.post('/form/:id/facility', saveFacilityEdits));
  app.use(route.get( '/form/:id/email/:responseid', getGeneratedEmailText));
  app.use(route.post('/form/:id/email/:responseid', sendGeneratedEmailText));
  app.use(route.get( '/form/:id/responses', formResponses));
  
  app.use(route.get( '/responses/share', shareResponses));
  app.use(route.get( '/responses/all', showAllResponses));
  app.use(route.get( '/responses/:id', reviewbox));
  

  app.use(route.get('/login', login));
  app.use(route.get('/logout', logout));
  app.use(route.get('/signup', signup));
  app.use(route.post('/signup', signupNewUser));
  app.use(route.get('/auth/google', googleAuth));
  app.use(route.get('/auth/google/callback', googleAuthCallback));

  app.use(route.get('/dashboard', dashboard));
  
  app.use(route.get('/groups', groups));
  app.use(route.get('/contact', contact));
  app.use(route.get('/faq',faq));
  app.use(route.get('/terms',terms));
  app.use(route.get('/admin', adminDashboard));
  
  app.use(route.get('/users', getUsers)); //TODO: remove this.
  app.use(route.get('/forms', getForms)); //TODO: remove this.
  app.use(route.get('/reviews', getReviews)); //TODO: remove this.

  app.use(route.get('/review-box/:formid', reviewbox)); //TODO: remove this. Replaced with responses/:id
  
  app.use(route.get('/js/form.js', clientjsForm));
  app.use(route.get('/js/responses.js', clientjsResponse));
  app.use(require('koa-static')(__dirname + '/../public'));


  /* Rahul */
  app.use(bodyParser());
  app.use(route.get('/getResponsesCount', getResponsesCount));
  app.use(route.post('/getResponses', getResponses));
  /* Rahul */

  /* Rahul For Active Forms Pagination*/
  app.use(route.get('/getActiveFormsCount', getActiveFormsCount));
  app.use(route.post('/getActiveForms', getActiveForms));
  /* Rahul For Active Forms Pagination*/

  /* Rahul for  Response Toggle Status */
  app.use(route.post('/review/togglestatus', toggleStatus));
  /* Rahul for  Response Toggle Status */

  /* Rahul for  Update Response  */
  app.use(route.post('/review/updateResponse', updateResponse));
  /* Rahul for  Update Response  */


  /* Rahul For Logs*/
  app.use(route.get('/getLogsCount', getLogsCount));
  app.use(route.post('/getLogs', getLogs));
  /* Rahul For Logs*/

  /* Rahul for Form Specific Responses */
  
  app.use(route.post('/getApprovedResponsesCount', getApprovedResponsesCount));
  app.use(route.post('/getApprovedResponses', getApprovedResponses));


  app.use(route.post('/getFormResponsesCount', getFormResponsesCount));
  app.use(route.post('/getFormResponses', getFormResponses));
  /* Rahul for Form Specific Responses */

  /* Rahul for form builder */
  app.use(route.get('/formbuilder/:formid', buildForm));
  app.use(route.post('/formbuilder/isquestionexist', isQuestionExist));
  app.use(route.post('/formbuilder/save', saveBuild));
  app.use(route.post('/formbuilder/list', listBuild));
  app.use(route.post('/formbuilder/remove', removeQuestion));
  app.use(route.post('/formbuilder/isresponsereceived', isResponseReceived));
  /* Rahul for form builder */

  /* smartData for user groups */
  app.use(route.post('/usergroup/add', createGroup));
  app.use(route.get('/usergroup/show', showGroup));
  app.use(route.post('/usergroup/update',updateGroup));
  app.use(route.post('/usergroup/form',getFormByGroupId));
  app.use(route.get('/getGroupFormsCount',getGroupFormsCount));
  app.use(route.post('/usergroup/Leavegroup',leaveGroup));
  app.use(route.post('/usergroup/getgroups',getShareForms));
  /* smartData for user groups */


 app.use(route.post('/groups/add_group', add_group));
  app.use(route.post('/groups/get_group', get_group));
  app.use(route.post('/groups/addUser', addUser));
  app.use(route.post('/groups/delUser', delUser));
  app.use(route.post('/groups/delGroup', delGroup));
  // NOTE: only available in testing suite
  if(process.env.TEST === 'true') {
    app.use(route.get('/proxylogin/:userid', function*(id){
      let u = yield user.getUserByID(id);
      if(u) {
        yield user.setSession(u.id, u.name, u.email, null, this.session);
      }
    }));
  }
};
