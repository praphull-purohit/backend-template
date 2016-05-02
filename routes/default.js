/**
 * Routing handler for web page requests to administration dashboard (website)
 */
var express = require('express');
var defaultRouter = express.Router();
var request = require('request');
var appConfig = require('./util').config;
var securityConfig = require('./util').securityConfig;

//Required models
var User = require('./models/user');


defaultRouter.get('/', function (req, res) {
	res.send('The API is up!');
});

module.exports = defaultRouter;
