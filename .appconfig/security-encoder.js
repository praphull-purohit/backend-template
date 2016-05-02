/**
 * Encodes the security config JSON and returns a string to be deployed
 **/
encodeSecurityConfig = function (configFile, showAfterFirstEncoding) {
	var _ = require('underscore');
	var secEncoder = function (val, key) {
		return _.isObject(val) ? _.mapObject(val, secEncoder) : (new Buffer(val, 'ascii').toString('base64'));
	};
	var firstPass = JSON.stringify(_.mapObject(
				JSON.parse(
					require('fs').readFileSync(configFile).toString()),
				secEncoder));
	if (showAfterFirstEncoding) {
		console.log("After first level encoding: " + firstPass);
	}
	return new Buffer(
		firstPass,
		'ascii').toString('base64');

};

console.log(encodeSecurityConfig('security.config.json', true));
//module.exports = encodeSecurityConfig('.appconfig/security.config.json');
