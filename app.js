// =================================================================
// get the packages we need ========================================
// =================================================================
var express = require('express');

var app = express();
var bodyParser = require('body-parser');

var http = require('http');
var path = require('path');

var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var apiRouter = require('./routes/api');
var defaultRouter = require('./routes/default');
var config = require('./routes/util').config; // get our config file
var securityConfig = require('./routes/util').securityConfig;

// =================================================================
// configuration ===================================================
// =================================================================
app.set('env', process.env.NODE_ENV || 'development'); //
var port = process.env.PORT || 3000;
var log4js = require('log4js');
var enableProdDebugLogs = process.env.PROD_DEBUG_LOGS || "N";

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({
		extended : false
	}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
		extended : false
	}));

app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
app.use(require('serve-favicon')(path.join(__dirname, 'public', 'img', 'favicon.ico')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(require('method-override')());
app.use(require('cookie-parser')(securityConfig.secret.cookie));

//Configure Logging
log4js.configure({
	appenders : [{
			type : 'console',
			category : 'development'
		}
		/*, {
		type : 'loggly',
		token : securityConfig.loggly.token,
		subdomain : securityConfig.loggly.domain,
		tags : ['prod'],
		category : 'production',
		json : true
		}, {
		type : "logLevelFilter",
		level : "DEBUG",
		maxLevel : "FATAL",
		appender : {
		type : "smtp",
		sender : config.email.noReply,
		recipients : config.email.admin,
		subject : "[" + config.app.name + "][" + app.get('env') + "]: Status Update",
		sendInterval : 30,
		transport : {
		plugin : "ses",
		options : {
		accessKeyId : securityConfig.awsMail.key,
		secretAccessKey : securityConfig.awsMail.secret,
		rateLimit : 5 //do not send more than 5 messages in a second
		}
		},
		category : "mailer"
		}
		}*/
	],
	levels : {
		"[all]" : "INFO",
		"production" : (enableProdDebugLogs == "Y" ? "DEBUG" : "WARN"),
		"development" : "DEBUG",
		"mailer" : "DEBUG"
	},
	replaceConsole : true
});

var logger = log4js.getLogger(app.get('env'));
app.use(log4js.connectLogger(logger, {
		level : 'auto'
	}));

if (app.get('env') === 'development' || app.get('env') === 'apitest') {
	logger.info('Enabling development settings');
	//Allow CORS for API explorer in Development/Testing mode
	app.use(require("cors")());
}

//Routers
app.use('/api', apiRouter);
app.use('/', defaultRouter);

//Setup static app data
app.set('securityConfig', securityConfig);

// =================================================================
// routes ==========================================================
// =================================================================

//Catch 404 and forward to error handler.
app.use(function (req, res, next) {
	var err = new Error('Page Not Found');
	err.status = 404;
	next(err);
});

if (app.get('env') === 'development') {
	logger.info('Using development settings.');
	//Development error handler, will print stacktrace.
	app.use(function (err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			title : config.app.name,
			message : err.message,
			error : err
		});
	});
} else if (app.get('env') === 'production' || app.get('env') === 'apitest') {
	logger.info('Using production settings.');
	//Production error handler.
	//No stacktraces leaked to user.
	app.use(function (err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			title : config.app.name,
			message : err.message,
			error : {}
		});
	});
}

//Handles graceful shutdown of server
/*var gracefulShutdown = function () {
	logger.warn("Received kill signal, shutting down gracefully");
	if (app.get('env') === 'production' || app.get('env') === 'apitest') {
		//log4js.getLogger("mailer").info("Server shutdown initiated!");
	}
	//Perform any shutdown tasks here, e.g. releasing DB pool
};
*/
// =================================================================
// start the server ================================================
// =================================================================

var server;
server = http.createServer(app).listen(port, function () {
		logger.debug('Express server listening on port ' + port);

		var env = app.get('env');

		//Connect to Database
		var mongoose = require('mongoose');
		mongoose.connect(config.db, function (err) {
			if (err) {
				logger.fatal('DB connection to ' + securityConfig.db.host + ' failed! Connection details: ' + config.db);
			} else {
				logger.debug('Successfully connected to DB');
			}
		});

		if (env === 'production') {
			//Send server startup mail
			//log4js.getLogger("mailer").info("Server startup: " + port);
		}

		//TODO: Any initialization, e.g. get connection pool to be used if using mysql as DB server
	});
// listen for TERM signal .e.g. kill
/*process.on('SIGTERM', gracefulShutdown);

// listen for INT signal e.g. Ctrl-C
process.on('SIGINT', gracefulShutdown);*/

exports.app = app;
exports.server = server;
