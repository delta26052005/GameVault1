import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("GameVaultModule", (m) => {
	const gameVault = m.contract("GameVault");

	return { gameVault };
});
