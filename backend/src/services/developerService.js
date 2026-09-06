const User = require('../models/user');

async function isVerifiedDeveloper(userId, developerAddress) {
	const user = await User.findById(userId);

	if (!user || !user.walletAddress) {
		return false;
	}

	return user.walletAddress.toLowerCase() === developerAddress.toLowerCase();
}

module.exports = {
	isVerifiedDeveloper
};
