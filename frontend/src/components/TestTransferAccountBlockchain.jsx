import { useState } from 'react';
import { ethers } from 'ethers';
import { transferAccountOnBlockchain } from '../services/blockchainService';

function TestTransferAccountBlockchain() {
	const [message, setMessage] = useState('');
	const [transactionHash, setTransactionHash] = useState('');
	const [newOwner, setNewOwner] = useState('');

	async function transferTestAccount() {
		try {
			if (!window.ethereum) {
				throw new Error('MetaMask is not installed');
			}

			const provider = new ethers.BrowserProvider(window.ethereum);
			const accounts = await provider.send('eth_requestAccounts', []);
			const currentOwner = accounts[0];
			const nextOwner = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';

			if (!currentOwner) {
				throw new Error('MetaMask account is required');
			}

			const result = await transferAccountOnBlockchain(1, nextOwner);
			const token = localStorage.getItem('token');

			if (!token) {
				throw new Error('JWT token not found');
			}

			const response = await fetch(
				'http://localhost:5000/api/game-accounts/transfer/confirm',
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						transactionHash: result,
						gameAccountId: '6a9dbb7f2c76c0469d509aae',
						accountId: 1,
						newOwner: nextOwner
					})
				}
			);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message);
			}

			setMessage('Account ownership transferred and synchronized successfully');
			setTransactionHash(result);
			setNewOwner(nextOwner);
		} catch (error) {
			setMessage(error.message);
		}
	}

	return (
		<div>
			<button onClick={transferTestAccount}>Transfer Test Account</button>
			{message && <p>{message}</p>}
			{transactionHash && <p>Transaction hash: {transactionHash}</p>}
			{newOwner && <p>New owner: {newOwner}</p>}
		</div>
	);
}

export default TestTransferAccountBlockchain;
