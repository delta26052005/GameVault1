import { useState } from 'react';
import { addAssetOnBlockchain } from '../services/blockchainService';

function TestAddAssetBlockchain() {
	const [message, setMessage] = useState('');
	const [assetId, setAssetId] = useState('');
	const [transactionHash, setTransactionHash] = useState('');

	async function addTestAsset() {
		try {
			const result = await addAssetOnBlockchain(1, 'Shield of Valor', 1);
			const token = localStorage.getItem('token');

			if (!token) {
				throw new Error('JWT token not found');
			}

			const response = await fetch('http://localhost:5000/api/assets', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					gameId: '6a9dbb2a2c76c0469d509aad',
					gameAccountId: '6a9dbb7f2c76c0469d509aae',
					name: 'Shield of Valor',
					quantity: 1,
					transactionHash: result.transactionHash
				})
			});
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message);
			}

			setMessage('Asset created and saved successfully');
			setAssetId(data.asset.blockchainAssetId);
			setTransactionHash(result.transactionHash);
		} catch (error) {
			setMessage(error.message);
		}
	}

	return (
		<div>
			<button onClick={addTestAsset}>Add Test Asset</button>
			{message && <p>{message}</p>}
			{assetId && <p>Asset ID: {assetId.toString()}</p>}
			{transactionHash && <p>Transaction hash: {transactionHash}</p>}
		</div>
	);
}

export default TestAddAssetBlockchain;
