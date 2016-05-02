/**
 * API Routing Module.
 * All /api requests will be routed through this module.
 * A custom middleware in this module processes each /api request (except /api/authenticate) and validates whether request header contains a valid API token.
 */
var express = require('express');
var apiRouter = express.Router();
var request = require('request');
var logger = require('log4js').getLogger(process.env.NODE_ENV || 'development');

//Required models
var Auth = require('./models/auth');
var User = require('./models/user');

apiRouter.get('/setup', function (req, res) {

	// create a sample user
	var pp = new User({
			name : 'Praphull Purohit',
			password : 'password',
			email : 'debug@praphull.com',
			phone : '+91-1234567890',
			digitsKey : 12345678,
			status : 'active'
		});
	pp.save(function (err) {
		if (err)
			throw err;

		logger.debug('User saved successfully');
		res.json({
			success : true
		});
	});
});

apiRouter.post('/authenticate', Auth.authenticateEmail);
apiRouter.post('/authenticate/digits', Auth.authenticateDigits);
apiRouter.post('/authenticate/skip', Auth.skipLogin);

//Routes that need no authentication or token

//Middleware to validate authentication
//Any routes after this will be verified by this middleware for validity of token. Unauthenticated users will not be able to access these APIs
apiRouter.use(Auth.verifyTokenValidity);

//Authenticated Routes
apiRouter.get('/', function (req, res) {
	res.json({
		message : 'Welcome to the API!'
	});
});

//APIs that need to be validated for the presence of a valid userId need to come after this middleware
apiRouter.use(Auth.verifyUserAuthenticated);


apiRouter.get('/users', function (req, res) {
	User.find({}, function (err, users) {
		res.json(users);
	});
});

apiRouter.get('/check', function (req, res) {
	res.json(req.decoded);
});


module.exports = apiRouter;
