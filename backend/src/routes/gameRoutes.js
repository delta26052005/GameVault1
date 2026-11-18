const express = require('express');
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const Game = require('../models/game');
const User = require('../models/user');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const {
	registerGameOnBlockchain,
	toSafeNumber
} = require('../services/blockchainService');
const { ensureContractAvailable } = require('../config/blockchain');

const router = express.Router();

router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
	try {
		const { name, developerAddress, description } = req.body;

		if (!name?.trim() || !developerAddress) {
			return res.status(400).json({
				message: 'Name and developer address are required'
			});
		}

		let normalizedDeveloperAddress;

		try {
			normalizedDeveloperAddress = ethers.getAddress(developerAddress);
		} catch (error) {
			return res.status(400).json({
				message: 'Invalid developer wallet address'
			});
		}

		const developerUser = await User.findOne({
			walletAddress: new RegExp(`^${normalizedDeveloperAddress}$`, 'i')
		}).select('_id walletAddress');
		if (!developerUser) {
			return res.status(403).json({
				message: 'The developer wallet must be verified before registering the game'
			});
		}

		const existingGame = await Game.findOne({
			name: name.trim(),
			developerAddress: new RegExp(`^${normalizedDeveloperAddress}$`, 'i')
		});
		if (existingGame) {
			return res.status(409).json({
				message: 'This game is already registered for the developer wallet'
			});
		}

		let blockchainResult;
		try {
			blockchainResult = await registerGameOnBlockchain(
				name.trim(),
				normalizedDeveloperAddress
			);
		} catch (error) {
			console.error('Game blockchain registration error:', error);
			return res.status(502).json({
				message: 'Unable to register the game on the blockchain'
			});
		}

		let blockchainGameId;
		try {
			blockchainGameId = toSafeNumber(
				blockchainResult.gameId,
				'Blockchain game ID'
			);
		} catch (error) {
			console.error('Game blockchain ID conversion error:', error);
			return res.status(502).json({
				message: 'Blockchain game ID is outside the supported range'
			});
		}

		const game = new Game({
			name: name.trim(),
			developerAddress: normalizedDeveloperAddress,
			blockchainGameId,
			registrationTransactionHash: blockchainResult.transactionHash,
			description
		});
		let savedGame;
		try {
			savedGame = await game.save();
		} catch (error) {
			console.error('Game MongoDB synchronization error:', error);
			return res.status(503).json({
				message: 'Game registered on blockchain but could not be synchronized to MongoDB',
				blockchain: {
					gameId: blockchainGameId,
					transactionHash: blockchainResult.transactionHash
				}
			});
		}

		return res.status(201).json({
			message: 'Game created successfully',
			game: savedGame,
			blockchain: {
				gameId: blockchainGameId,
				transactionHash: blockchainResult.transactionHash
			}
		});
	} catch (error) {
		console.error('Game creation error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

router.get('/', authMiddleware, async (req, res) => {
	try {
		await ensureContractAvailable();
		const games = await Game.find();

		return res.status(200).json({
			games: games
		});
	} catch (error) {
		console.error('Game fetch error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

router.get('/:id', authMiddleware, async (req, res) => {
	try {
		if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
			return res.status(400).json({ message: 'Invalid game ID' });
		}

		const game = await Game.findById(req.params.id);
		if (!game) {
			return res.status(404).json({ message: 'Game not found' });
		}

		return res.status(200).json({ game });
	} catch (error) {
		console.error('Game fetch error:', error);
		return res.status(500).json({ message: 'Server error' });
	}
});

router.patch('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
	try {
		const { active } = req.body;
		if (typeof active !== 'boolean') {
			return res.status(400).json({ message: 'Active status is required' });
		}

		if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
			return res.status(400).json({ message: 'Invalid game ID' });
		}

		const game = await Game.findById(req.params.id);
		if (!game) {
			return res.status(404).json({ message: 'Game not found' });
		}

		let transactionHash;
		try {
			transactionHash = await require('../services/blockchainService').setGameActiveOnBlockchain(
				game.blockchainGameId,
				active
			);
		} catch (error) {
			console.error('Game blockchain status update error:', error);
			return res.status(502).json({
				message: 'Unable to update game on the blockchain'
			});
		}
		game.active = active;
		game.statusTransactionHash = transactionHash;
		game.updatedAt = new Date();
		let savedGame;
		try {
			savedGame = await game.save();
		} catch (error) {
			console.error(
				'Game blockchain status confirmed but MongoDB synchronization failed:',
				error
			);
			return res.status(503).json({
				message:
					'Game status updated on the blockchain but could not be synchronized to MongoDB',
				reconciliationRequired: true,
				blockchain: {
					gameId: game.blockchainGameId,
					active,
					transactionHash
				},
				mongo: {
					gameId: game._id
				}
			});
		}

		return res.status(200).json({ game: savedGame });
	} catch (error) {
		console.error('Game status update error:', error);
		return res.status(500).json({ message: 'Unable to update game status' });
	}
});

module.exports = router;
