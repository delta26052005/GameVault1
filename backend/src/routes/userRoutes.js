const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/user');
const Game = require('../models/game');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { gameVault, ensureContractAvailable } = require('../config/blockchain');

const router = express.Router();

router.post('/developer/challenge', authMiddleware, async (req, res) => {
	try {
		const { gameName, developerAddress } = req.body;

		if (!gameName || !ethers.isAddress(developerAddress)) {
			return res.status(400).json({
				message: 'Game name and a valid developer wallet are required'
			});
		}

		const user = await User.findById(req.user.userId);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		const normalizedAddress = ethers.getAddress(developerAddress);
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
		user.developerChallenge = [
			'GameVault Developer Verification',
			'',
			`Game: ${gameName.trim()}`,
			'',
			'I confirm that I control this developer wallet.'
		].join('\n');
		user.developerChallengeExpires = expiresAt;
		user.developerChallengeAddress = normalizedAddress;
		await user.save();

		return res.status(200).json({
			message: user.developerChallenge,
			expiresAt
		});
	} catch (error) {
		console.error('Developer challenge error:', error);
		return res.status(500).json({ message: 'Server error' });
	}
});

router.post('/developer/verify', authMiddleware, async (req, res) => {
	try {
		const { signature } = req.body;
		const user = await User.findById(req.user.userId);

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		if (
			!signature ||
			!user.developerChallenge ||
			!user.developerChallengeExpires ||
			!user.developerChallengeAddress
		) {
			return res.status(400).json({
				message: 'No active developer verification challenge found'
			});
		}

		if (user.developerChallengeExpires < new Date()) {
			return res.status(400).json({
				message: 'Developer verification challenge has expired'
			});
		}

		let recoveredAddress;
		try {
			recoveredAddress = ethers.verifyMessage(
				user.developerChallenge,
				signature
			);
		} catch {
			return res.status(401).json({
				message: 'Invalid developer wallet signature'
			});
		}

		if (
			ethers.getAddress(recoveredAddress) !==
			ethers.getAddress(user.developerChallengeAddress)
		) {
			return res.status(401).json({
				message: 'Developer wallet signature does not match'
			});
		}

		const normalizedDeveloperAddress = ethers.getAddress(recoveredAddress);
		if (
			user.walletAddress &&
			ethers.getAddress(user.walletAddress) !== normalizedDeveloperAddress
		) {
			return res.status(409).json({
				message: 'A different wallet is already verified for this user'
			});
		}

		user.walletAddress = normalizedDeveloperAddress;
		user.developerVerificationAddress = ethers.getAddress(recoveredAddress);
		user.developerVerificationExpires = user.developerChallengeExpires;
		user.developerChallenge = null;
		user.developerChallengeExpires = null;
		user.developerChallengeAddress = null;
		await user.save();

		return res.status(200).json({
			message: 'Developer wallet verified successfully',
			developerAddress: normalizedDeveloperAddress
		});
	} catch (error) {
		console.error('Developer verification error:', error);
		return res.status(500).json({ message: 'Server error' });
	}
});

router.get('/profile', authMiddleware, async (req, res) => {
	try {
		const user = await User.findById(req.user.userId).select(
			'username email walletAddress'
		);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		await ensureContractAvailable();
		const adminAddress = await gameVault.admin();
		let normalizedWallet = '';
		if (user.walletAddress && ethers.isAddress(user.walletAddress)) {
			normalizedWallet = ethers.getAddress(user.walletAddress);
		}
		const isAdmin = Boolean(
			normalizedWallet && normalizedWallet === ethers.getAddress(adminAddress)
		);
		const isDeveloper = Boolean(normalizedWallet && await Game.exists({
			developerAddress: new RegExp(`^${normalizedWallet}$`, 'i')
		}));
		const role = isAdmin ? 'ADMIN' : isDeveloper ? 'DEVELOPER' : 'PLAYER';

		return res.status(200).json({
			userId: user._id,
			username: user.username,
			email: user.email,
			walletAddress: user.walletAddress || '',
			role
		});
	} catch (error) {
		console.error('Profile fetch error:', error);
		if (error.message.includes('contract is not deployed')) {
			return res.status(503).json({
				message: 'GameVault blockchain is unavailable'
			});
		}
		return res.status(500).json({ message: 'Server error' });
	}
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
