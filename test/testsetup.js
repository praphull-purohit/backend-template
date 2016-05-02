var appConfig = require('../routes/util').config;
var securityConfig = require('../routes/util').securityConfig;
var auth = require('../routes/models/auth');
var request = require('supertest');
var User = require('../routes/models/user');
var mongoose = require('mongoose');
var logger = require('log4js').getLogger(process.env.NODE_ENV || 'development');
mongoose.connect(appConfig.db, function (err) {
	if (err) {
		logger.fatal('DB connection to ' + securityConfig.db.host + ' failed! Connection details: ' + appConfig.db);
	} else {
		logger.debug('Successfully connected to DB');
	}
});

var TestSetup = {};
TestSetup.env = (process.env.NODE_TEST_ENV || process.env.NODE_ENV || 'development');
TestSetup.host = (process.env.DEV_NODE_HOSTNAME || ((TestSetup.env === 'development' || TestSetup.env === 'apitest') ? 'localhost' : process.env.NODE_ENV));
TestSetup.port = (process.env.DEV_NODE_PORT || ((TestSetup.env === 'development' || TestSetup.env === 'apitest') ? '3000' : process.env.PORT)),
TestSetup.url = ('http://' + TestSetup.host + ':' + TestSetup.port);

//Ensure proper mocha key here
TestSetup.unauthToken = (auth.getUnauthenticatedToken("mocha", "mochaKey", null)).token;
TestSetup.authToken = (auth.getAuthenticatedToken("mocha", 3, "mochaKey", null)).token;

TestSetup.data = {
	user : {
		name : 'Test User',
		password : 'password1',
		email : 'testuser@praphull.com',
		phone : '+91-1234567891',
		digitsKey : 12345670,
		status : 'active'
	}
};

TestSetup.init = {
	initUser : function (done) {
		var user = new User(TestSetup.data.user);
		user.save(function (err) {
			if (err)
				throw err;
			if (done)
				done();
		});
	},
	deleteUsers : function (done) {
		User.findOne({
			email : TestSetup.data.user.email
		}, function (err, u1) {
			if (u1 && u1 != null) {
				u1.remove();
			}
			done();
		});
	},
	dates : function (done) {
		var curDate = new Date();
		TestSetup.data.currentDateStr = curDate.getDate() + "-" + (curDate.getMonth() + 1) + "-" + curDate.getFullYear();
		TestSetup.data.currentDate = curDate;
		curDate = new Date(curDate.getTime() + 24 * 3600000);
		TestSetup.data.nextDateStr = curDate.getDate() + "-" + (curDate.getMonth() + 1) + "-" + curDate.getFullYear();
		if (done)
			done();
	}
};

TestSetup.init.dates(null);

module.exports = TestSetup;
