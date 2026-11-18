const express = require('express');
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const GameAccount = require('../models/gameAccount');
const Game = require('../models/game');
const authMiddleware = require('../middleware/authMiddleware');
const { isVerifiedDeveloper } = require('../services/developerService');
const {
	getGameAccountOwnerFromBlockchain,
	getCurrentGameAccountIds,
	verifyAccountTransferOnBlockchain,
	verifyGameAccountLinkOnBlockchain,
	toSafeNumber
} = require('../services/blockchainService');
const { gameVault, ensureContractAvailable } = require('../config/blockchain');

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

		if (
			!mongoose.Types.ObjectId.isValid(gameId) ||
			!ethers.isAddress(ownerWallet) ||
			!ethers.isHexString(transactionHash, 32)
		) {
			return res.status(400).json({ message: 'Invalid game account data' });
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
				ownerWallet,
				game.developerAddress
			);
		} catch (error) {
			return res.status(400).json({
				message: error.message
			});
		}

		let blockchainAccountId;
		try {
			blockchainAccountId = toSafeNumber(
				blockchainResult.accountId,
				'Blockchain account ID'
			);
		} catch (error) {
			console.error('Game account blockchain ID conversion error:', error);
			return res.status(502).json({
				message: 'Blockchain account ID is outside the supported range'
			});
		}

		const existingAccount = await GameAccount.findOne({
			game: gameId,
			externalAccountId
		});
		if (existingAccount) {
			if (
				existingAccount.blockchainAccountId != null &&
				existingAccount.blockchainAccountId.toString() ===
				blockchainAccountId.toString()
			) {
				return res.status(200).json({
					message: 'Game account already synchronized',
					gameAccount: existingAccount
				});
			}

			return res.status(409).json({
				message: 'Game account already exists with a different blockchain record'
			});
		}

		const existingBlockchainAccount = await GameAccount.findOne({
			blockchainAccountId
		});
		if (existingBlockchainAccount) {
			if (existingAccount?._id.toString() === existingBlockchainAccount._id.toString()) {
				return res.status(200).json({
					message: 'Game account already synchronized',
					gameAccount: existingBlockchainAccount
				});
			}

			return res.status(409).json({
				message: 'Blockchain account is already associated with another record'
			});
		}

		const gameAccount = new GameAccount({
			game: gameId,
			externalAccountId,
			ownerWallet,
			blockchainAccountId,
			linkTransactionHash: blockchainResult.transactionHash
		});
		let savedGameAccount;
		try {
			savedGameAccount = await gameAccount.save();
		} catch (error) {
			console.error('Game account MongoDB synchronization error:', error);
			return res.status(503).json({
				message: 'Game account linked on blockchain but could not be synchronized to MongoDB',
				blockchain: {
					accountId: blockchainAccountId,
					transactionHash: blockchainResult.transactionHash
				}
			});
		}

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
		const currentAccountIds = await getCurrentGameAccountIds();
		if (!currentAccountIds.has(accountId)) {
			return res.status(404).json({
				message: 'Game account is unavailable on the current blockchain'
			});
		}

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

		if (
			!mongoose.Types.ObjectId.isValid(gameAccountId) ||
			!/^(0x)?[0-9a-f]+$/i.test(String(accountId)) ||
			!ethers.isHexString(transactionHash, 32)
		) {
			return res.status(400).json({ message: 'Invalid transfer data' });
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

		const currentAccountIds = await getCurrentGameAccountIds();
		if (!currentAccountIds.has(accountId.toString())) {
			return res.status(409).json({
				message: 'Game account is unavailable on the current blockchain'
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

		const existingTransfer = gameAccount.transferHistory.find(
			transfer => transfer.transactionHash === transactionHash
		);

		if (existingTransfer) {
			return res.status(200).json({
				message: 'Account ownership already synchronized',
				gameAccount
			});
		}

		if (
			!ethers.isAddress(gameAccount.ownerWallet) ||
			ethers.getAddress(blockchainResult.previousOwner) !==
			ethers.getAddress(gameAccount.ownerWallet)
		) {
			return res.status(400).json({
				message: 'Blockchain previous owner does not match the current database owner'
			});
		}

		gameAccount.ownerWallet = blockchainResult.newOwner;
		gameAccount.transferHistory.push({
			transactionHash,
			previousOwner: blockchainResult.previousOwner,
			newOwner: blockchainResult.newOwner
		});
		let savedGameAccount;
		try {
			savedGameAccount = await gameAccount.save();
		} catch (error) {
			console.error('Transfer MongoDB synchronization error:', error);
			return res.status(503).json({
				message: 'Ownership transferred on blockchain but could not be synchronized to MongoDB',
				transactionHash
			});
		}

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
		await ensureContractAvailable();
		const gameAccounts = await GameAccount.find().populate('game');
		const currentAccountIds = await getCurrentGameAccountIds();
		const verifiedAccounts = await Promise.all(
			gameAccounts.map(async account => {
				const data = account.toObject();
				if (account.blockchainAccountId === undefined || account.blockchainAccountId === null) {
					data.blockchainAccountExists = false;
					data.blockchainVerified = false;
					return data;
				}

				data.blockchainAccountExists = currentAccountIds.has(
					account.blockchainAccountId.toString()
				);

				if (
					!data.blockchainAccountExists ||
					!account.game ||
					account.game.blockchainGameId == null
				) {
					data.blockchainVerified = false;
					return data;
				}

				try {
					const blockchainAccount = await gameVault.getGameAccount(
						account.blockchainAccountId
					);
					data.blockchainVerified =
						blockchainAccount.gameId.toString() ===
							account.game.blockchainGameId.toString() &&
						blockchainAccount.externalAccountId === account.externalAccountId &&
						blockchainAccount.owner.toLowerCase() ===
							account.ownerWallet.toLowerCase();
				} catch {
					data.blockchainVerified = false;
				}
				return data;
			})
		);

		return res.status(200).json({
			gameAccounts: verifiedAccounts
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
