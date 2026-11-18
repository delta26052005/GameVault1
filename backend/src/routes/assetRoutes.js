const express = require('express');
const mongoose = require('mongoose');
const { ethers } = require('ethers');

const Asset = require('../models/asset');
const Game = require('../models/game');
const GameAccount = require('../models/gameAccount');
const authMiddleware = require('../middleware/authMiddleware');

const { isVerifiedDeveloper } = require('../services/developerService');

const {
	getAssetOwnerFromBlockchain,
	verifyAssetCreationOnBlockchain,
	verifyAssetStatusOnBlockchain,
	toSafeNumber
} = require('../services/blockchainService');

const { gameVault, ensureContractAvailable } = require('../config/blockchain');

const router = express.Router();

// Create an asset
router.post('/', authMiddleware, async (req, res) => {
	try {
		const {
			gameId,
			gameAccountId,
			name,
			quantity,
			transactionHash
		} = req.body;

		// Validate required fields
		if (
			!gameId ||
			!gameAccountId ||
			typeof name !== 'string' ||
			!name.trim() ||
			quantity === undefined ||
			quantity === null ||
			typeof transactionHash !== 'string'
		) {
			return res.status(400).json({
				message: 'Game ID, game account ID, name, quantity, and transaction hash are required'
			});
		}

		// Accept only positive integer quantities
		const normalizedQuantity =
			typeof quantity === 'number'
				? quantity
				: typeof quantity === 'string' && /^\d+$/.test(quantity.trim())
					? Number(quantity.trim())
					: NaN;

		if (
			!mongoose.Types.ObjectId.isValid(gameId) ||
			!mongoose.Types.ObjectId.isValid(gameAccountId) ||
			!Number.isSafeInteger(normalizedQuantity) ||
			normalizedQuantity <= 0 ||
			!ethers.isHexString(transactionHash, 32)
		) {
			return res.status(400).json({
				message: 'Invalid asset creation data'
			});
		}

		const normalizedName = name.trim();

		// Find the game
		const game = await Game.findById(gameId);

		if (!game) {
			return res.status(404).json({
				message: 'Game not found'
			});
		}

		// Find the game account
		const gameAccount = await GameAccount.findById(gameAccountId);

		if (!gameAccount) {
			return res.status(404).json({
				message: 'Game account not found'
			});
		}

		// Ensure the account belongs to a game
		if (!gameAccount.game) {
			return res.status(409).json({
				message: 'Game account is not associated with a game'
			});
		}

		// Ensure the account belongs to the selected game
		if (gameAccount.game.toString() !== game._id.toString()) {
			return res.status(400).json({
				message: 'Game account does not belong to the selected game'
			});
		}

		// Ensure both records are synchronized with the blockchain
		if (
			game.blockchainGameId == null ||
			gameAccount.blockchainAccountId == null
		) {
			return res.status(409).json({
				message: 'Game or game account is not synchronized with the blockchain'
			});
		}

		// Verify the authenticated user's developer wallet
		if (
			!await isVerifiedDeveloper(
				req.user.userId,
				game.developerAddress
			)
		) {
			return res.status(403).json({
				message: 'Only the verified game developer can create assets'
			});
		}

		// Verify the asset creation transaction on the blockchain
		let blockchainResult;

		try {
			blockchainResult = await verifyAssetCreationOnBlockchain(
				transactionHash,
				gameAccount.blockchainAccountId,
				normalizedName,
				normalizedQuantity,
				game.blockchainGameId,
				game.developerAddress
			);
		} catch (error) {
			console.error('Asset blockchain verification error:', error);

			return res.status(400).json({
				message: error.message || 'Asset blockchain verification failed'
			});
		}

		let blockchainAssetId;
		try {
			blockchainAssetId = toSafeNumber(
				blockchainResult.assetId,
				'Blockchain asset ID'
			);
		} catch (error) {
			console.error('Asset blockchain ID conversion error:', error);
			return res.status(502).json({
				message: 'Blockchain asset ID is outside the supported range'
			});
		}

		// Check whether this blockchain asset is already synchronized
		const existingAsset = await Asset.findOne({
			blockchainAssetId
		});

		if (existingAsset) {
			const sameRecord =
				existingAsset.game?.toString() === gameId.toString() &&
				existingAsset.gameAccount?.toString() === gameAccountId.toString() &&
				existingAsset.name === normalizedName &&
				Number(existingAsset.quantity) === normalizedQuantity;

			if (sameRecord) {
				return res.status(200).json({
					message: 'Asset already synchronized',
					asset: existingAsset
				});
			}

			return res.status(409).json({
				message: 'Blockchain asset is already associated with another record'
			});
		}

		// Save the verified asset in MongoDB
		const asset = new Asset({
			game: gameId,
			gameAccount: gameAccountId,
			name: normalizedName,
			quantity: normalizedQuantity,
			blockchainAssetId,
			creationTransactionHash: blockchainResult.transactionHash
		});

		let savedAsset;

		try {
			savedAsset = await asset.save();
		} catch (error) {
			console.error('Asset MongoDB synchronization error:', error);

			if (error.code === 11000) {
				return res.status(409).json({
					message: 'Blockchain asset is already associated with another record'
				});
			}

			return res.status(503).json({
				message: 'Asset created on blockchain but could not be synchronized to MongoDB',
				blockchain: {
					assetId: blockchainAssetId,
					transactionHash: blockchainResult.transactionHash
				}
			});
		}

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


// Get all assets belonging to a game account
router.get('/account/:gameAccountId', authMiddleware, async (req, res) => {
	try {
		const { gameAccountId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(gameAccountId)) {
			return res.status(400).json({
				message: 'Invalid game account ID'
			});
		}

		await ensureContractAvailable();

		const assets = await Asset.find({
			gameAccount: gameAccountId
		})
			.populate('game')
			.populate('gameAccount');

		const verifiedAssets = await Promise.all(
			assets.map(async asset => {
				const data = asset.toObject();

				if (
					!asset.game ||
					!asset.gameAccount ||
					asset.blockchainAssetId == null ||
					asset.game.blockchainGameId == null ||
					asset.gameAccount.blockchainAccountId == null
				) {
					data.blockchainVerified = false;
					return data;
				}

				try {
					const blockchainAsset = await gameVault.getAsset(
						asset.blockchainAssetId
					);

					data.blockchainVerified =
						blockchainAsset.gameId.toString() ===
							asset.game.blockchainGameId.toString() &&
						blockchainAsset.accountId.toString() ===
							asset.gameAccount.blockchainAccountId.toString() &&
						blockchainAsset.name === asset.name &&
						blockchainAsset.quantity.toString() ===
							asset.quantity.toString() &&
						blockchainAsset.active === asset.active;

				} catch (error) {
					data.blockchainVerified = false;
				}

				return data;
			})
		);

		return res.status(200).json({
			assets: verifiedAssets
		});

	} catch (error) {
		console.error('Asset account fetch error:', error);

		return res.status(500).json({
			message: 'Server error'
		});
	}
});


// Get an asset's blockchain owner
router.get('/blockchain-owner/:assetId', authMiddleware, async (req, res) => {
	const { assetId } = req.params;

	try {
		if (!/^(0|[1-9]\d*)$/.test(assetId)) {
			return res.status(400).json({
				message: 'Invalid blockchain asset ID'
			});
		}

		const owner = await getAssetOwnerFromBlockchain(assetId);

		return res.status(200).json({
			assetId,
			ownerWallet: owner
		});

	} catch (error) {
		console.error('Blockchain owner fetch error:', error);

		return res.status(500).json({
			message: 'Failed to fetch blockchain ownership'
		});
	}
});


// Get a single asset
router.get('/:id', authMiddleware, async (req, res) => {
	try {
		if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
			return res.status(400).json({
				message: 'Invalid asset ID'
			});
		}

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


// Change asset active status
router.patch('/:id/status', authMiddleware, async (req, res) => {
	try {
		const { active, transactionHash } = req.body;

		if (
			typeof active !== 'boolean' ||
			typeof transactionHash !== 'string' ||
			!ethers.isHexString(transactionHash, 32)
		) {
			return res.status(400).json({
				message: 'Active status and a valid transaction hash are required'
			});
		}

		if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
			return res.status(400).json({
				message: 'Invalid asset ID'
			});
		}

		const asset = await Asset.findById(req.params.id).populate('game');

		if (!asset) {
			return res.status(404).json({
				message: 'Asset not found'
			});
		}

		if (!asset.game) {
			return res.status(409).json({
				message: 'Asset is not associated with a game'
			});
		}

		if (
			asset.blockchainAssetId == null ||
			asset.game.blockchainGameId == null
		) {
			return res.status(409).json({
				message: 'Asset is not synchronized with the blockchain'
			});
		}

		// Verify that the authenticated user is the game's developer
		if (
			!await isVerifiedDeveloper(
				req.user.userId,
				asset.game.developerAddress
			)
		) {
			return res.status(403).json({
				message: 'Only the verified game developer can manage this asset'
			});
		}

		// Verify the developer-signed transaction before updating MongoDB
		try {
			await verifyAssetStatusOnBlockchain(
				transactionHash,
				asset.blockchainAssetId,
				asset.game.blockchainGameId,
				active,
				asset.game.developerAddress
			);

		} catch (error) {
			console.error('Asset blockchain status update error:', error);

			return res.status(502).json({
				message: 'Unable to verify the asset status update on the blockchain'
			});
		}

		// Synchronize MongoDB after blockchain verification
		asset.active = active;
		asset.statusTransactionHash = transactionHash;
		asset.updatedAt = new Date();

		let savedAsset;
		try {
			savedAsset = await asset.save();
		} catch (error) {
			console.error(
				'Asset blockchain status confirmed but MongoDB synchronization failed:',
				error
			);

			return res.status(503).json({
				message:
					'Asset status updated on the blockchain but could not be synchronized to MongoDB',
				reconciliationRequired: true,
				blockchain: {
					assetId: asset.blockchainAssetId,
					gameId: asset.game.blockchainGameId,
					active,
					transactionHash
				},
				mongo: {
					assetId: asset._id
				}
			});
		}

		return res.status(200).json({
			asset: savedAsset
		});

	} catch (error) {
		console.error('Asset status update error:', error);

		return res.status(500).json({
			message: 'Unable to update asset status'
		});
	}
});

module.exports = router;
