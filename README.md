# GameVault

GameVault is a local-demo digital asset platform that combines a React/Vite
interface, an Express/MongoDB backend, and a Solidity smart contract deployed
with Hardhat. It models registered games, developer wallets, player game
accounts, digital assets, ownership transfers, and blockchain-backed status
verification.

This repository is intended for local development and demonstration. It is
not presented as a production deployment or a completed security audit.

## Project overview

GameVault uses MongoDB for application data and the GameVault smart contract as
the authoritative source for on-chain permissions and blockchain state.

- **MongoDB** stores users, password hashes, verified wallet addresses, game
  metadata, game-account references, asset metadata, transaction hashes, and
  transfer history.
- **The blockchain** stores games, game accounts, asset records, ownership,
  active/inactive state, and the contract's authorization rules.
- **The backend** authenticates users, verifies submitted blockchain
  transactions, enforces application-level authorization, and synchronizes
  confirmed blockchain operations into MongoDB.
- **The frontend** provides the user interface and uses MetaMask for wallet
  signatures and developer/player transactions.

The current implementation targets one configured GameVault contract and one
configured EVM network. Cross-chain interoperability is not implemented.

## Key features

- Username/email/password registration and JWT login.
- Cryptographic wallet verification using an expiring signed challenge.
- Persistent developer authorization based on the verified wallet stored for the
  authenticated user.
- Contract-admin authorization based on the deployed contract's `admin()`
  address and the configured backend signer.
- Admin-only game registration and game activation/deactivation.
- Developer-signed game-account linking through MetaMask.
- Player-owned game-account ownership transfers through MetaMask.
- Developer-signed asset creation and asset activation/deactivation.
- Backend verification of transaction receipts, destination contracts, senders,
  expected events, event arguments, and final on-chain state before MongoDB
  synchronization.
- Blockchain/MongoDB verification indicators for games, accounts, and assets.
- Transaction hashes and reconciliation details when blockchain confirmation
  succeeds but MongoDB persistence fails.
- Idempotent confirmation handling for account transfers and synchronized
  blockchain records.
- Activity history for registrations, account links, assets, transfers, and
  confirmed status changes.
- Local persistence of pending asset synchronization information in the
  browser so a refresh does not immediately lose a confirmed transaction hash.

## Technology stack

- **Frontend:** React 19, React Router, Vite, ethers.js, MetaMask
- **Backend:** Node.js, Express 5, JWT, bcrypt, ethers.js
- **Database:** MongoDB with Mongoose
- **Blockchain:** Solidity, Hardhat 3, Hardhat Ignition, ethers.js
- **Testing:** Hardhat Mocha/ethers tests and Solidity tests

## System architecture

```text
Browser / React + Vite
        |
        | HTTP + JWT
        v
Express backend (:5000)
   |              |
   |              +--> MongoDB
   |
   +--> Configured JSON-RPC provider and backend signer
                         |
                         v
                 GameVault Solidity contract

Browser / MetaMask
        |
        +--> Developer/player-signed contract transactions
        |
        +--> Backend receives transaction hashes for independent verification
```

The backend signer is used for contract operations that require platform-admin
permission, such as game registration and game status changes. Developers use
their own MetaMask wallet for developer-authorized operations. Private keys are
not sent to or stored by the frontend.

## Project directory structure

```text
GameVault/
├── backend/
│   ├── scripts/
│   │   └── seedDemo.js
│   └── src/
│       ├── config/          # MongoDB and blockchain configuration
│       ├── middleware/      # JWT and admin authorization
│       ├── models/          # Mongoose schemas
│       ├── routes/          # Auth, user, game, account, and asset APIs
│       ├── services/        # Blockchain verification and developer checks
│       └── server.js
├── blockchain/
│   ├── contracts/
│   │   └── GameVault.sol
│   ├── ignition/modules/
│   │   └── GameVault.ts
│   ├── test/
│   ├── hardhat.config.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── config/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
├── .env                  # Backend/local configuration; do not commit
└── README.md
```

Generated directories such as `node_modules`, Hardhat artifacts/cache, and the
frontend build output are omitted from the overview.

## Prerequisites

Install the following before setup:

- Node.js with npm
- MongoDB, running locally or at an accessible URI
- MetaMask (for wallet signing and player/developer flows)
- A terminal capable of running three local processes

The repository currently contains separate package manifests for the backend,
frontend, and blockchain workspace. The root `package.json` does not define
application scripts.

## Installation

Clone the repository and install dependencies in each workspace:

```powershell
git clone <repository-url>
cd GameVault

cd backend
npm install

cd ..\blockchain
npm install

cd ..\frontend
npm install
```

Replace `<repository-url>` with the repository URL used for your clone.

## Environment variable configuration

### Backend/local configuration

The backend loads the repository-root `.env` file. Configure these variables:

```dotenv
MONGODB_URI=<mongodb-connection-string>
JWT_SECRET=<long-random-jwt-secret>
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_PRIVATE_KEY=<private-key-for-the-configured-backend-signer>
GAMEVAULT_CONTRACT_ADDRESS=<deployed-gamevault-address>
```

These names are read directly by the backend configuration, authentication,
database startup, and demo seed code. Do not commit the file, expose its
values, or use a wallet private key that controls real funds for this local
demo.

The configured backend signer must correspond to the smart contract's
`admin()` address for admin-only backend operations.

### Frontend configuration

Vite reads frontend environment files when the frontend is started from the
`frontend` workspace. Create `frontend/.env.local` with:

```dotenv
VITE_GAMEVAULT_CONTRACT_ADDRESS=<same-deployed-gamevault-address>
```

This must match the backend's `GAMEVAULT_CONTRACT_ADDRESS`. The frontend
validates that the value is a valid Ethereum address before creating a
contract instance.

### Optional Hardhat Sepolia configuration

The current Hardhat configuration also defines a `sepolia` network using these
Hardhat configuration variables:

```text
SEPOLIA_RPC_URL
SEPOLIA_PRIVATE_KEY
```

The local GameVault workflow does not require Sepolia. Do not configure or use
this network unless you deliberately intend to work with it and understand the
associated key and funds requirements.

## Local blockchain setup using Hardhat

Open a terminal in the blockchain workspace and start the local JSON-RPC
network:

```powershell
cd blockchain
npx hardhat node
```

Keep this process running. It exposes the configured `localhost` Hardhat
network at `http://127.0.0.1:8545`.

Use one of the accounts/private keys displayed by Hardhat for the local
backend signer, and use the corresponding deployed contract address in both
backend and frontend configuration.

## Smart contract deployment

With `npx hardhat node` still running, open a second terminal:

```powershell
cd blockchain
npm run deploy:localhost
```

This runs the repository's configured Hardhat Ignition deployment:

```text
hardhat ignition deploy ignition/modules/GameVault.ts --network localhost
```

The deployment module deploys `GameVault.sol`. Copy the resulting deployed
address into:

- `GAMEVAULT_CONTRACT_ADDRESS` in the repository-root backend `.env`
- `VITE_GAMEVAULT_CONTRACT_ADDRESS` in `frontend/.env.local`

The exact address is generated by the local deployment and is not hardcoded in
this README.

## Backend setup and startup

Ensure MongoDB is running and the root `.env` is configured. Then:

```powershell
cd backend
npm start
```

The backend starts on port `5000` and exposes the health endpoint:

```text
http://localhost:5000/api/health
```

On startup, the backend connects to MongoDB and verifies the asset
`blockchainAssetId` index before serving requests.

The backend package also contains this command:

```powershell
npm run seed:demo
```

The seed script reconciles existing MongoDB demo records with the configured
local blockchain and can modify both MongoDB and blockchain state. It is not
required for a clean installation and should only be run intentionally after
reviewing the local data and configuration.

## Frontend setup and startup

After configuring `frontend/.env.local`, open another terminal:

```powershell
cd frontend
npm run dev
```

Vite prints the local frontend URL, normally
`http://localhost:5173`. The frontend currently calls the backend at
`http://localhost:5000`; that API URL is defined in `frontend/src/App.jsx`.

Install and unlock MetaMask on the same local network when using wallet-backed
features. Import only a disposable local Hardhat account for this demo.

## Testing commands

### Smart contract tests and compilation

```powershell
cd blockchain
npx hardhat compile
npm test
```

The blockchain package's `test` script runs `hardhat test`, including the
Solidity and Mocha/ethers test suites.

### Frontend lint and production build

```powershell
cd frontend
npm run lint
npm run build
```

### Backend syntax checks

The backend package currently has no implemented automated test suite. Its
`npm test` script is a placeholder that exits with `Error: no test specified`.
Individual CommonJS files can be syntax-checked with Node, for example:

```powershell
cd backend
node --check src/server.js
node --check src/routes/gameRoutes.js
node --check src/routes/gameAccountRoutes.js
node --check src/routes/assetRoutes.js
node --check scripts/seedDemo.js
```

Do not treat syntax checks as MongoDB, MetaMask, or end-to-end integration
tests.

## Local demo workflow

1. Start MongoDB.
2. Start the local Hardhat node:
   `cd blockchain; npx hardhat node`.
3. Deploy the contract with `npm run deploy:localhost`.
4. Configure the generated contract address in the backend root `.env` and
   `frontend/.env.local`.
5. Configure the backend signer and MongoDB URI.
6. Start the backend with `cd backend; npm start`.
7. Start the frontend with `cd frontend; npm run dev`.
8. Register a user and log in.
9. Verify a wallet by requesting the wallet challenge and signing it with
   MetaMask.
10. For a developer, complete the developer wallet verification flow.
11. As the platform admin, register a game using the verified developer wallet.
12. As the developer, connect the developer wallet and link a player game
    account through MetaMask.
13. As the player, connect the account owner wallet to transfer ownership when
    appropriate.
14. As the developer, create assets and manage their active status.
15. Review the dashboard, blockchain verification indicators, and Activity
    page.

Game registration and game status changes require the platform admin. Account
linking, asset creation, and asset status changes require the registered game
developer. Account transfers require the current on-chain account owner.

## Security considerations

- Never commit `.env`, private keys, JWT secrets, MongoDB credentials, or
  wallet recovery material.
- Use disposable Hardhat accounts for local demonstrations.
- Wallet ownership is established through `ethers.verifyMessage()` over a
  server-generated challenge; frontend role checks are not the security
  boundary.
- The backend compares the authenticated user's persisted verified wallet with
  the game's registered developer address.
- Platform-admin operations are checked against the contract's `admin()` value
  and the configured backend signer.
- Developer asset status transactions must originate from the developer wallet;
  the backend does not accept a private key from the frontend.
- Submitted transaction hashes are independently checked against receipt
  status, destination, sender, expected event arguments, and final contract
  state before MongoDB is updated.
- MongoDB is not a replacement for blockchain verification. A MongoDB record
  may be historical or temporarily unsynchronized with the current local
  chain.
- A confirmed blockchain transaction followed by a MongoDB failure requires
  reconciliation; it must not be treated as an unconfirmed blockchain action.

## Limitations and future scope

- This is a local demo, not a production deployment or a claim of
  production-readiness.
- MongoDB, MetaMask, and live local-chain integration require manual
  environment setup and are not represented by the automated contract tests.
- The backend test command is currently a placeholder; focused backend
  integration tests would be a useful future addition.
- The frontend backend URL is currently fixed to `http://localhost:5000`.
- The application targets one configured GameVault contract and network.
  Cross-chain support is not implemented.
- Reconciliation after a successful blockchain transaction and failed MongoDB
  write is represented through response metadata and retry-oriented flows;
  it is not a separate background job or administrative reconciliation service.
- The local demo uses a backend signer for platform-admin contract operations.
  A production deployment would require a separately designed key-management
  and operational security model.
- No production deployment, external security audit, or mainnet support is
  claimed.
