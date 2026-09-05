const { gameVault } = require('../config/blockchain');

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

module.exports = {
	registerGameOnBlockchain,
	linkGameAccountOnBlockchain
};
