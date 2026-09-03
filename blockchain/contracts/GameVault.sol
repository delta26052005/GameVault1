// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract GameVault {

	struct Game {
		uint256 gameId;
		string name;
		address developer;
		bool active;
	}

	struct GameAccount {
		uint256 accountId;
		uint256 gameId;
		string externalAccountId;
		address owner;
		bool active;
	}

	struct Asset {
		uint256 assetId;
		uint256 gameId;
		uint256 accountId;
		string name;
		uint256 quantity;
		bool active;
	}

	mapping(uint256 => Game) public games;
	mapping(uint256 => GameAccount) public gameAccounts;
	mapping(uint256 => Asset) public assets;
	mapping(uint256 => mapping(bytes32 => bool)) private externalAccountLinked;

	uint256 private nextGameId = 1;
	uint256 private nextAccountId = 1;
	uint256 private nextAssetId = 1;
	address public admin;

	error UnauthorizedAdmin();
	error UnauthorizedDeveloper();
	error UnauthorizedAccountOwner();
	error GameNotFound();
	error InactiveGame();
	error AccountNotFound();
	error InactiveAccount();
	error ZeroAddress();
	error EmptyString();
	error DuplicateExternalAccount();
	error InvalidNewOwner();
	error InvalidQuantity();
	error AssetNotFound();

	event GameRegistered(
		uint256 indexed gameId,
		string name,
		address indexed developer,
		address indexed registeredBy
	);
	event GameStatusChanged(uint256 indexed gameId, bool active, address indexed changedBy);
	event GameAccountLinked(
		uint256 indexed accountId,
		uint256 indexed gameId,
		string externalAccountId,
		address indexed owner,
		address linkedBy
	);
	event AccountOwnershipTransferred(
		uint256 indexed accountId,
		uint256 indexed gameId,
		address indexed previousOwner,
		address newOwner
	);
	event AssetAdded(
		uint256 indexed assetId,
		uint256 indexed gameId,
		uint256 indexed accountId,
		string name,
		uint256 quantity,
		address addedBy
	);

	modifier onlyAdmin() {
		if (msg.sender != admin) revert UnauthorizedAdmin();
		_;
	}

	constructor() {
		admin = msg.sender;
	}

	function registerGame(
		string calldata name,
		address developer
	) external onlyAdmin returns (uint256 gameId) {
		if (developer == address(0)) revert ZeroAddress();
		if (bytes(name).length == 0) revert EmptyString();

		gameId = nextGameId++;
		games[gameId] = Game({
			gameId: gameId,
			name: name,
			developer: developer,
			active: true
		});

		emit GameRegistered(gameId, name, developer, msg.sender);
	}

	function setGameActive(uint256 gameId, bool active) external onlyAdmin {
		Game storage game = games[gameId];
		if (game.gameId == 0) revert GameNotFound();

		game.active = active;
		emit GameStatusChanged(gameId, active, msg.sender);
	}

	function linkGameAccount(
		uint256 gameId,
		string calldata externalAccountId,
		address player
	) external returns (uint256 accountId) {
		Game storage game = games[gameId];
		if (game.gameId == 0) revert GameNotFound();
		if (!game.active) revert InactiveGame();
		if (msg.sender != game.developer) revert UnauthorizedDeveloper();
		if (player == address(0)) revert ZeroAddress();
		if (bytes(externalAccountId).length == 0) revert EmptyString();

		bytes32 externalAccountKey = keccak256(bytes(externalAccountId));
		if (externalAccountLinked[gameId][externalAccountKey]) {
			revert DuplicateExternalAccount();
		}

		externalAccountLinked[gameId][externalAccountKey] = true;
		accountId = nextAccountId++;
		gameAccounts[accountId] = GameAccount({
			accountId: accountId,
			gameId: gameId,
			externalAccountId: externalAccountId,
			owner: player,
			active: true
		});

		emit GameAccountLinked(accountId, gameId, externalAccountId, player, msg.sender);
	}

	function getGame(uint256 gameId) external view returns (Game memory) {
		if (games[gameId].gameId == 0) revert GameNotFound();
		return games[gameId];
	}

	function getGameAccount(uint256 accountId) external view returns (GameAccount memory) {
		if (gameAccounts[accountId].accountId == 0) revert AccountNotFound();
		return gameAccounts[accountId];
	}

	function getAccountOwner(uint256 accountId) external view returns (address) {
		GameAccount storage account = gameAccounts[accountId];
		if (account.accountId == 0) revert AccountNotFound();
		return account.owner;
	}

	function transferAccount(uint256 accountId, address newOwner) external {
		GameAccount storage account = gameAccounts[accountId];
		if (account.accountId == 0) revert AccountNotFound();
		if (!account.active) revert InactiveAccount();
		if (newOwner == address(0)) revert ZeroAddress();
		if (msg.sender != account.owner) revert UnauthorizedAccountOwner();
		if (newOwner == account.owner) revert InvalidNewOwner();

		address previousOwner = account.owner;
		account.owner = newOwner;
		emit AccountOwnershipTransferred(accountId, account.gameId, previousOwner, newOwner);
	}

	function addAsset(
		uint256 accountId,
		string calldata name,
		uint256 quantity
	) external returns (uint256 assetId) {
		GameAccount storage account = gameAccounts[accountId];
		if (account.accountId == 0) revert AccountNotFound();
		if (!account.active) revert InactiveAccount();

		Game storage game = games[account.gameId];
		if (game.gameId == 0) revert GameNotFound();
		if (!game.active) revert InactiveGame();
		if (msg.sender != game.developer) revert UnauthorizedDeveloper();
		if (bytes(name).length == 0) revert EmptyString();
		if (quantity == 0) revert InvalidQuantity();

		assetId = nextAssetId++;
		assets[assetId] = Asset({
			assetId: assetId,
			gameId: account.gameId,
			accountId: accountId,
			name: name,
			quantity: quantity,
			active: true
		});

		emit AssetAdded(assetId, account.gameId, accountId, name, quantity, msg.sender);
	}

	function getAsset(uint256 assetId) external view returns (Asset memory) {
		if (assets[assetId].assetId == 0) revert AssetNotFound();
		return assets[assetId];
	}

	function getAssetOwner(uint256 assetId) external view returns (address) {
		Asset storage asset = assets[assetId];
		if (asset.assetId == 0) revert AssetNotFound();

		GameAccount storage account = gameAccounts[asset.accountId];
		if (account.accountId == 0) revert AccountNotFound();
		return account.owner;
	}
}