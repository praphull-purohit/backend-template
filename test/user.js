var should = require('should');
var assert = require('assert');
var request = require('supertest');
var jwt = require('jsonwebtoken');
var appConfig = require('../routes/util').config;
var securityConfig = require('../routes/util').securityConfig;
var setup = require('./testsetup');

describe('Token Generator', function() {
	this.timeout(500);
	it('should generate unauthenticated token', function (done) {
		setup.should.have.property("unauthToken");
		setup.unauthToken.should.not.equal(null);
		done();
	});
	it('should generate authenticated token', function (done) {
		setup.should.have.property("authToken");
		setup.authToken.should.not.equal(null);
		done();
	});
});

describe('Digits Authentication', function () {
	this.timeout(500);
	it('should reject missing auth headers', function (done) {
		var loginCredentials = {
			client : "android",
			c_tz_offset : 330
		};
		request(setup.url)
		.post('/api/authenticate/digits')
		.send(loginCredentials)
		.expect(400)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('error');
			res.body.errcode.should.equal(2003);
			done();
		});
	});
	it('should reject invalid auth provider', function (done) {
		var loginCredentials = {
			client : "android",
			c_tz_offset : 330
		};
		request(setup.url)
		.post('/api/authenticate/digits')
		.set('X-Auth-Service-Provider', 'https://abc.example.com')
		.set('X-Verify-Credentials-Authorization', 'DummyToken')
		.send(loginCredentials)
		.expect(400)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('error');
			res.body.errcode.should.equal(2004);
			done();
		});
	});
	it('should reject invalid Digits API key in auth header', function (done) {
		var loginCredentials = {
			client : "android",
			c_tz_offset : 330
		};
		request(setup.url)
		.post('/api/authenticate/digits')
		.set('X-Auth-Service-Provider', 'https://api.twitter.com/dummyurl')
		.set('X-Verify-Credentials-Authorization', 'someheader=somevalue,oauth_consumer_key="somekey"')
		.send(loginCredentials)
		.expect(400)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('error');
			res.body.errcode.should.equal(2004);
			done();
		});
	});
	it('should reject invalid client code', function (done) {
		var loginCredentials = {
			client : "dummyClient",
			c_tz_offset : 330
		};
		request(setup.url)
		.post('/api/authenticate/digits')
		.set('X-Auth-Service-Provider', 'https://api.twitter.com/dummyurl')
		.set('X-Verify-Credentials-Authorization', 'someheader="somevalue",oauth_consumer_key="' + securityConfig.keys.digits + '"')
		.send(loginCredentials)
		.expect(200)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('error');
			res.body.errcode.should.equal(2005);
			done();
		});
	});
});

describe('Skip Login', function () {
	this.timeout(500);
	it('should generate a valid token', function (done) {
		var loginCredentials = {
			client : "android",
			c_tz_offset : 330
		};
		request(setup.url)
		.post('/api/authenticate/skip')
		.send(loginCredentials)
		.expect(200)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('success');
			res.body.should.have.property('authtoken');
			res.body.should.have.property('offset');

			jwt.verify(res.body.authtoken,
				securityConfig.secret.jwt, {
				algorithms : [appConfig.jwtAlgo],
				issuer : appConfig.app.domain,
				ignoreExpiration : false
			},
				function (err, decoded) {
				should.equal(null, err);
				decoded.client.should.equal("android");
				//unauthToken = res.body.authtoken;
				done();
			});
		});
	});
	it('should reject missing client code', function (done) {
		var loginCredentials = {
			c_tz_offset : 330
		};
		request(setup.url)
		.post('/api/authenticate/skip')
		.send(loginCredentials)
		.expect(200)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('error');
			res.body.errcode.should.equal(2006);
			done();
		});
	});
	it('should reject invalid client code', function (done) {
		var loginCredentials = {
			client : "dummyClient",
			c_tz_offset : 330
		};
		request(setup.url)
		.post('/api/authenticate/skip')
		.send(loginCredentials)
		.expect(200)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('error');
			res.body.errcode.should.equal(2006);
			done();
		});
	});
	it('should put valid client timezone in token', function (done) {
		var loginCredentials = {
			client : "android",
			c_tz_offset : -75
		};
		request(setup.url)
		.post('/api/authenticate/skip')
		.send(loginCredentials)
		.expect(200)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.should.have.property('authtoken');

			jwt.verify(res.body.authtoken,
				securityConfig.secret.jwt, {
				algorithms : [appConfig.jwtAlgo],
				issuer : appConfig.app.domain,
				ignoreExpiration : false
			},
				function (err, decoded) {
				decoded.ctz.should.equal("-01:15");
				done();
			});
		});
	});
	it('should default client timezone in token on not passing client timezone', function (done) {
		var loginCredentials = {
			client : "android"
		};
		request(setup.url)
		.post('/api/authenticate/skip')
		.send(loginCredentials)
		.expect(200)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.should.have.property('authtoken');

			jwt.verify(res.body.authtoken,
				securityConfig.secret.jwt, {
				algorithms : [appConfig.jwtAlgo],
				issuer : appConfig.app.domain,
				ignoreExpiration : false
			},
				function (err, decoded) {
				decoded.ctz.should.equal("+05:30");
				done();
			});
		});
	});
	it('should default client timezone in token on passing invalid timezone', function (done) {
		var loginCredentials = {
			client : "android",
			c_tz_offset : "invalidTimeZone"
		};
		request(setup.url)
		.post('/api/authenticate/skip')
		.send(loginCredentials)
		.expect(200)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.should.have.property('authtoken');

			jwt.verify(res.body.authtoken,
				securityConfig.secret.jwt, {
				algorithms : [appConfig.jwtAlgo],
				issuer : appConfig.app.domain,
				ignoreExpiration : false
			},
				function (err, decoded) {
				decoded.ctz.should.equal("+00:00");
				done();
			});
		});
	});
});

describe('Public or secure APIs', function () {
	this.timeout(500);
	it('should reject invalid token', function (done) {
		var data = {
			token : "invalidToken"
		};
		request(setup.url)
		.get('/api/users')
		.send(data)
		.expect(200)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('error');
			res.body.errcode.should.equal(2008);
			done();
		});
	});
	/*it('should reject invalid client code', function(done) {
	var data = {
	client: "dummyClient",
	token: setup.unauthToken
	};
	request(setup.url)
	.get('/api/statics/init')
	.send(data)
	.expect(403)
	.expect('Content-Type', /json/)
	.end(function(err, res) {
	res.body.status.should.equal('error');
	res.body.errcode.should.equal(2009);
	done();
	});
	});*/
	it('should reject missing token', function (done) {
		request(setup.url)
		.get('/api/users')
		.expect(403)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('error');
			res.body.errcode.should.equal(2010);
			done();
		});
	});
});

describe('Secure APIs', function () {
	this.timeout(500);
	it('should reject public (unauthenticated) tokens', function (done) {
		var data = {
			token : setup.unauthToken
		};
		request(setup.url)
		.post('/api/users')
		.send(data)
		.expect(403)
		.expect('Content-Type', /json/)
		.end(function (err, res) {
			res.body.status.should.equal('error');
			res.body.errcode.should.equal(2011);
			done();
		});
	});
});
