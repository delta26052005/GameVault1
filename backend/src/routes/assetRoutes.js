const express = require('express');
const Asset = require('../models/asset');
const Game = require('../models/game');
const GameAccount = require('../models/gameAccount');
const authMiddleware = require('../middleware/authMiddleware');
const {
	getAssetOwnerFromBlockchain,
	verifyAssetCreationOnBlockchain
} = require('../services/blockchainService');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
	try {
		const {
			gameId,
			gameAccountId,
			name,
			quantity,
			transactionHash
		} = req.body;

		if (!gameId || !gameAccountId || !name || !quantity || !transactionHash) {
			return res.status(400).json({
				message: 'Game ID, game account ID, name, quantity, and transaction hash are required'
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

		let blockchainResult;

		try {
			blockchainResult = await verifyAssetCreationOnBlockchain(
				transactionHash,
				gameAccount.blockchainAccountId,
				name,
				quantity
			);
		} catch (error) {
			return res.status(400).json({
				message: error.message
			});
		}

		const asset = new Asset({
			game: gameId,
			gameAccount: gameAccountId,
			name,
			quantity,
			blockchainAssetId: Number(blockchainResult.assetId)
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

router.get('/account/:gameAccountId', authMiddleware, async (req, res) => {
	try {
		const assets = await Asset.find({
			gameAccount: req.params.gameAccountId
		})
			.populate('game')
			.populate('gameAccount');

		return res.status(200).json({
			assets
		});
	} catch (error) {
		console.error('Asset account fetch error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

router.get('/blockchain-owner/:assetId', authMiddleware, async (req, res) => {
	const { assetId } = req.params;

	try {
		const owner = await getAssetOwnerFromBlockchain(assetId);

		return res.status(200).json({
			assetId,
			ownerWallet: owner
		});
	} catch (error) {
		return res.status(500).json({
			message: 'Failed to fetch blockchain ownership'
		});
	}
});

router.get('/:id', authMiddleware, async (req, res) => {
	try {
		const asset = await Asset.findById(req.params.id)
			.populate('game')
			.populate('gameAccount');

		if (!asset) {
			return res.status(404).json({
				message: 'Asset not found'
			});
		}

		return res.status(200).json({
			asset
		});
	} catch (error) {
		console.error('Asset fetch error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

module.exports = router;
