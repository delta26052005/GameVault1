const express = require('express');
const Game = require('../models/game');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
	try {
		const { name, developerAddress, blockchainGameId, description } = req.body;

		if (!name || !developerAddress || !blockchainGameId) {
			return res.status(400).json({
				message: 'Name, developer address, and blockchain game ID are required'
			});
		}

		const game = new Game({
			name,
			developerAddress,
			blockchainGameId,
			description
		});
		const savedGame = await game.save();

		return res.status(201).json({
			message: 'Game created successfully',
			game: savedGame
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

module.exports = router;
