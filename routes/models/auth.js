/**
 * Authentication module.
 * For username/password and third-party (digits, fb, google) authentication handling
 */
var Auth = {};

var _ = require('underscore');
var url = require('url');
var request = require('request');
var appConfig = require('../util').config;
var securityConfig = require('../util').securityConfig;
var getTZ = require('../util').getTZ;
var jwt = require('jsonwebtoken');
var logger = require('log4js').getLogger(process.env.NODE_ENV || 'development');

var User = require('../models/user');

/**
 * Handles authorization with Twitter
 * <br />Accessed as: <ul>
 * <li><b>POST</b> <i>/authenticate/digits</i></li>
 * </ul>
 * @param req Request
 * @param res Response
 */
Auth.authenticateDigits = function (req, res) {
	//These are the input fields coming in
	var headers = [
		// These are the credentials twitter will be verifying
		'X-Verify-Credentials-Authorization',
		// The url we'll be making the twitter request to
		'X-Auth-Service-Provider'
	];
	var missingValues = _.reject(headers, function (val) {
			return req.get(val);
		});

	// Return an error if we don't have proper inputs
	if (missingValues.length > 0) {
		logger.warn('Source: ' + req.ip + ', Missing authentication information: ' + missingValues);
		res.status(400).json({
			status : "error",
			errcode : 2003,
			message : 'Authentication information missing',
			missingInputs : missingValues
		});
		return;
	}

	var verified = true;
	var messages = [];

	var credentials = req.get(headers[0]);
	var apiUrl = req.get(headers[1]);
	var client = req.body['client'];
	var clientTZOffset = req.body['c_tz_offset'];

	// Verify the OAuth consumer key.
	if (credentials.indexOf('oauth_consumer_key="' + securityConfig.keys.digits + '"') == -1) {
		verified = false;
		messages.push('The Digits API key does not match');
	}

	// Verify the hostname.
	var hostname = url.parse(apiUrl).hostname;
	if (hostname != 'api.digits.com' && hostname != 'api.twitter.com') {
		verified = false;
		messages.push('Invalid API hostname: '+ hostname);
	}

	// Do not perform the request if the API key or hostname are not verified.
	if (!verified) {
		return res.send({
			status : "error",
			errcode : 2004,
			message : messages.join(' ')
		});
	}

	// Do not perform the request if Client is invalid
	if (!client || !(client == "android")) {
		return res.send({
			status : "error",
			errcode : 2005,
			message : "Invalid client code. Cannot proceed with login"
		});
	}

	// Prepare the request to the Digits API.
	var options = {
		url : apiUrl,
		headers : {
			'Authorization' : credentials
		}
	};

	// Perform the request to the Digits API.
	request.get(options, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			// Send the verified phone number and Digits user ID.
			var digits = JSON.parse(body);
			var digitsId = parseInt(digits.id_str);
			logger.debug("Invoking backend authentication. digitsId: " + digitsId + ", digits.phone_number:" + digits.phone_number);
			User.findOne({
				digitsId : digitsId
			}, function (err, user) {

				logger.debug("Done with authentication");
				logger.debug("Connection released");
				if (err || !user) {
					logger.info("Error validating user at DB");
					return res.send({
						status : "error",
						message : "Error validating user at DB"
					});
				} else if (user) {
					logger.debug("User validation successful");
					var tokenResult = Auth.getAuthenticatedToken(client,
							user._id,
							securityConfig.keys.auth,
							clientTZOffset);
					if (tokenResult.status === "success") {
						return res.send({
							status : "success",
							phoneNumber : user.phone,
							userId : user._id,
							digitsId : digitsId,
							email : user.email,
							message : "Successfully authenticated",
							authtoken : tokenResult.token,
							offset : (new Date()).getTimezoneOffset()
						});
					} else {
						return res.send(tokenResult);
					}
				}
			});
		} else {
			// Send the error.
			return res.send({
				status : "error",
				errcode : 2007,
				message : "Could not successfully validate your phone number"
			});
		}
	});
};

/**
 * Generates an authenticated token
 * @param client 'android' or 'mocha'
 * @param authKey A valid token generation key
 * @param clientTZOffset Optional - Client timezone offset from server
 */
Auth.getUnauthenticatedToken = function (client, authKey, clientTZOffset) {
	if (!(authKey && (authKey == securityConfig.keys.auth || authKey == securityConfig.keys.mocha))) {
		return {
			status : "error",
			errcode : 2013,
			message : "Authentication key for token generation is invalid. Possible hack attempt"
		};
	}

	if (authKey == securityConfig.keys.mocha && client != 'mocha') {
		return {
			status : "error",
			errcode : 2014,
			message : "Unit test key can't be used for token generation by other clients"
		};
	}
	var ctz = appConfig.app.defaultTimeZone;
	if (clientTZOffset) {
		try {
			ctz = getTZ(parseInt(clientTZOffset), false);
		} catch (e) {
			ctz = appConfig.app.defaultTimeZone;
		}
	}

	var tokenHeader = {
		expiresIn : securityConfig.tokenValidity.unauth,
		audience : client,
		issuer : appConfig.app.domain,
		algorithm : appConfig.jwtAlgo
	};
	var tokenPayload = {
		client : client,
		ctz : ctz
	};
	logger.debug("Generating token with payload: " + JSON.stringify(tokenPayload));
	return {
		status : "success",
		token : jwt.sign(tokenPayload, securityConfig.secret.jwt, tokenHeader)
	};
};

/**
 * Generates an authenticated token
 * @param client 'android' or 'mocha'
 * @param userId User id
 * @param authKey A valid token generation key
 * @param clientTZOffset Optional - Client timezone offset from server
 */
Auth.getAuthenticatedToken = function (client, userId, authKey, clientTZOffset) {
	if (!(authKey && (authKey == securityConfig.keys.auth || authKey == securityConfig.keys.mocha))) {
		return {
			status : "error",
			errcode : 2013,
			message : "Authentication key for token generation is invalid. Possible hack attempt"
		};
	}

	if (authKey == securityConfig.keys.mocha && client != 'mocha') {
		return {
			status : "error",
			errcode : 2014,
			message : "Unit test key can't be used for token generation by other clients"
		};
	}

	var ctz = appConfig.app.defaultTimeZone;
	if (clientTZOffset) {
		try {
			ctz = getTZ(parseInt(clientTZOffset), false);
		} catch (e) {
			ctz = appConfig.app.defaultTimeZone;
		}
	}
	var tokenHeader = {
		expiresIn : securityConfig.tokenValidity.auth,
		audience : client,
		issuer : appConfig.app.domain,
		algorithm : appConfig.jwtAlgo
	};
	var tokenPayload = {
		client : client,
		uid : userId,
		ctz : ctz
	};
	var tokenValue = jwt.sign(tokenPayload, securityConfig.secret.jwt, tokenHeader);
	logger.debug("Generated token with payload:" + JSON.stringify(tokenPayload) + ", token: " + tokenValue);
	return {
		status : "success",
		token : tokenValue
	};
};

/**
 * Skip login in App. Generate an unauthenticated token
 * <br />Accessed as: <ul>
 * <li><b>POST</b> <i>/authenticate/skip</i></li>
 * </ul>
 * @param req Request
 * @param res Response
 */
Auth.skipLogin = function (req, res) {
	logger.debug("Skip login clicked in app");
	var client = req.body['client'];
	var clientTZOffset = req.body['c_tz_offset'];

	// Do not perform the request if Client is invalid
	if (!client || !(client == "android" || client == "mocha")) {
		return res.send({
			status : "error",
			errcode : 2006,
			message : "Invalid client code. Cannot proceed with skip login"
		});
	}

	var tokenResult = Auth.getUnauthenticatedToken(client,
			securityConfig.keys.auth,
			clientTZOffset);
	if (tokenResult.status == "error") {
		return res.send(tokenResult);
	}
	return res.send({
		status : "success",
		message : "Login skipped by user",
		authtoken : tokenResult.token,
		offset : (new Date()).getTimezoneOffset()
	});
};
/**
 * Verifies the validity of a token
 * @param req Request
 * @param res Response
 * @param next
 * @returns
 */
Auth.verifyTokenValidity = function (req, res, next) {
	// check header or url parameters or post parameters for token
	var token = req.headers['x-access-token'] || req.body['token'] || req.query.token;

	// decode token
	if (token) {
		//Verify secret and check expiry
		jwt.verify(token,
			securityConfig.secret.jwt, {
			algorithms : [appConfig.jwtAlgo],
			issuer : appConfig.app.domain,
			ignoreExpiration : false
		},
			function (err, decoded) {
			if (err) {
				logger.debug("Invalid token!");
				//TODO: Status 403
				return res.json({
					status : "error",
					errcode : 2008,
					message : 'Failed to verify token validity'
				});
			} else {
				if (decoded.client == "android" || decoded.client == "mocha") {
					// if everything is good, save to request for use in other routes
					req.decoded = decoded;
					next();
				} else {
					logger.warn("Invalid client '" + decoded.client + "'passed in API request by user " + decoded.uid);
					return res.status(403).send({
						status : "error",
						errcode : 2009,
						message : "API does not support this client"
					});
				}
			}
		});

	} else {
		logger.debug("No token found in API request!");
		// if there is no token
		// return an error
		return res.status(403).send({
			status : "error",
			errcode : 2010,
			message : 'No token provided in API request'
		});

	}
};

/**
 * Verify users who have skipped login
 **/
Auth.verifyUserAuthenticated = function (req, res, next) {
	if (req.decoded && req.decoded.uid && req.decoded.uid != null) {
		//Allow next routes to be processed
		next();
	} else {
		return res.status(403).send({
			status : "error",
			errcode : 2011,
			message : 'User does not have sufficient permissions to invoke this API'
		});
	}
};

Auth.authenticateEmail = function (req, res, next) {
	var clientTZOffset = req.body['c_tz_offset'];
	var client = req.body['client'];
	// Do not perform the request if Client is invalid
	if (!client || !(client == "android")) {
		return res.send({
			status : "error",
			errcode : 2005,
			message : "Invalid client code. Cannot proceed with login"
		});
	}

	// find the user
	User.getAuthenticated(req.body.email, req.body.password,
		function (err, user, reason) {
		if (err) {
			return res.status(403).send({
				status : "error",
				errcode : 2009,
				message : "Unexpected error during authentication: " + err + "! Contact the helpdesk."
			});
		}

		if (!user) {
			logger.debug("User validation failed. Failure reasson: " + reason);
			var reasons = User.failedLogin;
			switch (reason) {
			case reasons.NOT_FOUND:
			case reasons.PASSWORD_INCORRECT:
				res.status(400).json({
					status : "error",
					errcode : 2001,
					message : "Invalid user credentials"
				});
				break;
			case reasons.MAX_ATTEMPTS:
				res.status(400).json({
					status : "error",
					errcode : 2015,
					message : "Maximum authentication attempts exhausted"
				});
				break;
			}
		} else if (user) {
			logger.debug("User validation successful");
			var tokenResult = Auth.getAuthenticatedToken(client,
					user._id,
					securityConfig.keys.auth,
					clientTZOffset);
			if (tokenResult.status === "success") {
				return res.send({
					status : "success",
					phoneNumber : user.phone,
					userId : user._id,
					digitsId : user.digitsId,
					message : "Successfully authenticated",
					authtoken : tokenResult.token,
					offset : (new Date()).getTimezoneOffset()
				});
			} else {
				return res.send(tokenResult);
			}
		}
	});
};

//Exposing the methods
module.exports = Auth;
