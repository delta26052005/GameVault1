const express = require('express');
const GameAccount = require('../models/gameAccount');
const Game = require('../models/game');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
	try {
		const {
			gameId,
			externalAccountId,
			ownerWallet,
			blockchainAccountId
		} = req.body;

		if (!gameId || !externalAccountId || !ownerWallet || !blockchainAccountId) {
			return res.status(400).json({
				message: 'Game ID, external account ID, owner wallet, and blockchain account ID are required'
			});
		}

		const game = await Game.findById(gameId);

		if (!game) {
			return res.status(404).json({
				message: 'Game not found'
			});
		}

		const gameAccount = new GameAccount({
			game: gameId,
			externalAccountId,
			ownerWallet,
			blockchainAccountId
		});
		const savedGameAccount = await gameAccount.save();

		return res.status(201).json({
			message: 'Game account linked successfully',
			gameAccount: savedGameAccount
		});
	} catch (error) {
		console.error('Game account linking error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

module.exports = router;
