var mongoose = require('mongoose'),
bcrypt = require('bcrypt-nodejs'),
Schema = mongoose.Schema,
MAX_LOGIN_ATTEMPTS = 5,
LOCK_TIME = 2 * 60 * 60 * 1000;

var UserSchema = new Schema({
		name : String,
		password : {
			type : String,
			required : true
		},
		email : {
			type : String,
			required : true,
			index : {
				unique : true
			}
		},
		loginAttempts : {
			type : Number,
			required : true,
			"default" : 0
		},
		lockUntil : {
			type : Number
		},
		phone : String,
		digitsId : Number,
		status : String
	});
/**
 * Reasons for password authentication failure
 **/
UserSchema.statics.failedLogin = {
	NOT_FOUND : 0,
	PASSWORD_INCORRECT : 1,
	MAX_ATTEMPTS : 2
};

/**
 * Hash the password before saving to DB
 * @see http://blog.mongodb.org/post/32866457221/password-authentication-with-mongoose-part-1
 **/
UserSchema.pre('save', function (next) {
	var user = this;

	// only hash the password if it has been modified (or is new)
	if (!user.isModified('password'))
		return next();

	bcrypt.hash(user.password, null, null, function (err, hash) {
		if (err)
			return next(err);

		// override the cleartext password with the hashed one
		user.password = hash;
		next();
	});

});

/**
 * Compare the password provided with password in DB
 * @param candidatePassword Original password
 * @param Callback method
 **/
UserSchema.methods.comparePassword = function (candidatePassword, cb) {
	bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
		if (err)
			return cb(err);
		cb(null, isMatch);
	});
};

/**
 * Increment login attempts
 **/
UserSchema.methods.incLoginAttempts = function (cb) {
	// if we have a previous lock that has expired, restart at 1
	if (this.lockUntil && this.lockUntil < Date.now()) {
		return this.update({
			$set : {
				loginAttempts : 1
			},
			$unset : {
				lockUntil : 1
			}
		}, cb);
	}
	// otherwise we're incrementing
	var updates = {
		$inc : {
			loginAttempts : 1
		}
	};
	// lock the account if we've reached max attempts and it's not locked already
	if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
		updates.$set = {
			lockUntil : Date.now() + LOCK_TIME
		};
	}
	return this.update(updates, cb);
};

// expose enum on the model, and provide an internal convenience reference
var reasons = UserSchema.statics.failedLogin = {
	NOT_FOUND : 0,
	PASSWORD_INCORRECT : 1,
	MAX_ATTEMPTS : 2
};

/**
 * Authenticate a user against email and password
 * @param email E-mail
 * @param password Password
 * @param cb Callback method
 **/
UserSchema.statics.getAuthenticated = function (email, password, cb) {
	this.findOne({
		email : email
	}, function (err, user) {
		if (err)
			return cb(err);

		// make sure the user exists
		if (!user) {
			return cb(null, null, reasons.NOT_FOUND);
		}

		// check if the account is currently locked
		if (user.isLocked) {
			// just increment login attempts if account is already locked
			return user.incLoginAttempts(function (err) {
				if (err)
					return cb(err);
				return cb(null, null, reasons.MAX_ATTEMPTS);
			});
		}

		// test for a matching password
		user.comparePassword(password, function (err, isMatch) {
			if (err)
				return cb(err);

			// check if the password was a match
			if (isMatch) {
				// if there's no lock or failed attempts, just return the user
				if (!user.loginAttempts && !user.lockUntil)
					return cb(null, user);
				// reset attempts and lock info
				var updates = {
					$set : {
						loginAttempts : 0
					},
					$unset : {
						lockUntil : 1
					}
				};
				return user.update(updates, function (err) {
					if (err)
						return cb(err);
					return cb(null, user);
				});
			}

			// password is incorrect, so increment login attempts before responding
			user.incLoginAttempts(function (err) {
				if (err)
					return cb(err);
				return cb(null, null, reasons.PASSWORD_INCORRECT);
			});
		});
	});
};

module.exports = mongoose.model('User', UserSchema);
