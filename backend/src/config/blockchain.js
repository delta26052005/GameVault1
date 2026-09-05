const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
const wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);

const artifactPath = path.resolve(
	__dirname,
	'../../../blockchain/artifacts/contracts/GameVault.sol/GameVault.json'
);
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const abi = artifact.abi;

const gameVault = new ethers.Contract(
	process.env.GAMEVAULT_CONTRACT_ADDRESS,
	abi,
	wallet
);

module.exports = {
	provider,
	wallet,
	gameVault
};
