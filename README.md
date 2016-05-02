# Node Token Authentication
> A template Express.js backend with E-mail and phone (Twitter Digits) based authentication and a basic Test Suite


## Requirements

node, npm and mongodb

## Usage

1. Clone the repo: `git clone https://github.com/praphull/backend-template.git`

2. Install dependencies: `npm install`

3. Create a file security.config.json in .appconfig directory with following contents:

```
{
	"aws" : {
		"mail" : {
			"key" : "aws-access-key",
			"secret" : "aws-access-secet"
		}
	},
	"db" : {
		"host" : "localhost"
	},
	"keys" : {
		"digits" : "digitskey",
		"mocha" : "mochaKey",
		"auth" : "AuthKey"
	},
	"loggly" : {
		"token" : "logglytoken",
		"domain" : "praphull.com"
	},
	"secret" : {
		"jwt" : "jwtsecret",
		"cookie" : "cookiesecret"
	},
	"tokenValidity" : {
		"auth" : "12h",
		"unauth" : "12h"
	}
}
```

4. Modify .appconfig/security.config.json with following values:

 a. aws.mail: Key and secret for Amazon Web Services E-mail configuration. AWS Mail wil be used to send all fatal errors details using logger.fatal in production environment. Uncomment the mail logger in app.js. Refer to [Loggly](https://github.com/winstonjs/node-loggly) for more details

 b. db.host: MongoDB host

 c. keys.digits: Key for phone number authentication. This key is provided in [Fabric Dashboard](https://fabric.io/dashboard)

 d. keys.mocha and keys.auth: Any random keys. Used internally. Check routes/models/auth.js for more details.

 e. loggly.token and loggly.domain:  Get these values at [Loggly Dashboard](https://www.loggly.com/)

 f. secret.jwt: Any random string. Will be used for signing [JSON Web Tokens](https://jwt.io/)

 g. secret.cookie: Used for signing cookies in HTTP requests using [cookie parser middleware](https://www.npmjs.com/package/cookie-parser) in Express.js

 h. tokenValidity: Token validity for authenticated and unauthenticated tokens

5. Encode security.config.json by running node security-encoder.js from .appconfig directory. Put the encoded value into .appconfig/security.config. .appconfig/security.config.json should be deleted after this.
6. Change the value of db property in exports.config of routes/util.js to reflect your MongoDB URL
7. Change rest of the values in exports.config of routes/util.js to suit to your application
8. In test/testsetup.js, ensure mocha key value for TestSetup.unauthToken and TestSetup.authToken is same as that entered in .appconfig/security.config.json
9. Start the server: `node app.js` or `npm start`
10. Create sample user by visiting: `http://localhost:3000/setup`

Once everything is set up, we can begin to use our app by creating and verifying tokens.

### Getting a Token on E-mail authentication

Send a `POST` request to `http://localhost:3000/api/authenticate` with test user parameters as `x-www-form-urlencoded`. 

``` js
  {
    name: 'Praphull Purohit',
    password: 'password',
	client: 'android'
  }
```

For now, only android is a valid client, as this backend template is taken out from an android app backend I developed. Other clients can be specified in routes/models/auth.js.

Client is stored in header of authentication and wil need to be passed as a parameter with every authenticated or unauthenticated (APIs supporting Skip Login flow are termed as unauthenticated APIs and they need an unauthenticated token) API.

Only non-authenticated APIs that appear before using Auth.verifyTokenValidity in routes/api.js need not pass this parameter

### Getting a Token on Phone number authentication

Setup your android, iOS or web application for phone number authentication using documentation at https://docs.fabric.io/android/digits/digits.html

On successful authentication in client application using Digits, an authorization response and a URL will be returned by Digits API.

Pass these as headers 'X-Verify-Credentials-Authorization' and 'X-Auth-Service-Provider' to `http://localhost:3000/api/authenticate/digits`

Backend will invoke the 'X-Auth-Service-Provider' URL with given authorization header, and if successful, find the matching user in database and return a JWT token.

## Getting an unauthorized token

To facilitate skip login flow, an unauthenticated token is generated. All APIs which do not need secure areas of the application, will need an unauthenticated token.

To do this, send a post request to `http://localhost:3000/api/authenticate/skip` as `x-www-form-urlencoded`
``` js
  {
    client: 'android'
  }
```

### Verifying a Token and Listing Users

Send a `GET` request to `http://localhost:3000/api/users` with a header parameter of `x-access-token` and the token.

You can also send the token as a URL parameter: `http://localhost:3000/api/users?token=YOUR_TOKEN_HERE`

Or you can send the token as a POST parameter of `token`.

## Unit Testing
To run the unit tests written in using mocha and should.js, run `npm test` or `mocha`.

If any test is failing, there is some issue in your configuration.

## External Links

https://github.com/scotch-io/node-token-authentication

https://docs.fabric.io/android/digits/digits.html

https://github.com/winstonjs/node-loggly

https://jwt.io/

https://www.npmjs.com/package/cookie-parser

## License

MIT © [Praphull Purohit](http://praphull.com)

