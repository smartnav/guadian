'use strict';

const app = require('./node-basic');
const request = require('supertest').agent(app.listen());
const assert = require('assert');
const cheerio = require('cheerio');
const co = require('co');
const randomstring = require('randomstring');
const err = require('./app/errors');

// errorType may be null for just catching generic errors
let assertGenThrows = co.wrap(function*(yieldable, errorType, message){
  if(typeof errorType === "string") {
    message = errorType;
    errorType = null;
  }
  try {
    yield yieldable;
  }catch(e) {
    if(errorType) {
      if(e instanceof errorType) {
        return yield Promise.resolve(true);
      }
      let _default = "Error type expected but not found.";
      return yield Promise.reject(new Error(message || _default));
    }
    return yield Promise.resolve(true);
  }
  let _default = "Yieldable did not provide an error.";
  return yield Promise.resolve(message || _default);
});

// verifies the existence of an element in the given HTML
function $(selector) {
  return function(response) {
    let _ = cheerio.load(response.res.text);
    if(!_(selector).length) {
      throw new Error(`Could not find "${selector}"`);
    }
    return true;
  }
}

// verifies the nonexistence of a selector
function $not(selector) {
  return function(response) {
    try {
      $(selector)(response);
      throw new Error(`Selector "${selector}" present`);
    }catch(error) {
      return true;
    }
  }
}

describe('/js/form.js', ()=> {
  beforeEach(function() {
    delete require.cache[require.resolve('./config/url')];
  });
  it('should be templated with the correct port', (done)=> {
    process.env.PROTOCOL = randomstring.generate(4);
    process.env.DOMAIN = randomstring.generate();
    process.env.PORT = randomstring.generate({length: 4, charset: 'numeric'});

    request
    .get('/js/form.js')
    .expect('Content-Type', 'application/javascript')
    .expect(new RegExp(process.env.PROTOCOL + ':\/\/' + process.env.DOMAIN + ':'
          + process.env.PORT))
    .end(done);
  });
 
  it('should hide the port if HIDE_PORT is set', (done)=> {
    process.env.PROTOCOL = randomstring.generate(4);
    process.env.DOMAIN = randomstring.generate();
    process.env.PORT = randomstring.generate({length: 4, charset: 'numeric'});
    process.env.HIDE_PORT = true;

    request
    .get('/js/form.js')
    .expect('Content-Type', 'application/javascript')
    .expect(new RegExp(process.env.PROTOCOL + ':\/\/' + process.env.DOMAIN))
    .end(done);
  });
});

describe('index', ()=> {
  it('should give a 200 status code', (done)=> {
    request
    .get('/')
    .expect(200, done);
  });
});

describe('/css/form.css', ()=> {
  it('should exist', (done)=> {
    request
    .get('/css/form.css')
    .expect(200, done);
  });
});

function retrieveNonce(formid) {
  let deferred = Promise.defer();
  request.get(`/form/${formid}`).end((err, response)=>{
    let _ = cheerio.load(response.text);
    let nonce = _('input[name=nonce]').val();
    deferred.resolve(nonce);
  });
  return deferred.promise;
};

describe('/form/$FORMID', ()=> {
  const form = 'deadbeef-dead-beef-dead-beefdeadbeef';
  const redirForm = '00000000-0000-0000-0000-000000000003';
  const noRedirForm = '00000000-0000-0000-0000-000000000004';
  const shortStayForm = '00000000-0000-0000-0000-000000000002';
  const origin = 'http://example.com';
  
  describe('POST', ()=> {
    it('should redirect to custom URL on success', function(done) {
      retrieveNonce(redirForm).then((nonce)=>{
        let data = {
          nonce: nonce,
          recommend: '2',
          staff: '4',
          care: '5',
          name: 'Mulberry',
          email: 'test@example.com',
          phone: '867-5309',
          extension: '',
          comments: 'Wow, cool, great'
        };
        request
        .post(`/form/${redirForm}`)
        .send(data)
        .expect(302)
        .expect("Location","http://example.com")
        .end(done);
      });
    });
    it('should redirect to default URL on success', (done)=> {
      retrieveNonce(noRedirForm).then((nonce)=>{
        let data = {
          nonce: nonce,
          recommend: '2',
          staff: '4',
          care: '5',
          name: 'Mulberry',
          email: 'test@example.com',
          phone: '867-5309',
          extension: '',
          comments: 'Wow, cool, great'
        };
        request
        .post(`/form/${noRedirForm}`)
        .send(data)
        .expect(302)
        .expect("Location","/thanks")
        .end(done);
      });
    });
    it('should silently drop bad nonces', (done)=> {
      let data = {
        nonce: 'not-a-good-nonce',
        recommend: '2',
        staff: '4',
        care: '5',
        name: 'Mulberry',
        email: 'test@example.com',
        phone: '867-5309',
        extension: '',
        comments: 'Wow, cool, great'
      };
      request
      .post(`/form/${noRedirForm}`)
      .send(data)
      .expect(302)
      .expect("Location","/thanks")
      .end(done);
    });
    it('should give an error with bad data', (done)=> {
      retrieveNonce(noRedirForm).then((nonce)=>{
        let data = {
          nonce: nonce,
          recommend: '-2',
          staff: '10',
          care: '500',
          name: 'Mulberry',
          email: 'tjrlekj3',
          phone: '867-5309',
          extension: '',
          comments: 'Wow, cool, great'
        };
        request
        .post(`/form/${noRedirForm}`)
        .send(data)
        .expect(400)
        .end(done);
      });
    });
  });

  describe('?m', ()=> {
    it('should NOT include CSS', (done)=> {
      request
      .get(`/form/${form}`)
      .expect($not('link[rel=stylesheet]'))
      .end(done);
    });
  });

  it('should include CSS', (done)=> {
    request
    .get(`/form/${form}`)
    .expect($('link[rel=stylesheet]'))
    .end(done);
  });

  it('should deny iframing outside of origin', (done)=> {
    request
    .get(`/form/${form}`)
    .expect('X-Frame-Options', `ALLOW-FROM ${origin}`)
    .expect(200, done);
  });
  
  it('should contain expected fields', (done)=> {
    request
    .get(`/form/${form}`)
    .expect($('input[name="nonce"]'))
    .expect($('input[name=phone]'))
    .expect($('input[name=email]'))
    .expect($('input[name=care]'))
    .expect($('input[name=staff]'))
    .expect($('input[name=recommend]'))
    .expect($('textarea[name=comments]'))
    .expect($('input[name=name]'))
    .end(done);
  });
  
  it('should contain discharge rating if a shortStay form', (done)=> {
    request
    .get(`/form/${shortStayForm}`)
    .expect($('input[name=discharge]'))
    .end(done);
  });
  
  it('should not contain discharge rating if a standard form', (done)=> {
    request
    .get(`/form/${form}`)
    .expect($not('input[name=discharge]'))
    .end(done);
  });

  it('should stop incorrect origin requests', (done)=> {
    request
    .get(`/form/${form}`)
    .expect('Access-Control-Allow-Origin', origin)
    .expect(200, done);
  });
  
  it('should strip the path from my location in the origin', (done)=> {
    let pathForm = '00000000-0000-0000-0000-000000000005';
    let expectedOrigin = 'https://localhost';
    request
    .get(`/form/${pathForm}`)
    .expect('Access-Control-Allow-Origin', expectedOrigin)
    .expect(200, done);
  });
  
  it('should only allow cross-origin GET requests', (done)=> {
    request
    .get(`/form/${form}`)
    .expect('Access-Control-Allow-Methods', 'GET')
    .expect(200, done);
  });
  
  it('should function with multiple origins (1)', (done)=> {
    let form2 = '00000000-0000-0000-0000-000000000002';
    let origin2 = 'https://localhost';
    let origin3 = 'http://localhost2';

    request
    .get(`/form/${form2}`)
    .set('Origin', origin3)
    .expect('Access-Control-Allow-Origin', origin3)
    .expect('X-Frame-Options', `ALLOW-FROM ${origin3}`)
    .expect(200, done);
  });
 
  it('should function with multiple origins (2)', (done)=> {
    let form2 = '00000000-0000-0000-0000-000000000002';
    let origin2 = 'http://localhost2';

    request
    .get(`/form/${form2}`)
    .set('Origin', origin2)
    .expect('Access-Control-Allow-Origin', origin2)
    .expect('X-Frame-Options', `ALLOW-FROM ${origin2}`)
    .expect(200, done);
  });
  
  it('should respond with first origin when a non-match is found', (done)=> {
    let form2 = '00000000-0000-0000-0000-000000000002';
    let origin2 = 'http://arbitrarydomain';
    let expectedOrigin = 'https://localhost';

    request
    .get(`/form/${form2}`)
    .set('Origin', origin2)
    .expect('Access-Control-Allow-Origin', expectedOrigin)
    .expect('X-Frame-Options', `ALLOW-FROM ${expectedOrigin}`)
    .expect(200, done);
  });

  describe('/form/invalidID', ()=> {
    it('should respond with a 404 with a correctly-formed UUID', (done)=> {
      let fakeform = 'A9B9C9D9-E9F9-F9E9-9D9C-9B9A99999992';
      request
      .get(`/form/${fakeform}`)
      .expect(404, done);
    });
    // TODO: should we check instead for a 400 error?
    it('should respond with a 404 with a malformed UUID', (done)=> {
      let fakeform = 'woofwoof';
      request
      .get(`/form/${fakeform}`)
      .expect(404, done);
    });
  });

});

describe('form', ()=> {
  const form = require('./app/models/form');
  const formID = 'deadbeef-dead-beef-dead-beefdeadbeef';
  const formID_shortStay = '00000000-0000-0000-0000-000000000002';
  
  describe('get', ()=> {
    it('should return null with a nonexisting ID', function *(done) {
      let fakeform = 'A9B9C9D9-E9F9-F9E9-9D9C-9B9A99999992';
      let result = yield form.get(fakeform);
      let result2 = yield form.get('invalid-UUID-format');

      assert.strictEqual(result, null);
      assert.strictEqual(result2, null);

      done();
    });

    it('should retrieve expected fields', function *(done) {
      let result = yield form.get(formID);
      assert.equal(result.id, formID);
      assert.equal(result.type, 'standard');
      assert.strictEqual(result.allowed_origins.length, 1);
      assert.equal(result.allowed_origins[0], 'http://example.com');
     
      result = yield form.get(formID_shortStay);
      assert.equal(result.id, formID_shortStay);
      assert.equal(result.type, 'shortStay');
      assert.strictEqual(result.allowed_origins.length, 2);
      assert(result.allowed_origins.indexOf('http://localhost2') !== -1);
      assert(result.allowed_origins.indexOf('https://localhost') !== -1);

      done();
    });
  });

  describe('receive', ()=> {
    it('should throw an error with invalid data', function *() {
      let data = {'recommend': -1, 'staff': 3, 'care': 2, 'ip': '127.0.0.1'};
      let nonce = yield form.nonce.create(formID, true);
      yield assertGenThrows(form.receive(formID, nonce, data));
      
      data = {'recommend': 5, 'staff': 6, 'care': 2, 'ip': '127.0.0.1'};
      nonce = yield form.nonce.create(formID, true);
      yield assertGenThrows(form.receive(formID, nonce, data));
      
      data = {'recommend': 5, 'staff': 4, 'care': 0, 'ip': '127.0.0.1'};
      nonce = yield form.nonce.create(formID, true);
      yield assertGenThrows(form.receive(formID, nonce, data));
     
      data = {recommend: 5, staff: 4, care: 2, discharge: 3, ip: '127.0.0.1'};
      nonce = yield form.nonce.create(formID, true);
      yield assertGenThrows(form.receive(formID, nonce, data),
          "Discharge rating should not be allowed on a non-shortstay form");
    });
    it('should throw an error with missing data', function *() {
      let data = {};
      let nonce = yield form.nonce.create(formID, true);
      yield assertGenThrows(form.receive(formID, nonce, data));
    });
    it('should error out with an InvalidNonce if the nonce is bad', function *() {
      let data = {'recommend': 3, 'staff': 4, 'care': 2, ip: '127.0.0.1'};
      let nonce = 'i am a bad nonce';
      let type = form.nonce.InvalidNonce;
      yield assertGenThrows(form.receive(formID, nonce, data), type);
    });
    it('should return true with successful data', function *() {
      let data = {'recommend': 3, 'staff': 4, 'care': 2, ip: '127.0.0.1'};
      let nonce = yield form.nonce.create(formID, true);
      assert(yield form.receive(formID, nonce, data));
      
      data = {recommend: 3, staff: 4, care: 2, discharge: 1, ip: '127.0.0.1'};
      nonce = yield form.nonce.create(formID_shortStay, true);
      assert(yield form.receive(formID_shortStay, nonce, data));
    });
  });

  describe('nonce', ()=> {

    describe('create', ()=> {
      it('should create a 64-bit hexadecimal nonce',  function*(done) {
        let nonce = yield form.nonce.create(formID);
        assert.strictEqual(nonce.length, 16);
        var invalid = /[^a-z0-9]/i;
        assert(!invalid.test(nonce), "Nonce contained invalid characters");
        done();
      });
    });

    describe('validate', ()=> {

      it('should validate a nonce only once', function*(done) {
        let nonce = yield form.nonce.create(formID, true);
        let valid = yield form.nonce.validate(nonce, formID);
        assert(valid, "Valid nonce marked invalid");
        valid = yield form.nonce.validate(nonce, formID);
        assert(!valid, "Used nonce marked valid");
        done();
      });
    });
  });

  describe('user', ()=> {
    const user = require('./app/models/user');
    describe('getUserByID', ()=> {
      it('should return null when not found', function*(done){
        let u = yield user.getUserByID('fakeid');
        assert.strictEqual(u, null);
        done();
      });
      it('should return a data object when found', function*(done){
        let u = yield user.getUserByID(9);
        assert.strictEqual(u.id, 9);
        assert.strictEqual(u.name, 'joe');
        assert.strictEqual(u.email, 'joe@email.com');
        done();
      });
    });
  });

  describe('/widget/:formid', ()=> {
    const form = 'deadbeef-dead-beef-dead-beefdeadbeef';
    const ownerid = 8;
    const otheruser = 9;

    it('should redirect to the home page if not logged in', (done)=> {
      request
      .get('/widget/' + form)
      .expect(302)
      .expect('Location', '/')
      .end(done);
    });
    it('should give a 403 error if owned by different user', (done)=> {
      login(otheruser, (agent)=> {
        agent
        .get('/widget/' + form)
        .expect(403)
        .end(done);
      });
    });
    it('should display widget code', (done)=> {
      login(ownerid, (agent)=> {
        agent
        .get('/widget/' + form)
        .expect(200)
        .end(done);
      });
    });
  });

  describe('response', ()=> {
    const r = require('./app/models/response');
    const nonOwner = 9;
    const owner = 8;
    const unapproved = 5;
    const approved = 6;
    describe('approve', ()=> {
      it('should prevent non-owner from approving', function *() {
        let yieldable = r.approve(unapproved, nonOwner);
        yield assertGenThrows(yieldable, err.UserNotAllowed);
      });
      it('should return true on success', function *(done) {
        let response = yield r.approve(unapproved, owner);
        assert(response);
        done();
      });
      it('should return true if already approved', function *(done) {
        let response = yield r.approve(approved, owner);
        assert(response);
        done();
      });
    });
  });

  function login(id, cb) {
    let agent = require('supertest').agent(app.listen());
    agent
    .get('/proxylogin/' + id)
    .expect('set-cookie', /.*/)
    .end(()=>{cb(agent)});
  }

});
