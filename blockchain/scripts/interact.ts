import { network } from "hardhat";

const { ethers } = await network.create();

const [admin, developer, player, anotherPlayer] = await ethers.getSigners();
const gameVault = await ethers.getContractAt(
	"GameVault",
	"0x5FbDB2315678afecb367f032d93F642f64180aa3",
	admin,
);

const transaction = await gameVault.registerGame("Monster Raiders", developer.address);
await transaction.wait();

const game = await gameVault.getGame(1n);

const developerGameVault = await ethers.getContractAt(
	"GameVault",
	"0x5FbDB2315678afecb367f032d93F642f64180aa3",
	developer,
);
const accountLinkTransaction = await developerGameVault.linkGameAccount(
	1n,
	"MR-1001",
	player.address,
);
await accountLinkTransaction.wait();

const linkedGameAccount = await gameVault.getGameAccount(1n);

const playerGameVault = await ethers.getContractAt(
	"GameVault",
	"0x5FbDB2315678afecb367f032d93F642f64180aa3",
	player,
);
const transferTransaction = await playerGameVault.transferAccount(
	1n,
	anotherPlayer.address,
);
await transferTransaction.wait();

const gameAccountAfterTransfer = await gameVault.getGameAccount(1n);
const currentOwner = await gameVault.getAccountOwner(1n);

const originalPlayerGameVault = await ethers.getContractAt(
	"GameVault",
	"0x5FbDB2315678afecb367f032d93F642f64180aa3",
	player,
);

let unauthorizedTransferRejected = false;

try {
	await originalPlayerGameVault.transferAccount(1n, admin.address);
} catch {
	unauthorizedTransferRejected = true;
	console.log("Unauthorized transfer correctly rejected.");
}

if (!unauthorizedTransferRejected) {
	throw new Error("Unauthorized transfer was unexpectedly allowed.");
}

const ownerAfterUnauthorizedAttempt = await gameVault.getAccountOwner(1n);

console.log("Admin address:", admin.address);
console.log("Developer address:", developer.address);
console.log("Transaction hash:", transaction.hash);
console.log("Registered game:", game);
console.log("Player address:", player.address);
console.log("Account-link transaction hash:", accountLinkTransaction.hash);
console.log("Linked game account:", linkedGameAccount);
console.log("Another player address:", anotherPlayer.address);
console.log("Transfer transaction hash:", transferTransaction.hash);
console.log("Game account after transfer:", gameAccountAfterTransfer);
console.log("Current owner:", currentOwner);
console.log("Owner after unauthorized transfer attempt:", ownerAfterUnauthorizedAttempt);
