var _ = require('underscore');
/**
 * Common utilities package
 */

exports.config = {
	jwtAlgo : "HS256",
	app : {
		name : "Application name",
		domain : "praphull.com",
		defaultTimeZone: "+05:30"
	},
	email : {
		admin : "debug@praphull.com",
		noReply : "debug@praphull.com"
	},
	db: "mongodb://localhost:27017/mydb"
};

function processSecurityConfig() {
	var secDecoder = function (val, key) {
		return _.isObject(val) ? _.mapObject(val, secDecoder) : (new Buffer(val, 'base64').toString('ascii'));
	};
	return _.mapObject(
		JSON.parse(
			new Buffer(
				require('fs').readFileSync('.appconfig/security.config').toString(),
				'base64').toString('ascii')),
		secDecoder);
}

/**
 * Gets timezone from a timezone offset number (e.g. 330 will return +05:30)
 */
exports.getTZ = function (offset, changeSign) {
	if (offset) {
		try {
			var o = Math.abs(offset);
			//Timezone offset for IST is -330 in JS and 330 in Android, but to convert time in SQL, we need to specify server specific timezone for IST, which is +05:30. Hence need to invert the sign based on requirement
			var s = (offset >= 0) ? (changeSign ? '-' : '+') : (changeSign ? '+' : '-');
			var h = Math.floor(o / 60);
			var m = o % 60;
			return s + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
		} catch (e) {}
	}
	return '+00:00';
};

/**
 * Gets timezone offset minutes from a timezone offset string (e.g. +05:30 will return 330)
 */
exports.getTZValue = function (offsetStr, changeSign) {
	if (offsetStr) {
		try {
			var s = (offsetStr.charAt(0) == '+' ? 1 : -1);
			var a = offsetStr.split(":");
			var h = parseInt(a[0].substr(1));
			var m = parseInt(a[1]);
			return (changeSign ? -1 : 1) * s * ((h * 60) + m);
		} catch (e) {}
	}
	return 0;
};

exports.utils = {
	convertServerDate : function (date, offset) {
		return new Date(date.getTime() + ((date.getTimezoneOffset() - offset) * 60000));
	},
	convertServerDateWithDelay : function (date, offset, delay) {
		return new Date(date.getTime() + ((date.getTimezoneOffset() + offset + (delay * 60)) * 60000));
	},
	getTimeInMinutes : function (date) {
		return (date.getHours() * 60) + date.getMinutes();
	},
	getUTCTimeInMinutes : function (date) {
		return (date.getUTCHours() * 60) + date.getUTCMinutes();
	},
	getDateStr : function (date) {
		return date.getDate() + "-" + (date.getMonth() + 1) + "-" + date.getFullYear();
	},
	getUTCDateStr : function (date) {
		return date.getUTCDate() + "-" + (date.getUTCMonth() + 1) + "-" + date.getUTCFullYear();
	}
};

/* Exporting security config as an object instead of a method call for better performance */
var securityConfigObj = null;
securityConfigObj = processSecurityConfig();
exports.securityConfig = securityConfigObj;
