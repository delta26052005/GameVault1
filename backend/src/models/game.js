const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true
	},
	developerAddress: {
		type: String,
		required: true,
		trim: true
	},
	blockchainGameId: {
		type: Number,
		required: true
	},
	registrationTransactionHash: {
		type: String,
		trim: true
	},
	statusTransactionHash: {
		type: String,
		trim: true
	},
	description: {
		type: String,
		trim: true
	},
	active: {
		type: Boolean,
		default: true
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	updatedAt: {
		type: Date
	}
});

const Game = mongoose.model('Game', GameSchema);

module.exports = Game;
