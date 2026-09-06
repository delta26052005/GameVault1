const { gameVault, provider } = require('../config/blockchain');

async function registerGameOnBlockchain(name, developerAddress) {
	const transaction = await gameVault.registerGame(name, developerAddress);
	const receipt = await transaction.wait();

	let gameRegisteredEvent;

	for (const log of receipt.logs) {
		try {
			const parsedLog = gameVault.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (parsedLog && parsedLog.name === 'GameRegistered') {
				gameRegisteredEvent = parsedLog;
				break;
			}
		} catch (error) {
		}
	}

	if (!gameRegisteredEvent) {
		throw new Error('GameRegistered event not found');
	}

	return {
		gameId: gameRegisteredEvent.args.gameId,
		transactionHash: receipt.hash
	};
}

async function linkGameAccountOnBlockchain(gameId, externalAccountId, player) {
}

async function getGameAccountOwnerFromBlockchain(accountId) {
	return await gameVault.getAccountOwner(accountId);
}

async function getAssetOwnerFromBlockchain(assetId) {
	return await gameVault.getAssetOwner(assetId);
}

async function verifyAccountTransferOnBlockchain(
	transactionHash,
	accountId,
	newOwner
) {
	const receipt = await provider.getTransactionReceipt(transactionHash);

	if (!receipt) {
		throw new Error('Transaction receipt not found');
	}

	for (const log of receipt.logs) {
		try {
			const parsedLog = gameVault.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (
				parsedLog &&
				parsedLog.name === 'AccountOwnershipTransferred' &&
				parsedLog.args.accountId.toString() === accountId.toString() &&
				parsedLog.args.newOwner.toLowerCase() === newOwner.toLowerCase()
			) {
				return {
					accountId: parsedLog.args.accountId,
					previousOwner: parsedLog.args.previousOwner,
					newOwner: parsedLog.args.newOwner,
					transactionHash
				};
			}
		} catch (error) {
		}
	}

	throw new Error('Account ownership transfer event not found');
}

async function verifyGameAccountLinkOnBlockchain(
	transactionHash,
	gameId,
	externalAccountId,
	player
) {
	const receipt = await provider.getTransactionReceipt(transactionHash);

	if (!receipt) {
		throw new Error('Transaction receipt not found');
	}

	for (const log of receipt.logs) {
		try {
			const parsedLog = gameVault.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (
				parsedLog &&
				parsedLog.name === 'GameAccountLinked' &&
				parsedLog.args.gameId.toString() === gameId.toString() &&
				parsedLog.args.externalAccountId === externalAccountId &&
				parsedLog.args.owner.toLowerCase() === player.toLowerCase()
			) {
				return {
					accountId: parsedLog.args.accountId,
					gameId: parsedLog.args.gameId,
					externalAccountId: parsedLog.args.externalAccountId,
					owner: parsedLog.args.owner,
					transactionHash
				};
			}
		} catch (error) {
		}
	}

	throw new Error('Game account link event not found');
}

async function verifyAssetCreationOnBlockchain(
	transactionHash,
	accountId,
	name,
	quantity
) {
	const receipt = await provider.getTransactionReceipt(transactionHash);

	if (!receipt) {
		throw new Error('Transaction receipt not found');
	}

	for (const log of receipt.logs) {
		try {
			const parsedLog = gameVault.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (
				parsedLog &&
				parsedLog.name === 'AssetAdded' &&
				parsedLog.args.accountId.toString() === accountId.toString() &&
				parsedLog.args.name === name &&
				parsedLog.args.quantity.toString() === quantity.toString()
			) {
				return {
					assetId: parsedLog.args.assetId,
					gameId: parsedLog.args.gameId,
					accountId: parsedLog.args.accountId,
					name: parsedLog.args.name,
					quantity: parsedLog.args.quantity,
					addedBy: parsedLog.args.addedBy,
					transactionHash
				};
			}
		} catch (error) {
		}
	}

	throw new Error('Asset creation event not found');
}

module.exports = {
	registerGameOnBlockchain,
	linkGameAccountOnBlockchain,
	getGameAccountOwnerFromBlockchain,
	getAssetOwnerFromBlockchain,
	verifyAccountTransferOnBlockchain,
	verifyGameAccountLinkOnBlockchain,
	verifyAssetCreationOnBlockchain
};
