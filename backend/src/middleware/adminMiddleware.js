const { ethers } = require('ethers');
const User = require('../models/user');
const { gameVault, ensureContractAvailable } = require('../config/blockchain');

async function adminMiddleware(req, res, next) {
	let user;
	let adminAddress;
	let configuredSignerAddress;

	try {
		await ensureContractAvailable();
		[user, adminAddress, configuredSignerAddress] = await Promise.all([
			User.findById(req.user.userId),
			gameVault.admin(),
			gameVault.runner.getAddress()
		]);
	} catch (error) {
		console.error('Admin authorization error:', error);
		return res.status(503).json({
			message: 'Administrator authorization is temporarily unavailable'
		});
	}

	let normalizedAdminAddress;
	let normalizedSignerAddress;

	try {
		normalizedAdminAddress = ethers.getAddress(adminAddress);
		normalizedSignerAddress = ethers.getAddress(configuredSignerAddress);
	} catch (error) {
		console.error('Invalid configured administrator address:', error);
		return res.status(503).json({
			message: 'Configured administrator address is invalid'
		});
	}

	if (normalizedSignerAddress !== normalizedAdminAddress) {
		return res.status(503).json({
			message: 'Configured blockchain signer is not the platform administrator'
		});
	}

	if (
		!user?.walletAddress ||
		!ethers.isAddress(user.walletAddress)
	) {
		return res.status(403).json({
			message: 'Only the platform administrator can manage games'
		});
	}

	try {
		if (ethers.getAddress(user.walletAddress) !== normalizedAdminAddress) {
			return res.status(403).json({
				message: 'Only the platform administrator can manage games'
			});
		}
	} catch (error) {
		return res.status(403).json({
			message: 'Only the platform administrator can manage games'
		});
	}

	return next();
}

module.exports = adminMiddleware;