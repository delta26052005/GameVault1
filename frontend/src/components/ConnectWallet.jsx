import { useState } from 'react';
import { ethers } from 'ethers';

function ConnectWallet() {
	const [walletAddress, setWalletAddress] = useState('');
	const [challenge, setChallenge] = useState('');
	const [signature, setSignature] = useState('');
	const [verificationMessage, setVerificationMessage] = useState('');

	async function connectWallet() {
		if (!window.ethereum) {
			alert('MetaMask is not installed');
			return;
		}

		try {
			const provider = new ethers.BrowserProvider(window.ethereum);
			const accounts = await provider.send('eth_requestAccounts', []);
			const connectedAddress = accounts[0];

			setWalletAddress(connectedAddress);

			const token = localStorage.getItem('token');

			if (!token) {
				console.log('JWT token not found');
				return;
			}

			const response = await fetch(
				'http://localhost:5000/api/user/wallet/challenge',
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}
			);
			const data = await response.json();

			if (response.ok) {
				setChallenge(data.challenge);
			} else {
				console.error(data.message);
			}
		} catch (error) {
			console.error('Wallet connection failed:', error);
		}
	}

	async function signChallenge() {
		if (!window.ethereum) {
			alert('MetaMask is not installed');
			return;
		}

		try {
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();
			const signedMessage = await signer.signMessage(challenge);

			setSignature(signedMessage);

			const token = localStorage.getItem('token');

			if (!token) {
				console.log('JWT token not found');
				return;
			}

			const response = await fetch(
				'http://localhost:5000/api/user/wallet/verify',
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						walletAddress,
						signature: signedMessage
					})
				}
			);
			const data = await response.json();

			setVerificationMessage(data.message);
		} catch (error) {
			console.error('Wallet verification failed:', error);
		}
	}

	return (
		<div>
			<button onClick={connectWallet}>Connect Wallet</button>
			<p>
				{walletAddress
					? `Connected wallet: ${walletAddress}`
					: 'Wallet not connected'}
			</p>
			{challenge && <p>Challenge: {challenge}</p>}
			{walletAddress && challenge && (
				<button onClick={signChallenge}>Sign Wallet Challenge</button>
			)}
			{signature && <p>Signature: {signature}</p>}
			{verificationMessage && <p>{verificationMessage}</p>}
		</div>
	);
}

export default ConnectWallet;
