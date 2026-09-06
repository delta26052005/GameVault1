export const GAMEVAULT_CONTRACT_ADDRESS =
	'0x5FbDB2315678afecb367f032d93F642f64180aa3';

export const GAMEVAULT_ABI = [
	{
		inputs: [
			{ internalType: 'uint256', name: 'gameId', type: 'uint256' },
			{ internalType: 'string', name: 'externalAccountId', type: 'string' },
			{ internalType: 'address', name: 'player', type: 'address' }
		],
		name: 'linkGameAccount',
		outputs: [{ internalType: 'uint256', name: 'accountId', type: 'uint256' }],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'uint256',
				name: 'accountId',
				type: 'uint256'
			},
			{
				indexed: true,
				internalType: 'uint256',
				name: 'gameId',
				type: 'uint256'
			},
			{
				indexed: false,
				internalType: 'string',
				name: 'externalAccountId',
				type: 'string'
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'owner',
				type: 'address'
			},
			{
				indexed: false,
				internalType: 'address',
				name: 'linkedBy',
				type: 'address'
			}
		],
		name: 'GameAccountLinked',
		type: 'event'
	},
	{
		inputs: [
			{ internalType: 'uint256', name: 'accountId', type: 'uint256' },
			{ internalType: 'address', name: 'newOwner', type: 'address' }
		],
		name: 'transferAccount',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'accountId',
				type: 'uint256'
			},
			{
				internalType: 'string',
				name: 'name',
				type: 'string'
			},
			{
				internalType: 'uint256',
				name: 'quantity',
				type: 'uint256'
			}
		],
		name: 'addAsset',
		outputs: [
			{
				internalType: 'uint256',
				name: 'assetId',
				type: 'uint256'
			}
		],
		stateMutability: 'nonpayable',
		type: 'function'
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'uint256',
				name: 'assetId',
				type: 'uint256'
			},
			{
				indexed: true,
				internalType: 'uint256',
				name: 'gameId',
				type: 'uint256'
			},
			{
				indexed: true,
				internalType: 'uint256',
				name: 'accountId',
				type: 'uint256'
			},
			{
				indexed: false,
				internalType: 'string',
				name: 'name',
				type: 'string'
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'quantity',
				type: 'uint256'
			},
			{
				indexed: false,
				internalType: 'address',
				name: 'addedBy',
				type: 'address'
			}
		],
		name: 'AssetAdded',
		type: 'event'
	}
];
