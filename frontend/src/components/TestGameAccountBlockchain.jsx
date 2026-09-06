import { useState } from 'react';
import { ethers } from 'ethers';
import { linkGameAccountOnBlockchain } from '../services/blockchainService';

function TestGameAccountBlockchain() {
	const [message, setMessage] = useState('');
	const [accountId, setAccountId] = useState('');
	const [transactionHash, setTransactionHash] = useState('');
	const [mongoGameAccountId, setMongoGameAccountId] = useState('');

	async function linkTestGameAccount() {
		try {
			if (!window.ethereum) {
				throw new Error('MetaMask is not installed');
			}

			const provider = new ethers.BrowserProvider(window.ethereum);
			const accounts = await provider.send('eth_requestAccounts', []);
			const player = accounts[0];

			const result = await linkGameAccountOnBlockchain(
				1,
				'MV-BLOCKCHAIN-TEST-001',
				player
			);
			const token = localStorage.getItem('token');

			if (!token) {
				throw new Error('JWT token not found');
			}

			const response = await fetch('http://localhost:5000/api/game-accounts', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					gameId: '6a9dbb2a2c76c0469d509aad',
					externalAccountId: 'MV-BLOCKCHAIN-TEST-001',
					ownerWallet: player,
					transactionHash: result.transactionHash
				})
			});
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message);
			}

			setAccountId(data.gameAccount.blockchainAccountId);
			setMongoGameAccountId(data.gameAccount._id);
			setTransactionHash(result.transactionHash);
			setMessage('Game account linked and saved successfully');
		} catch (error) {
			console.error(error);
			setMessage(error.message);
		}
	}

	return (
		<div>
			<button onClick={linkTestGameAccount}>
				Link Test Game Account
			</button>
			{message && <p>{message}</p>}
			{accountId && <p>Account ID: {accountId.toString()}</p>}
			{mongoGameAccountId && <p>MongoDB Game Account ID: {mongoGameAccountId}</p>}
			{transactionHash && <p>Transaction hash: {transactionHash}</p>}
		</div>
	);
}

export default TestGameAccountBlockchain;
