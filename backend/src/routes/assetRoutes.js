const express = require('express');
const Asset = require('../models/asset');
const Game = require('../models/game');
const GameAccount = require('../models/gameAccount');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
	try {
		const {
			gameId,
			gameAccountId,
			name,
			quantity,
			blockchainAssetId
		} = req.body;

		if (!gameId || !gameAccountId || !name || !quantity || !blockchainAssetId) {
			return res.status(400).json({
				message: 'Game ID, game account ID, name, quantity, and blockchain asset ID are required'
			});
		}

		const game = await Game.findById(gameId);

		if (!game) {
			return res.status(404).json({
				message: 'Game not found'
			});
		}

		const gameAccount = await GameAccount.findById(gameAccountId);

		if (!gameAccount) {
			return res.status(404).json({
				message: 'Game account not found'
			});
		}

		const asset = new Asset({
			game: gameId,
			gameAccount: gameAccountId,
			name,
			quantity,
			blockchainAssetId
		});
		const savedAsset = await asset.save();

		return res.status(201).json({
			message: 'Asset created successfully',
			asset: savedAsset
		});
	} catch (error) {
		console.error('Asset creation error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

module.exports = router;
