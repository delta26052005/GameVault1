const mongoose = require('mongoose');

const GameAccountSchema = new mongoose.Schema({
	game: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Game',
		required: true
	},
	externalAccountId: {
		type: String,
		required: true,
		trim: true
	},
	ownerWallet: {
		type: String,
		required: true,
		trim: true
	},
	blockchainAccountId: {
		type: Number,
		required: true
	},
	linkTransactionHash: {
		type: String,
		trim: true
	},
	active: {
		type: Boolean,
		default: true
	},
	transferHistory: [{
		transactionHash: {
			type: String,
			required: true
		},
		previousOwner: {
			type: String,
			required: true
		},
		newOwner: {
			type: String,
			required: true
		},
		createdAt: {
			type: Date,
			default: Date.now
		}
	}],
	createdAt: {
		type: Date,
		default: Date.now
	}
});

const GameAccount = mongoose.model('GameAccount', GameAccountSchema);

module.exports = GameAccount;
