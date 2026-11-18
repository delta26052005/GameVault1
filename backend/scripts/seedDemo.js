const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { ethers } = require('ethers');
const Game = require('../src/models/game');
const GameAccount = require('../src/models/gameAccount');
const Asset = require('../src/models/asset');
const { gameVault, provider, wallet } = require('../src/config/blockchain');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const contractAddress = process.env.GAMEVAULT_CONTRACT_ADDRESS;
const normalized = address => ethers.getAddress(address).toLowerCase();

function toSafeNumber(value, fieldName) {
	const numericValue = BigInt(value.toString());

	if (
		numericValue <= 0n ||
		numericValue > BigInt(Number.MAX_SAFE_INTEGER)
	) {
		throw new Error(`${fieldName} exceeds the supported safe integer range`);
	}

	return Number(numericValue);
}

async function assertReceipt(receipt, description) {
	if (
		!receipt ||
		receipt.status !== 1 ||
		receipt.to?.toLowerCase() !== contractAddress.toLowerCase()
	) {
		throw new Error(`${description} transaction could not be verified`);
	}
}

function parseEvent(receipt, eventName) {
	for (const log of receipt.logs) {
		if (
			typeof log.address !== 'string' ||
			log.address.toLowerCase() !== gameVault.target.toLowerCase()
		) {
			continue;
		}

		try {
			const parsed = gameVault.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (parsed?.name === eventName) {
				return parsed;
			}
		} catch {
			continue;
		}
	}

	throw new Error(`${eventName} event not found`);
}

function isExpectedNotFound(error, errorName) {
	const data = error?.data || error?.info?.error?.data;
	if (!data) return false;

	try {
		return gameVault.interface.parseError(data)?.name === errorName;
	} catch {
		return false;
	}
}

async function readCurrentGames() {
	const games = [];

	for (let id = 1n; ; id += 1n) {
		try {
			games.push(await gameVault.getGame(id));
		} catch (error) {
			if (isExpectedNotFound(error, 'GameNotFound')) return games;
			throw error;
		}
	}
}

async function readCurrentAccounts() {
	const accounts = [];

	for (let id = 1n; ; id += 1n) {
		try {
			accounts.push(await gameVault.getGameAccount(id));
		} catch (error) {
			if (isExpectedNotFound(error, 'AccountNotFound')) return accounts;
			throw error;
		}
	}
}

async function readCurrentAssets() {
	const assets = [];

	for (let id = 1n; ; id += 1n) {
		try {
			assets.push(await gameVault.getAsset(id));
		} catch (error) {
			if (isExpectedNotFound(error, 'AssetNotFound')) return assets;
			throw error;
		}
	}
}

async function findSigner(address, availableAddresses) {
	const match = availableAddresses.find(
		available => normalized(available) === normalized(address)
	);

	if (!match) return null;

	const signer = await provider.getSigner(match);
	const managedSigner = new ethers.NonceManager(signer);
	managedSigner.reset();
	return managedSigner;
}

async function ensureGame(mongoGame, adminContract, currentGames, claimedGameIds) {
	if (!ethers.isAddress(mongoGame.developerAddress)) {
		console.log(`SKIP game ${mongoGame.name}: developer wallet is invalid`);
		return null;
	}

	const storedGameId = mongoGame.blockchainGameId == null
		? null
		: mongoGame.blockchainGameId.toString();
	const matchingGames = currentGames.filter(
		game =>
			!claimedGameIds.has(game.gameId.toString()) &&
			game.name === mongoGame.name &&
			normalized(game.developer) === normalized(mongoGame.developerAddress)
	);
	const identityGames = currentGames.filter(
		game =>
			game.name === mongoGame.name &&
			normalized(game.developer) === normalized(mongoGame.developerAddress)
	);
	const storedGame = matchingGames.find(
		game => storedGameId !== null && game.gameId.toString() === storedGameId
	) || (matchingGames.length === 1 ? matchingGames[0] : null);

	if (matchingGames.length > 1 && !storedGame) {
		throw new Error(`Ambiguous blockchain games match MongoDB game ${mongoGame._id}`);
	}
	if (!storedGame && identityGames.length > 0) {
		throw new Error(`Unclaimed blockchain game match is unavailable for MongoDB game ${mongoGame._id}`);
	}

	if (storedGame) {
		console.log(`MATCH game ${mongoGame.name}: blockchain #${storedGame.gameId}`);
		if (storedGame.active !== mongoGame.active) {
			const transaction = await adminContract.setGameActive(
				storedGame.gameId,
				mongoGame.active
			);
			const receipt = await transaction.wait();
			await assertReceipt(receipt, 'Game status');
			const event = parseEvent(receipt, 'GameStatusChanged');
			if (
				event.args.gameId.toString() !== storedGame.gameId.toString() ||
				event.args.active !== mongoGame.active ||
				normalized(event.args.changedBy) !== normalized(receipt.from)
			) {
				throw new Error('Game status event did not match the requested state');
			}
			console.log(`RECONCILE game status ${mongoGame.name}: ${mongoGame.active}`);
		}

		const verified = await gameVault.getGame(storedGame.gameId);
		if (
			verified.name !== mongoGame.name ||
			normalized(verified.developer) !== normalized(mongoGame.developerAddress) ||
			verified.active !== mongoGame.active
		) {
			throw new Error(`Game read-back did not match MongoDB game ${mongoGame._id}`);
		}
		await Game.updateOne(
			{ _id: mongoGame._id },
			{
				$set: {
					blockchainGameId: toSafeNumber(verified.gameId, 'Blockchain game ID'),
					active: verified.active
				}
			}
		);
		claimedGameIds.add(verified.gameId.toString());
		return verified;
	}

	console.log(`CREATE game ${mongoGame.name}`);
	const transaction = await adminContract.registerGame(
		mongoGame.name,
		mongoGame.developerAddress
	);
	const receipt = await transaction.wait();
	await assertReceipt(receipt, 'Game registration');
	const event = parseEvent(receipt, 'GameRegistered');

	if (
		normalized(event.args.developer) !== normalized(mongoGame.developerAddress) ||
		event.args.name !== mongoGame.name ||
		normalized(event.args.registeredBy) !== normalized(receipt.from)
	) {
		throw new Error('GameRegistered event did not match the MongoDB game');
	}

	const verified = await gameVault.getGame(event.args.gameId);
	if (
		verified.name !== mongoGame.name ||
		normalized(verified.developer) !== normalized(mongoGame.developerAddress)
	) {
		throw new Error('Registered game read-back did not match MongoDB');
	}

	if (verified.active !== mongoGame.active) {
		const statusTransaction = await adminContract.setGameActive(
			verified.gameId,
			mongoGame.active
		);
		const statusReceipt = await statusTransaction.wait();
		await assertReceipt(statusReceipt, 'Game status');
		const statusEvent = parseEvent(statusReceipt, 'GameStatusChanged');
		if (
			statusEvent.args.active !== mongoGame.active ||
			statusEvent.args.gameId.toString() !== verified.gameId.toString() ||
			normalized(statusEvent.args.changedBy) !== normalized(statusReceipt.from)
		) {
			throw new Error('Game status event did not match MongoDB');
		}
		console.log(`RECONCILE game status ${mongoGame.name}: ${mongoGame.active}`);
	}

	const finalGame = await gameVault.getGame(verified.gameId);
	await Game.updateOne(
		{ _id: mongoGame._id },
		{
			$set: {
				blockchainGameId: toSafeNumber(finalGame.gameId, 'Blockchain game ID'),
				active: finalGame.active
			}
		}
	);
	claimedGameIds.add(finalGame.gameId.toString());
	currentGames.push(finalGame);
	return finalGame;
}

async function ensureAccount(
	mongoAccount,
	mongoGame,
	currentGame,
	developerSigner,
	currentAccounts,
	claimedAccountIds
) {
	if (!currentGame) {
		console.log(
			`SKIP account ${mongoAccount.externalAccountId}: parent game was not reconstructed`
		);
		return null;
	}
	if (!ethers.isAddress(mongoAccount.ownerWallet)) {
		console.log(`SKIP account ${mongoAccount.externalAccountId}: owner wallet is invalid`);
		return null;
	}

	const accountCandidates = currentAccounts.filter(
		account =>
			account.gameId.toString() === currentGame.gameId.toString() &&
			account.externalAccountId === mongoAccount.externalAccountId
	);
	const existing = accountCandidates.find(
		account =>
			!claimedAccountIds.has(account.accountId.toString()) &&
			account.externalAccountId === mongoAccount.externalAccountId
	);

	if (existing) {
		claimedAccountIds.add(existing.accountId.toString());
		if (normalized(existing.owner) !== normalized(mongoAccount.ownerWallet)) {
			console.log(`SKIP account ${mongoAccount.externalAccountId}: current-chain owner differs`);
			return null;
		}

		await GameAccount.updateOne(
			{ _id: mongoAccount._id },
			{
				$set: {
					blockchainAccountId: toSafeNumber(
						existing.accountId,
						'Blockchain account ID'
					),
					ownerWallet: existing.owner
				}
			}
		);
		console.log(`MATCH account ${mongoAccount.externalAccountId}: blockchain #${existing.accountId}`);
		return existing;
	}
	if (accountCandidates.length > 0) {
		console.log(
			`SKIP account ${mongoAccount.externalAccountId}: blockchain record already matched another MongoDB record`
		);
		return null;
	}

	if (!developerSigner) {
		console.log(
			`SKIP account ${mongoAccount.externalAccountId}: developer wallet is unavailable as a signer`
		);
		return null;
	}

	const developerContract = gameVault.connect(developerSigner);
	const transaction = await developerContract.linkGameAccount(
		currentGame.gameId,
		mongoAccount.externalAccountId,
		mongoAccount.ownerWallet
	);
	const receipt = await transaction.wait();
	await assertReceipt(receipt, 'Game account link');
	const event = parseEvent(receipt, 'GameAccountLinked');

	if (
		event.args.gameId.toString() !== currentGame.gameId.toString() ||
		event.args.externalAccountId !== mongoAccount.externalAccountId ||
		normalized(event.args.owner) !== normalized(mongoAccount.ownerWallet) ||
		normalized(event.args.linkedBy) !== normalized(mongoGame.developerAddress) ||
		normalized(event.args.linkedBy) !== normalized(receipt.from)
	) {
		throw new Error('GameAccountLinked event did not match MongoDB');
	}

	const verified = await gameVault.getGameAccount(event.args.accountId);
	if (
		verified.gameId.toString() !== currentGame.gameId.toString() ||
		verified.externalAccountId !== mongoAccount.externalAccountId ||
		normalized(verified.owner) !== normalized(mongoAccount.ownerWallet)
	) {
		throw new Error('Game account read-back did not match MongoDB');
	}

	await GameAccount.updateOne(
		{ _id: mongoAccount._id },
		{
			$set: {
				blockchainAccountId: toSafeNumber(
					verified.accountId,
					'Blockchain account ID'
				),
				ownerWallet: verified.owner
			}
		}
	);
	currentAccounts.push(verified);
	claimedAccountIds.add(verified.accountId.toString());
	console.log(`CREATE account ${mongoAccount.externalAccountId}: blockchain #${verified.accountId}`);
	return verified;
}


async function ensureAsset(mongoAsset, mongoAccount, currentGame, currentAccount, developerSigner, currentAssets, usedAssetIds) {
	if (!currentGame || !currentAccount) {
		console.log(`SKIP asset ${mongoAsset.name}: parent account was not reconstructed`);
		return null;
	}

	const assetCandidates = currentAssets.filter(
		asset =>
			asset.gameId.toString() === currentGame.gameId.toString() &&
			asset.accountId.toString() === currentAccount.accountId.toString() &&
			asset.name === mongoAsset.name &&
			asset.quantity.toString() === mongoAsset.quantity.toString()
	);
	const storedAssetId = mongoAsset.blockchainAssetId == null
	? null
	: mongoAsset.blockchainAssetId.toString();
	const existing = currentAssets.find(
		asset =>
			!usedAssetIds.has(asset.assetId.toString()) &&
		storedAssetId !== null &&
		asset.assetId.toString() === storedAssetId &&
			asset.gameId.toString() === currentGame.gameId.toString() &&
			asset.accountId.toString() === currentAccount.accountId.toString() &&
			asset.name === mongoAsset.name &&
			asset.quantity.toString() === mongoAsset.quantity.toString()
	) || currentAssets.find(
		asset =>
			!usedAssetIds.has(asset.assetId.toString()) &&
			asset.gameId.toString() === currentGame.gameId.toString() &&
			asset.accountId.toString() === currentAccount.accountId.toString() &&
			asset.name === mongoAsset.name &&
			asset.quantity.toString() === mongoAsset.quantity.toString()
	);
	if (!existing && assetCandidates.length > 0) {
		console.log(
			`SKIP asset ${mongoAsset.name}: blockchain record already matched another MongoDB record`
		);
		return null;
	}

	if (existing) {
		usedAssetIds.add(existing.assetId.toString());
		if (existing.active !== mongoAsset.active) {
			if (!developerSigner) {
				console.log(
					`SKIP asset ${mongoAsset.name}: developer wallet is unavailable for status reconciliation`
				);
				return existing;
			}

			const developerContract = gameVault.connect(developerSigner);
			const transaction = await developerContract.setAssetActive(
				existing.assetId,
				mongoAsset.active
			);
			const receipt = await transaction.wait();
			await assertReceipt(receipt, 'Asset status');
			const event = parseEvent(receipt, 'AssetStatusChanged');
			if (
				event.args.assetId.toString() !== existing.assetId.toString() ||
				event.args.gameId.toString() !== currentGame.gameId.toString() ||
				event.args.active !== mongoAsset.active ||
				normalized(event.args.changedBy) !== normalized(receipt.from)
			) {
				throw new Error('Asset status event did not match MongoDB');
			}
			console.log(`RECONCILE asset status ${mongoAsset.name}: ${mongoAsset.active}`);
		}

		const verified = await gameVault.getAsset(existing.assetId);
		if (
			verified.gameId.toString() !== currentGame.gameId.toString() ||
			verified.accountId.toString() !== currentAccount.accountId.toString() ||
			verified.name !== mongoAsset.name ||
			verified.quantity.toString() !== mongoAsset.quantity.toString() ||
			verified.active !== mongoAsset.active
		) {
			throw new Error(`Asset read-back did not match MongoDB asset ${mongoAsset._id}`);
		}
		await Asset.updateOne(
			{ _id: mongoAsset._id },
			{
				$set: {
					blockchainAssetId: toSafeNumber(
						verified.assetId,
						'Blockchain asset ID'
					),
					active: verified.active
				}
			}
		);
		console.log(`MATCH asset ${mongoAsset.name}: blockchain #${verified.assetId}`);
		return verified;
	}

	if (!developerSigner) {
		console.log(
			`SKIP asset ${mongoAsset.name}: developer wallet is unavailable as a signer`
		);
		return null;
	}

	const developerContract = gameVault.connect(developerSigner);
	const transaction = await developerContract.addAsset(
		currentAccount.accountId,
		mongoAsset.name,
		mongoAsset.quantity
	);
	const receipt = await transaction.wait();
	await assertReceipt(receipt, 'Asset creation');
	const event = parseEvent(receipt, 'AssetAdded');

	if (
		event.args.gameId.toString() !== currentGame.gameId.toString() ||
		event.args.accountId.toString() !== currentAccount.accountId.toString() ||
		event.args.name !== mongoAsset.name ||
		event.args.quantity.toString() !== mongoAsset.quantity.toString() ||
		normalized(event.args.addedBy) !== normalized(receipt.from)
	) {
		throw new Error('AssetAdded event did not match MongoDB');
	}

	const verified = await gameVault.getAsset(event.args.assetId);
	if (
		verified.gameId.toString() !== currentGame.gameId.toString() ||
		verified.accountId.toString() !== currentAccount.accountId.toString() ||
		verified.name !== mongoAsset.name ||
		verified.quantity.toString() !== mongoAsset.quantity.toString()
	) {
		throw new Error('Asset read-back did not match MongoDB');
	}

	if (verified.active !== mongoAsset.active) {
		const statusTransaction = await developerContract.setAssetActive(
			verified.assetId,
			mongoAsset.active
		);
		const statusReceipt = await statusTransaction.wait();
		await assertReceipt(statusReceipt, 'Asset status');
		const statusEvent = parseEvent(statusReceipt, 'AssetStatusChanged');
		if (
			statusEvent.args.assetId.toString() !== verified.assetId.toString() ||
			statusEvent.args.gameId.toString() !== currentGame.gameId.toString() ||
			statusEvent.args.active !== mongoAsset.active ||
			normalized(statusEvent.args.changedBy) !== normalized(statusReceipt.from)
		) {
			throw new Error('Asset status event did not match MongoDB');
		}
		console.log(`RECONCILE asset status ${mongoAsset.name}: ${mongoAsset.active}`);
	}

	const finalAsset = await gameVault.getAsset(verified.assetId);
	if (
		finalAsset.gameId.toString() !== currentGame.gameId.toString() ||
		finalAsset.accountId.toString() !== currentAccount.accountId.toString() ||
		finalAsset.name !== mongoAsset.name ||
		finalAsset.quantity.toString() !== mongoAsset.quantity.toString() ||
		finalAsset.active !== mongoAsset.active
	) {
		throw new Error(`Asset final read-back did not match MongoDB asset ${mongoAsset._id}`);
	}
	usedAssetIds.add(finalAsset.assetId.toString());
	await Asset.updateOne(
		{ _id: mongoAsset._id },
		{
			$set: {
				blockchainAssetId: toSafeNumber(
					finalAsset.assetId,
					'Blockchain asset ID'
				),
				active: finalAsset.active
			}
		}
	);
	currentAssets.push(finalAsset);
	console.log(`CREATE asset ${mongoAsset.name}: blockchain #${finalAsset.assetId}`);
	return finalAsset;
}

async function seedDemo() {
	if (!contractAddress) {
		throw new Error('GAMEVAULT_CONTRACT_ADDRESS is not configured');
	}

	const code = await provider.getCode(contractAddress);
	if (code === '0x') {
		throw new Error('GameVault is not deployed. Deploy it to localhost before running seed:demo.');
	}

	const adminAddress = await gameVault.admin();
	if (normalized(adminAddress) !== normalized(wallet.address)) {
		throw new Error('Configured blockchain wallet is not the GameVault admin');
	}

	const availableAddresses = await provider.send('eth_accounts', []);
	const managedAdmin = new ethers.NonceManager(wallet);
	managedAdmin.reset();
	const adminContract = gameVault.connect(managedAdmin);
	const mongoGames = await Game.find({}).sort({ createdAt: 1 });

	const currentGames = await readCurrentGames();
	const currentAccounts = await readCurrentAccounts();
	const currentAssets = await readCurrentAssets();
	const usedAssetIds = new Set();
	const currentGameMap = new Map();
	const claimedGameIds = new Set();
	const claimedAccountIds = new Set();

	for (const mongoGame of mongoGames) {
		const currentGame = await ensureGame(
			mongoGame,
			adminContract,
			currentGames,
			claimedGameIds
		);
		currentGameMap.set(mongoGame._id.toString(), currentGame);
	}

	for (const mongoGame of mongoGames) {
		const currentGame = currentGameMap.get(mongoGame._id.toString());
		const developerSigner = ethers.isAddress(mongoGame.developerAddress)
			? await findSigner(mongoGame.developerAddress, availableAddresses)
			: null;
		const accounts = await GameAccount.find({ game: mongoGame._id }).sort({ createdAt: 1 });

		for (const mongoAccount of accounts) {
			const currentAccount = await ensureAccount(
				mongoAccount,
				mongoGame,
				currentGame,
				developerSigner,
				currentAccounts,
				claimedAccountIds
			);
			if (!currentAccount) continue;

			const assets = await Asset.find({ gameAccount: mongoAccount._id }).sort({ createdAt: 1 });
			for (const mongoAsset of assets) {
				await ensureAsset(
					mongoAsset,
					mongoAccount,
					currentGame,
					currentAccount,
					developerSigner,
					currentAssets,
					usedAssetIds
				);
			}
		}
	}

	console.log('Reconstructed MongoDB games:');
	for (const mongoGame of mongoGames) {
		const currentGame = currentGameMap.get(mongoGame._id.toString());
		console.log(
			`- ${mongoGame.name} (${mongoGame._id}): ${
				currentGame ? `blockchain game #${currentGame.gameId}` : 'not reconstructed'
			}`
		);
	}
}

async function main() {
	try {
		await mongoose.connect(process.env.MONGODB_URI);
		await seedDemo();
		console.log('Demo seed completed.');
	} catch (error) {
		console.error(`Demo seed failed: ${error.message}`);
		process.exitCode = 1;
	} finally {
		if (mongoose.connection.readyState !== 0) {
			try {
				await mongoose.disconnect();
			} catch (error) {
				console.error(`Demo database cleanup failed: ${error.message}`);
				process.exitCode = 1;
			}
		}
	}
}

main();
