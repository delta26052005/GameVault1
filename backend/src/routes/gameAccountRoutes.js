const express = require('express');
const { ethers } = require('ethers');
const GameAccount = require('../models/gameAccount');
const Game = require('../models/game');
const authMiddleware = require('../middleware/authMiddleware');
const { isVerifiedDeveloper } = require('../services/developerService');
const {
	getGameAccountOwnerFromBlockchain,
	verifyAccountTransferOnBlockchain,
	verifyGameAccountLinkOnBlockchain
} = require('../services/blockchainService');

const router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
	try {
		const {
			gameId,
			externalAccountId,
			ownerWallet,
			transactionHash
		} = req.body;

		if (!gameId || !externalAccountId || !ownerWallet || !transactionHash) {
			return res.status(400).json({
				message: 'Game ID, external account ID, owner wallet, and transaction hash are required'
			});
		}

		const game = await Game.findById(gameId);

		if (!game) {
			return res.status(404).json({
				message: 'Game not found'
			});
		}

		const isDeveloper = await isVerifiedDeveloper(
			req.user.userId,
			game.developerAddress
		);

		if (!isDeveloper) {
			return res.status(403).json({
				message: 'Only the verified game developer can link game accounts'
			});
		}

		let blockchainResult;

		try {
			blockchainResult = await verifyGameAccountLinkOnBlockchain(
				transactionHash,
				game.blockchainGameId,
				externalAccountId,
				ownerWallet
			);
		} catch (error) {
			return res.status(400).json({
				message: error.message
			});
		}

		const gameAccount = new GameAccount({
			game: gameId,
			externalAccountId,
			ownerWallet,
			blockchainAccountId: Number(blockchainResult.accountId)
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

router.get('/blockchain-owner/:accountId', authMiddleware, async (req, res) => {
	const { accountId } = req.params;

	try {
		const owner = await getGameAccountOwnerFromBlockchain(accountId);

		return res.status(200).json({
			accountId,
			ownerWallet: owner
		});
	} catch (error) {
		return res.status(500).json({
			message: 'Failed to fetch blockchain ownership'
		});
	}
});

router.post('/transfer/confirm', authMiddleware, async (req, res) => {
	try {
		const { transactionHash, gameAccountId, accountId, newOwner } = req.body;

		if (!transactionHash || !gameAccountId || !accountId || !newOwner) {
			return res.status(400).json({
				message: 'Transaction hash, game account ID, account ID, and new owner are required'
			});
		}

		if (!ethers.isAddress(newOwner)) {
			return res.status(400).json({
				message: 'Invalid new owner wallet address'
			});
		}

		const gameAccount = await GameAccount.findById(gameAccountId);

		if (!gameAccount) {
			return res.status(404).json({
				message: 'Game account not found'
			});
		}

		if (
			gameAccount.blockchainAccountId.toString() !== accountId.toString()
		) {
			return res.status(400).json({
				message: 'Blockchain account ID does not match the game account'
			});
		}

		let blockchainResult;

		try {
			blockchainResult = await verifyAccountTransferOnBlockchain(
				transactionHash,
				accountId,
				newOwner
			);
		} catch (error) {
			return res.status(400).json({
				message: error.message
			});
		}

		if (
			blockchainResult.previousOwner.toLowerCase() !==
			gameAccount.ownerWallet.toLowerCase()
		) {
			return res.status(400).json({
				message: 'Blockchain previous owner does not match the current database owner'
			});
		}

		gameAccount.ownerWallet = blockchainResult.newOwner;
		const savedGameAccount = await gameAccount.save();

		return res.status(200).json({
			message: 'Account ownership synchronized successfully',
			gameAccount: savedGameAccount
		});
	} catch (error) {
		console.error('Account ownership synchronization error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

router.get('/', authMiddleware, async (req, res) => {
	try {
		const gameAccounts = await GameAccount.find().populate('game');

		return res.status(200).json({
			gameAccounts
		});
	} catch (error) {
		console.error('Game account list error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

router.get('/:id', authMiddleware, async (req, res) => {
	try {
		const gameAccount = await GameAccount.findById(req.params.id).populate('game');

		if (!gameAccount) {
			return res.status(404).json({
				message: 'Game account not found'
			});
		}

		return res.status(200).json({
			gameAccount
		});
	} catch (error) {
		console.error('Game account fetch error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

module.exports = router;
