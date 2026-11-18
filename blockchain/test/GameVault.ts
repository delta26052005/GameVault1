import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("GameVault", function () {
	async function deployFixture() {
		const [admin, developer, player, anotherPlayer] = await ethers.getSigners();
		const gameVault = (await ethers.deployContract("GameVault")) as any;

		return { gameVault, admin, developer, player, anotherPlayer };
	}

	async function createGame(gameVault: any, developer: any, admin: any) {
		await gameVault
			.connect(admin)
			.registerGame("Monster Raiders", developer.address);
	}

	async function createGameAccount(
		gameVault: any,
		admin: any,
		developer: any,
		player: any,
	) {
		await createGame(gameVault, developer, admin);
		await gameVault
			.connect(developer)
			.linkGameAccount(1n, "MR-1001", player.address);
	}

	it("sets the deployer as admin", async function () {
		const { gameVault, admin } = await deployFixture();

		expect(await gameVault.admin()).to.equal(admin.address);
	});

	it("allows the admin to register a game and emits GameRegistered", async function () {
		const { gameVault, admin, developer } = await deployFixture();

		await expect(
			gameVault.connect(admin).registerGame("Monster Raiders", developer.address),
		)
			.to.emit(gameVault, "GameRegistered")
			.withArgs(1n, "Monster Raiders", developer.address, admin.address);

		expect(await gameVault.games(1n)).to.deep.equal([
			1n,
			"Monster Raiders",
			developer.address,
			true,
		]);
	});

	it("rejects game registration from a non-admin", async function () {
		const { gameVault, developer } = await deployFixture();

		await expect(
			gameVault.connect(developer).registerGame("Monster Raiders", developer.address),
		).to.be.revertedWithCustomError(gameVault, "UnauthorizedAdmin");
	});

	it("allows the registered developer to link an account and emits GameAccountLinked", async function () {
		const { gameVault, admin, developer, player } = await deployFixture();
		await createGame(gameVault, developer, admin);

		await expect(
			gameVault.connect(developer).linkGameAccount(1n, "MR-1001", player.address),
		)
			.to.emit(gameVault, "GameAccountLinked")
			.withArgs(1n, 1n, "MR-1001", player.address, developer.address);

		expect(await gameVault.getAccountOwner(1n)).to.equal(player.address);
	});

	it("rejects account linking by a different wallet", async function () {
		const { gameVault, admin, developer, anotherPlayer } = await deployFixture();
		await createGame(gameVault, developer, admin);

		await expect(
			gameVault
				.connect(anotherPlayer)
				.linkGameAccount(1n, "MR-1001", anotherPlayer.address),
		).to.be.revertedWithCustomError(gameVault, "UnauthorizedDeveloper");
	});

	it("rejects duplicate external account IDs for the same game", async function () {
		const { gameVault, admin, developer, player, anotherPlayer } = await deployFixture();
		await createGameAccount(gameVault, admin, developer, player);

		await expect(
			gameVault
				.connect(developer)
				.linkGameAccount(1n, "MR-1001", anotherPlayer.address),
		).to.be.revertedWithCustomError(gameVault, "DuplicateExternalAccount");
	});

	it("allows the current owner to transfer an account and emits AccountOwnershipTransferred", async function () {
		const { gameVault, admin, developer, player, anotherPlayer } = await deployFixture();
		await createGameAccount(gameVault, admin, developer, player);

		await expect(
			gameVault.connect(player).transferAccount(1n, anotherPlayer.address),
		)
			.to.emit(gameVault, "AccountOwnershipTransferred")
			.withArgs(1n, 1n, player.address, anotherPlayer.address);

		expect(await gameVault.getAccountOwner(1n)).to.equal(anotherPlayer.address);
	});

	it("rejects account transfers from a non-owner", async function () {
		const { gameVault, admin, developer, player, anotherPlayer } = await deployFixture();
		await createGameAccount(gameVault, admin, developer, player);

		await expect(
			gameVault.connect(anotherPlayer).transferAccount(1n, anotherPlayer.address),
		).to.be.revertedWithCustomError(gameVault, "UnauthorizedAccountOwner");
	});

	it("rejects zero addresses where they are not valid", async function () {
		const { gameVault, admin, developer, player } = await deployFixture();

		await expect(
			gameVault.connect(admin).registerGame("Monster Raiders", ethers.ZeroAddress),
		).to.be.revertedWithCustomError(gameVault, "ZeroAddress");

		await createGame(gameVault, developer, admin);

		await expect(
			gameVault.connect(developer).linkGameAccount(1n, "MR-1001", ethers.ZeroAddress),
		).to.be.revertedWithCustomError(gameVault, "ZeroAddress");

		await gameVault.connect(developer).linkGameAccount(1n, "MR-1001", player.address);
		await expect(
			gameVault.connect(player).transferAccount(1n, ethers.ZeroAddress),
		).to.be.revertedWithCustomError(gameVault, "ZeroAddress");
	});

	it("allows the developer to add an asset and emits AssetAdded", async function () {
		const { gameVault, admin, developer, player } = await deployFixture();
		await createGameAccount(gameVault, admin, developer, player);

		await expect(
			gameVault.connect(developer).addAsset(1n, "Legendary Sword", 1n),
		)
			.to.emit(gameVault, "AssetAdded")
			.withArgs(1n, 1n, 1n, "Legendary Sword", 1n, developer.address);

		expect(await gameVault.getAsset(1n)).to.deep.equal([
			1n,
			1n,
			1n,
			"Legendary Sword",
			1n,
			true,
		]);
	});

	it("returns the GameAccount owner for an asset", async function () {
		const { gameVault, admin, developer, player } = await deployFixture();
		await createGameAccount(gameVault, admin, developer, player);
		await gameVault.connect(developer).addAsset(1n, "Legendary Sword", 1n);

		expect(await gameVault.getAssetOwner(1n)).to.equal(player.address);
	});

	it("allows only the developer to change asset status", async function () {
		const { gameVault, admin, developer, player, anotherPlayer } = await deployFixture();
		await createGameAccount(gameVault, admin, developer, player);
		await gameVault.connect(developer).addAsset(1n, "Legendary Sword", 1n);

		await expect(
			gameVault.connect(anotherPlayer).setAssetActive(1n, false),
		).to.be.revertedWithCustomError(gameVault, "UnauthorizedAssetDeveloper");

		await expect(gameVault.connect(developer).setAssetActive(1n, false))
			.to.emit(gameVault, "AssetStatusChanged")
			.withArgs(1n, 1n, false, developer.address);

		expect((await gameVault.getAsset(1n)).active).to.equal(false);
	});

	it("rejects asset creation from a non-developer", async function () {
		const { gameVault, admin, developer, player, anotherPlayer } = await deployFixture();
		await createGameAccount(gameVault, admin, developer, player);

		await expect(
			gameVault.connect(anotherPlayer).addAsset(1n, "Sword", 1n),
		).to.be.revertedWithCustomError(gameVault, "UnauthorizedDeveloper");
	});

	it("rejects assets with zero quantity", async function () {
		const { gameVault, admin, developer, player } = await deployFixture();
		await createGameAccount(gameVault, admin, developer, player);

		await expect(
			gameVault.connect(developer).addAsset(1n, "Sword", 0n),
		).to.be.revertedWithCustomError(gameVault, "InvalidQuantity");
	});

	it("rejects assets with an empty name", async function () {
		const { gameVault, admin, developer, player } = await deployFixture();
		await createGameAccount(gameVault, admin, developer, player);

		await expect(
			gameVault.connect(developer).addAsset(1n, "", 1n),
		).to.be.revertedWithCustomError(gameVault, "EmptyString");
	});

	it("rejects assets for a non-existent account", async function () {
		const { gameVault, developer } = await deployFixture();

		await expect(
			gameVault.connect(developer).addAsset(999n, "Sword", 1n),
		).to.be.revertedWithCustomError(gameVault, "AccountNotFound");
	});

	it("rejects reading a non-existent asset", async function () {
		const { gameVault } = await deployFixture();

		await expect(gameVault.getAsset(999n)).to.be.revertedWithCustomError(
			gameVault,
			"AssetNotFound",
		);
	});

	it("rejects reading the owner of a non-existent asset", async function () {
		const { gameVault } = await deployFixture();

		await expect(gameVault.getAssetOwner(999n)).to.be.revertedWithCustomError(
			gameVault,
			"AssetNotFound",
		);
	});
});
