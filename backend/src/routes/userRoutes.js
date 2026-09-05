const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/user');
const crypto = require('crypto');
const { ethers } = require('ethers');

const router = express.Router();

router.get('/profile', authMiddleware, (req, res) => {
	res.status(200).json({
		message: 'Protected profile route accessed',
		userId: req.user.userId
	});
});

router.post('/wallet/challenge', authMiddleware, async (req, res) => {
	try {
		const user = await User.findById(req.user.userId);

		if (!user) {
			return res.status(404).json({
				message: 'User not found'
			});
		}

		const nonce = crypto.randomBytes(32).toString('hex');
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

		user.walletChallenge = `GameVault wallet verification\nUser ID: ${req.user.userId}\nNonce: ${nonce}\nExpires At: ${expiresAt.toISOString()}`;
		user.walletChallengeExpires = expiresAt;
		await user.save();

		return res.status(200).json({
			message: 'Wallet challenge generated successfully',
			challenge: user.walletChallenge,
			expiresAt: user.walletChallengeExpires
		});
	} catch (error) {
		console.error('Wallet challenge error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

router.post('/wallet/verify', authMiddleware, async (req, res) => {
	try {
		const { walletAddress, signature } = req.body;

		if (!walletAddress || !signature) {
			return res.status(400).json({
				message: 'Wallet address and signature are required'
			});
		}

		const user = await User.findById(req.user.userId);

		if (!user) {
			return res.status(404).json({
				message: 'User not found'
			});
		}

		if (!user.walletChallenge || !user.walletChallengeExpires) {
			return res.status(400).json({
				message: 'No active wallet challenge found'
			});
		}

		if (user.walletChallengeExpires < new Date()) {
			user.walletChallenge = null;
			user.walletChallengeExpires = null;
			await user.save();

			return res.status(400).json({
				message: 'Wallet challenge has expired'
			});
		}

		if (!ethers.isAddress(walletAddress)) {
			return res.status(400).json({
				message: 'Invalid wallet address'
			});
		}

		let recoveredAddress;

		try {
			recoveredAddress = ethers.verifyMessage(user.walletChallenge, signature);
		} catch (error) {
			return res.status(401).json({
				message: 'Invalid wallet signature'
			});
		}

		if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
			return res.status(401).json({
				message: 'Wallet signature verification failed'
			});
		}

		user.walletAddress = walletAddress;
		user.walletChallenge = null;
		user.walletChallengeExpires = null;
		await user.save();

		return res.status(200).json({
			message: 'Wallet ownership verified successfully',
			walletAddress: user.walletAddress
		});
	} catch (error) {
		console.error('Wallet verification error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

module.exports = router;
