const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Asset = require('../models/asset');

dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

async function connectDB() {
	try {
		await mongoose.connect(process.env.MONGODB_URI);
		await Asset.ensureBlockchainAssetIdIndex();
		console.log('MongoDB connected successfully');
	} catch (error) {
		console.error('MongoDB startup failed:', error.message);
		process.exit(1);
	}
}

module.exports = connectDB;
