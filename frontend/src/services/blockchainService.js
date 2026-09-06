import { ethers } from 'ethers';
import {
	GAMEVAULT_CONTRACT_ADDRESS,
	GAMEVAULT_ABI
} from '../config/blockchain';

async function linkGameAccountOnBlockchain(
	gameId,
	externalAccountId,
	player
) {
	if (!window.ethereum) {
		throw new Error('MetaMask is not installed');
	}

	const provider = new ethers.BrowserProvider(window.ethereum);
	await provider.send('eth_requestAccounts', []);
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(
		GAMEVAULT_CONTRACT_ADDRESS,
		GAMEVAULT_ABI,
		signer
	);

	const transaction = await contract.linkGameAccount(
		gameId,
		externalAccountId,
		player
	);
	const receipt = await transaction.wait();

	let gameAccountLinkedEvent;

	for (const log of receipt.logs) {
		try {
			const parsedLog = contract.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (parsedLog && parsedLog.name === 'GameAccountLinked') {
				gameAccountLinkedEvent = parsedLog;
				break;
			}
		} catch (error) {
		}
	}

	if (!gameAccountLinkedEvent) {
		throw new Error('GameAccountLinked event not found');
	}

	return {
		accountId: gameAccountLinkedEvent.args.accountId,
		transactionHash: receipt.hash
	};
}

async function transferAccountOnBlockchain(accountId, newOwner) {
	if (!window.ethereum) {
		throw new Error('MetaMask is not installed');
	}

	const provider = new ethers.BrowserProvider(window.ethereum);
	await provider.send('eth_requestAccounts', []);
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(
		GAMEVAULT_CONTRACT_ADDRESS,
		GAMEVAULT_ABI,
		signer
	);

	const transaction = await contract.transferAccount(accountId, newOwner);
	const receipt = await transaction.wait();

	return receipt.hash;
}

async function addAssetOnBlockchain(accountId, name, quantity) {
	if (!window.ethereum) {
		throw new Error('MetaMask is not installed');
	}

	const provider = new ethers.BrowserProvider(window.ethereum);
	await provider.send('eth_requestAccounts', []);
	const signer = await provider.getSigner();
	const contract = new ethers.Contract(
		GAMEVAULT_CONTRACT_ADDRESS,
		GAMEVAULT_ABI,
		signer
	);

	const transaction = await contract.addAsset(accountId, name, quantity);
	const receipt = await transaction.wait();

	let assetAddedEvent;

	for (const log of receipt.logs) {
		try {
			const parsedLog = contract.interface.parseLog({
				topics: log.topics,
				data: log.data
			});

			if (parsedLog && parsedLog.name === 'AssetAdded') {
				assetAddedEvent = parsedLog;
				break;
			}
		} catch (error) {
		}
	}

	if (!assetAddedEvent) {
		throw new Error('AssetAdded event not found');
	}

	return {
		assetId: assetAddedEvent.args.assetId,
		transactionHash: receipt.hash
	};
}

export {
	linkGameAccountOnBlockchain,
	transferAccountOnBlockchain,
	addAssetOnBlockchain
};
