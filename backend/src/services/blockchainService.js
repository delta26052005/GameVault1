const { ethers } = require('ethers');
const { gameVault, provider } = require('../config/blockchain');

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

function assertSuccessfulContractReceipt(receipt) {
	if (
		!receipt ||
		receipt.status !== 1 ||
		!receipt.to ||
		receipt.to.toLowerCase() !== gameVault.target.toLowerCase()
	) {
		throw new Error('Blockchain transaction could not be verified');
	}
}

function isGameVaultLog(log) {
	return (
		typeof log?.address === 'string' &&
		log.address.toLowerCase() === gameVault.target.toLowerCase()
	);
}

async function registerGameOnBlockchain(name, developerAddress) {
	const transaction = await gameVault.registerGame(name, developerAddress);
	const receipt = await transaction.wait();
	assertSuccessfulContractReceipt(receipt);

	let gameRegisteredEvent;

	for (const log of receipt.logs) {
		if (!isGameVaultLog(log)) continue;

		try {
			const parsedLog = gameVault.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (
				parsedLog?.name === 'GameRegistered' &&
				parsedLog.args.name === name &&
				ethers.getAddress(parsedLog.args.developer) === ethers.getAddress(developerAddress) &&
				ethers.getAddress(parsedLog.args.registeredBy) === ethers.getAddress(receipt.from)
			) {
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

async function setGameActiveOnBlockchain(gameId, active) {
	const transaction = await gameVault.setGameActive(gameId, active);
	const receipt = await transaction.wait();
	assertSuccessfulContractReceipt(receipt);
	for (const log of receipt.logs) {
		if (!isGameVaultLog(log)) continue;

		try {
			const parsedLog = gameVault.interface.parseLog({ topics: log.topics, data: log.data });
			if (
				parsedLog?.name === 'GameStatusChanged' &&
				parsedLog.args.gameId.toString() === gameId.toString() &&
				parsedLog.args.active === active &&
				ethers.getAddress(parsedLog.args.changedBy) === ethers.getAddress(receipt.from)
			) return receipt.hash;
		} catch {
			continue;
		}
	}
	throw new Error('Game status event not found');
}

async function setAssetActiveOnBlockchain(
	assetId,
	active,
	expectedGameId,
	expectedDeveloper
) {
	const transaction = await gameVault.setAssetActive(assetId, active);
	const receipt = await transaction.wait();
	assertSuccessfulContractReceipt(receipt);
	for (const log of receipt.logs) {
		if (!isGameVaultLog(log)) continue;

		try {
			const parsedLog = gameVault.interface.parseLog({ topics: log.topics, data: log.data });
			if (
				parsedLog?.name === 'AssetStatusChanged' &&
				parsedLog.args.assetId.toString() === assetId.toString() &&
				parsedLog.args.active === active &&
				(expectedGameId === undefined ||
					parsedLog.args.gameId.toString() === expectedGameId.toString()) &&
				(expectedDeveloper === undefined ||
					ethers.getAddress(parsedLog.args.changedBy) === ethers.getAddress(expectedDeveloper))
			) {
				const blockchainAsset = await gameVault.getAsset(assetId);
				if (
					(expectedGameId !== undefined &&
						blockchainAsset.gameId.toString() !== expectedGameId.toString()) ||
					blockchainAsset.active !== active
				) {
					continue;
				}
				return receipt.hash;
			}
		} catch {
			continue;
		}
	}
	throw new Error('Asset status event not found');
}

async function verifyAssetStatusOnBlockchain(
	transactionHash,
	assetId,
	gameId,
	active,
	developerAddress
) {
	const receipt = await provider.getTransactionReceipt(transactionHash);

	if (!receipt) {
		throw new Error('Transaction receipt not found');
	}
	assertSuccessfulContractReceipt(receipt);

	for (const log of receipt.logs) {
		if (!isGameVaultLog(log)) continue;

		try {
			const parsedLog = gameVault.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (
				parsedLog?.name === 'AssetStatusChanged' &&
				parsedLog.args.assetId.toString() === assetId.toString() &&
				parsedLog.args.gameId.toString() === gameId.toString() &&
				parsedLog.args.active === active &&
				ethers.getAddress(parsedLog.args.changedBy) === ethers.getAddress(receipt.from) &&
				ethers.getAddress(receipt.from) === ethers.getAddress(developerAddress)
			) {
				const blockchainAsset = await gameVault.getAsset(assetId);
				if (
					blockchainAsset.gameId.toString() !== gameId.toString() ||
					blockchainAsset.active !== active
				) {
					continue;
				}

				return {
					assetId: blockchainAsset.assetId,
					gameId: blockchainAsset.gameId,
					active: blockchainAsset.active,
					transactionHash: receipt.hash,
					changedBy: parsedLog.args.changedBy
				};
			}
		} catch {
			continue;
		}
	}

	throw new Error('Asset status event not found');
}

async function linkGameAccountOnBlockchain(gameId, externalAccountId, player) {
}

async function getGameAccountOwnerFromBlockchain(accountId) {
	return await gameVault.getAccountOwner(accountId);
}

async function getCurrentGameAccountIds() {
	const events = await gameVault.queryFilter(
		gameVault.filters.GameAccountLinked(),
		0,
		'latest'
	);

	return new Set(
		events.map(event => event.args.accountId.toString())
	);
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
	assertSuccessfulContractReceipt(receipt);

	for (const log of receipt.logs) {
		if (!isGameVaultLog(log)) continue;

		try {
			const parsedLog = gameVault.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (
				parsedLog &&
				parsedLog.name === 'AccountOwnershipTransferred' &&
				parsedLog.args.accountId.toString() === accountId.toString() &&
				ethers.getAddress(parsedLog.args.newOwner) === ethers.getAddress(newOwner) &&
				ethers.getAddress(parsedLog.args.previousOwner) === ethers.getAddress(receipt.from)
			) {
				const currentOwner = await gameVault.getAccountOwner(accountId);
				if (ethers.getAddress(currentOwner) !== ethers.getAddress(newOwner)) {
					continue;
				}

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
	player,
	expectedDeveloper
) {
	const receipt = await provider.getTransactionReceipt(transactionHash);

	if (!receipt) {
		throw new Error('Transaction receipt not found');
	}
	assertSuccessfulContractReceipt(receipt);

	for (const log of receipt.logs) {
		if (!isGameVaultLog(log)) continue;

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
				ethers.getAddress(parsedLog.args.owner) === ethers.getAddress(player) &&
				(!expectedDeveloper ||
					ethers.getAddress(parsedLog.args.linkedBy) === ethers.getAddress(expectedDeveloper)) &&
				ethers.getAddress(parsedLog.args.linkedBy) === ethers.getAddress(receipt.from)
			) {
				const account = await gameVault.getGameAccount(parsedLog.args.accountId);
				if (
					account.gameId.toString() !== gameId.toString() ||
					account.externalAccountId !== externalAccountId ||
					ethers.getAddress(account.owner) !== ethers.getAddress(player)
				) {
					continue;
				}

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
	quantity,
	expectedGameId,
	expectedDeveloper
) {
	const receipt = await provider.getTransactionReceipt(transactionHash);

	if (!receipt) {
		throw new Error('Transaction receipt not found');
	}
	assertSuccessfulContractReceipt(receipt);

	for (const log of receipt.logs) {
		if (!isGameVaultLog(log)) continue;

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
				parsedLog.args.quantity.toString() === quantity.toString() &&
				(!expectedDeveloper ||
					ethers.getAddress(parsedLog.args.addedBy) === ethers.getAddress(expectedDeveloper)) &&
				ethers.getAddress(parsedLog.args.addedBy) === ethers.getAddress(receipt.from)
			) {
				if (
					expectedGameId !== undefined &&
					parsedLog.args.gameId.toString() !== expectedGameId.toString()
				) {
					continue;
				}

				const asset = await gameVault.getAsset(parsedLog.args.assetId);
				if (
					asset.gameId.toString() !== parsedLog.args.gameId.toString() ||
					asset.accountId.toString() !== accountId.toString() ||
					asset.name !== name ||
					asset.quantity.toString() !== quantity.toString()
				) {
					continue;
				}

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
	toSafeNumber,
	setGameActiveOnBlockchain,
	setAssetActiveOnBlockchain,
	verifyAssetStatusOnBlockchain,
	linkGameAccountOnBlockchain,
	getGameAccountOwnerFromBlockchain,
	getCurrentGameAccountIds,
	getAssetOwnerFromBlockchain,
	verifyAccountTransferOnBlockchain,
	verifyGameAccountLinkOnBlockchain,
	verifyAssetCreationOnBlockchain
};
