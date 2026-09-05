const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
	game: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Game',
		required: true
	},
	gameAccount: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'GameAccount',
		required: true
	},
	name: {
		type: String,
		required: true,
		trim: true
	},
	quantity: {
		type: Number,
		required: true
	},
	blockchainAssetId: {
		type: Number,
		required: true
	},
	active: {
		type: Boolean,
		default: true
	},
	createdAt: {
		type: Date,
		default: Date.now
	}
});

const Asset = mongoose.model('Asset', AssetSchema);

module.exports = Asset;
