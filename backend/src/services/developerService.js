const { ethers } = require('ethers');
const User = require('../models/user');

async function isVerifiedDeveloper(userId, developerAddress) {
	const user = await User.findById(userId);

	if (!user?.walletAddress || !ethers.isAddress(developerAddress)) {
		return false;
	}

	try {
		return ethers.getAddress(user.walletAddress) === ethers.getAddress(developerAddress);
	} catch {
		return false;
	}
}

module.exports = {
	isVerifiedDeveloper
};
