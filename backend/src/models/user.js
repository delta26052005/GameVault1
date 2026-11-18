const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
	username: {
		type: String,
		required: true,
		unique: true,
		trim: true
	},
	email: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		lowercase: true
	},
	password: {
		type: String,
		required: true
	},
	walletAddress: {
		type: String,
		trim: true
	},
	walletChallenge: {
		type: String,
		trim: true
	},
	walletChallengeExpires: {
		type: Date
	},
	developerChallenge: {
		type: String,
		trim: true
	},
	developerChallengeExpires: {
		type: Date
	},
	developerChallengeAddress: {
		type: String,
		trim: true
	},
	developerVerificationAddress: {
		type: String,
		trim: true
	},
	developerVerificationExpires: {
		type: Date
	},
	createdAt: {
		type: Date,
		default: Date.now
	}
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
