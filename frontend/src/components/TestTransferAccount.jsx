import { useState } from 'react';
import { transferAccountOnBlockchain } from '../services/blockchainService';

function TestTransferAccount() {
	const [message, setMessage] = useState('');
	const [transactionHash, setTransactionHash] = useState('');

	async function transferTestAccount() {
		try {
			const hash = await transferAccountOnBlockchain(
				1,
				'0x70997970c51812dc3a010c7d01b50e0d17dc79c8'
			);

			setTransactionHash(hash);
			setMessage('Account transferred successfully');
		} catch (error) {
			setMessage(error.message);
		}
	}

	return (
		<div>
			<button onClick={transferTestAccount}>Transfer Test Account</button>
			{message && <p>{message}</p>}
			{transactionHash && <p>Transaction hash: {transactionHash}</p>}
		</div>
	);
}

export default TestTransferAccount;
