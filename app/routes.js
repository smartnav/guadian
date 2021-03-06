"use strict";

const route = require('koa-route');
const user = require('./models/user.js')
const _form = require('./models/form');
const _response = require('./models/response');
const uglify = require('uglify-js');
const URL = require('../config/url');

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
  if(this.request.body.name == "")
  {
    yield this.render('signup', {message: "Name is Required.", pageTitle: "Sign Up",session:this.session || {},});
    return;
  }

   if(this.request.body.name.length<4) {

   yield this.render('signup', {message: "Name Should be 4 Characters Long.", pageTitle: "Sign Up",session:this.session || {},});
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
      this.redirect('/signup');
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

   yield this.render('./form/new',{session:this.session || {}, pageTitle: 'New Form', newForm:true,error:""});
}
function *saveForm(){
 var data = this.request.body;
  //if(data.facility == "" | data.yelp == "" | data.google_plus == "")
  //{
  //  yield this.render('./form/new',{session:this.session || {}, pageTitle: 'New Form', newForm:true,error:"Please Fill in all the required Fields"});
  //  return;
  //}
  //else{
    var lastInsertedId = yield _form.create(this.session.id, this.request.body);
    this.redirect("/formbuilder/"+lastInsertedId);
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
  console.log(data);
  yield this.render('./form/new',{session:this.session || {}, pageTitle: 'Edit Form', newForm:false, existingForm:data});
}

function *saveFacilityEdits(id) {
  console.log("this.request.body",this.request.body);
  var data = this.request.body.data;
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
    session: {}
  });
}



function *formSubmit(id) {
  let data = this.request.body;
  data.ip = this.request.ip;
  let result;
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
    yield this.render('400', {layout:false});
    this.status = 400;
    return;
  }
  else
  {
  	 if(redirect=='/thanks'){

  	 	yield this.render(redirect, {
	    layout: false,
	    facility : fdata.facility,
	  });

  	 }
     else{
     	this.redirect(redirect)
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
  var data = this.request.body.data;    
    console.log(data);    
    if(data[0].owner_id!=this.session.id)   
    {   
      this.status = 400;    
      this.render('400');   
      return;   
    }
  var id = this.request.body.id;
  var comments = "'"+this.request.body.comments+"'";
let val =  yield _response.updateResponse(this.session.id,id,comments,data);
  if(val) {
    this.status = 200;
    this.body = JSON.stringify({updated:id});
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

  
  yield this.render('form-builder', {
    pageTitle: 'Build Form for Responses',
    formid   : formid,
    session:this.session || {},
  });
}

function *saveBuild() {

    var param = {};
    param.formid = this.request.body.formId;
    param.question = this.request.body.question;
    param.orderid = this.request.body.orderid;
    param.qtype = this.request.body.qtype;
    if(this.request.body.is_hide=="true")   
      param.is_hide=true;     
      else    
        param.is_hide=false;    
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
  
      let val =  yield _response.getGeneratedEmail(formid,this.session.id,responseid);
      let data = yield _form.get(formid);
      console.log("val",val);
      console.log("data",data);
      if(val) {

        this.status = 200;
        this.body = JSON.stringify({email:val,data:data});
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
  }}
  else
  {
    this.status =400;
    this.render('400');
  }
}



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
