import Login from './components/Login'
import ConnectWallet from './components/ConnectWallet'
import TestGameAccountBlockchain from './components/TestGameAccountBlockchain'
import TestAddAssetBlockchain from './components/TestAddAssetBlockchain'
import TestTransferAccountBlockchain from './components/TestTransferAccountBlockchain'

function App() {
  return (
    <>
      <Login />
      <ConnectWallet />
      <TestGameAccountBlockchain />
      <TestAddAssetBlockchain />
      <TestTransferAccountBlockchain />
    </>
  )
}

export default App
