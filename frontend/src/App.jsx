import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { addAssetOnBlockchain, linkGameAccountOnBlockchain, transferAccountOnBlockchain } from './services/blockchainService'
import './App.css'

const API_URL = 'http://localhost:5000'

async function apiFetch(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || 'Request failed')
    error.status = response.status
    throw error
  }
  return data
}

async function apiFetchWithFallback(paths, token, options = {}) {
  let lastError
  for (const path of paths) {
    try {
      return await apiFetch(path, token, options)
    } catch (error) {
      lastError = error
      if (error.status !== 404) throw error
    }
  }
  throw lastError
}

async function getProfile(token) {
  try {
    return await apiFetch('/api/auth/profile', token)
  } catch (error) {
    if (error.status !== 404) throw error
    return apiFetch('/api/user/profile', token)
  }
}

function Brand() {
  return <div className="brand"><div className="brand-mark"><span>G</span></div><div><div className="brand-name">GAMEVAULT</div><span className="brand-caption">PLAYER OWNED</span></div></div>
}

function Sidebar({ open, onClose }) {
  const links = [['⌂', 'Overview', '/dashboard'], ['▣', 'My Games', '/games'], ['◇', 'Asset Inventory', '/assets'], ['↗', 'Activity', '/activity'], ['◉', 'Profile', '/profile']]
  return <aside className={`sidebar ${open ? 'open' : ''}`}><Brand /><div className="nav-label">Workspace</div><nav className="nav-list">{links.map(([icon, label, path]) => <NavLink key={path} to={path} onClick={onClose} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-icon">{icon}</span>{label}</NavLink>)}</nav><div className="sidebar-footer"><div className="connection-mini"><span className="status-dot" /> Local network connected</div><div className="muted" style={{ marginTop: 8 }}>Live data workspace</div></div></aside>
}

function Topbar({ onMenu, onLogout, user }) {
  const location = useLocation()
  const labels = { '/dashboard': 'Overview', '/games': 'My Games', '/assets': 'Asset Inventory', '/activity': 'Activity', '/profile': 'Profile' }
  const initials = user?.username?.slice(0, 2).toUpperCase() || 'GV'
  return <header className="topbar"><button className="mobile-menu" onClick={onMenu}>☰</button><div className="topbar-title">{labels[location.pathname] || 'GameVault'}</div><div className="topbar-right"><div className="network"><span className="status-dot" /> Hardhat Local</div><div className="wallet-chip">{user?.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : 'Wallet not linked'}</div><button className="outline-btn logout-button" onClick={onLogout}>Log out</button><div className="avatar">{initials}</div></div></header>
}

function AppShell({ children, onLogout, user }) {
  const [open, setOpen] = useState(false)
  return <div className="app-shell"><div className="shell-layout"><Sidebar open={open} onClose={() => setOpen(false)} /><main className="main-area"><Topbar onMenu={() => setOpen(true)} onLogout={onLogout} user={user} />{children}</main></div></div>
}

function PageHeading({ eyebrow, title, description, children }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</div>
}

function StatCard({ label, value, detail }) {
  return <div className="panel stat-card"><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></div>
}

function StatusMessage({ message, error = false }) {
  return message ? <div className={`feedback ${error ? 'feedback-error' : ''}`}>{message}</div> : null
}

function GameCard({ game, onLink }) {
  const id = game._id || game.id
  return <div className="panel game-card"><div className={`game-cover ${game.name?.includes('Neon') ? 'cover-void' : 'cover-rift'}`}><div><div className="cover-title">{game.name?.slice(0, 2).toUpperCase()}</div><div className="cover-subtitle">{game.description || 'PLAYER WORLD'}</div></div></div><div className="game-content"><div className="game-row"><span className="game-name">{game.name}</span><span className={`badge ${game.active === false ? 'badge-grey' : 'badge-live'}`}>{game.active === false ? 'Inactive' : 'Live'}</span></div><div className="game-details"><div><span className="detail-label">Blockchain ID</span><span className="detail-value">#{game.blockchainGameId}</span></div><div><span className="detail-label">Developer</span><span className="detail-value">{game.developerAddress ? `${game.developerAddress.slice(0, 6)}...${game.developerAddress.slice(-4)}` : 'Unknown'}</span></div></div>{onLink && <button className="outline-btn card-action" onClick={() => onLink(game)}>Link game account</button>}<div className="muted id-line">Mongo ID: {id}</div></div></div>
}

function AssetRow({ asset }) {
  return <div className="panel asset-card"><div className="asset-row"><div className="asset-icon">◇</div><div className="asset-info"><div className="asset-name">{asset.name}</div><div className="asset-sub">Account #{asset.blockchainAssetId} · {asset.game?.name || 'Linked game'}</div></div><div style={{ textAlign: 'right' }}><div className="quantity">x{asset.quantity}</div><div className="asset-sub">On-chain</div></div></div></div>
}

function ActivityList({ items }) {
  if (!items.length) return <div className="empty-state">No activity recorded yet. Confirmed blockchain actions will appear here.</div>
  return <div className="activity-list">{items.map((item, index) => <div className="activity-item" key={`${item.title}-${index}`}>{index < items.length - 1 && <div className="activity-line" />}<div className="activity-icon">{item.icon}</div><div className="activity-copy"><div className="activity-main"><strong>{item.title}</strong><br />{item.detail}</div><div className="activity-time">{item.time} <span className="activity-status"> · Confirmed</span></div></div></div>)}</div>
}

function WalletPanel({ user, token, onUserChange }) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState('')

  async function connectAndVerify() {
    setBusy(true); setStatus(''); setError(false)
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const address = accounts[0]
      if (!address) throw new Error('No MetaMask account selected')
      setConnected(address)
      const challenge = await apiFetch('/api/user/wallet/challenge', token, { method: 'POST' })
      const signer = await provider.getSigner()
      const signature = await signer.signMessage(challenge.challenge)
      const result = await apiFetch('/api/user/wallet/verify', token, { method: 'POST', body: JSON.stringify({ walletAddress: address, signature }) })
      onUserChange({ ...user, walletAddress: result.walletAddress })
      setStatus('Wallet verified successfully')
    } catch (err) {
      setError(true); setStatus(err.message || 'Wallet verification failed')
    } finally { setBusy(false) }
  }

  return <section className="panel panel-pad wallet-panel"><div className="section-title"><h2>Wallet identity</h2><span className={`badge ${user?.walletAddress ? 'badge-live' : 'badge-grey'}`}>{user?.walletAddress ? 'Verified' : 'Not linked'}</span></div><div className="wallet-box"><span className="wallet-address">{user?.walletAddress || connected || 'Connect MetaMask to verify ownership'}</span><span style={{ color: 'var(--teal)' }}>{user?.walletAddress ? '✓' : '○'}</span></div><button className="primary-btn" onClick={connectAndVerify} disabled={busy}>{busy ? 'Verifying wallet...' : user?.walletAddress ? 'Re-verify wallet' : 'Connect & verify wallet'}</button><StatusMessage message={status} error={error} /></section>
}

function Dashboard({ user, games, accounts, assets, activity, onWalletChange, token, error }) {
  return <div className="page"><PageHeading eyebrow="Player command center" title={`Welcome back, ${user?.username || 'player'}.`} description="Your gaming identity, accounts, and assets in one place." /><StatusMessage message={error} error /><div className="grid stats-grid"><StatCard label="Linked games" value={String(games.length).padStart(2, '0')} detail={games.length ? 'Live from GameVault' : 'No games linked'} /><StatCard label="Game accounts" value={String(accounts.length).padStart(2, '0')} detail={accounts.length ? 'MongoDB records' : 'No accounts linked'} /><StatCard label="Owned assets" value={String(assets.length).padStart(2, '0')} detail={assets.length ? 'Verified inventory' : 'No assets found'} /><StatCard label="Wallet status" value={user?.walletAddress ? 'ON' : 'OFF'} detail={user?.walletAddress ? 'Verified owner' : 'Connect wallet'} /></div><div className="grid dashboard-grid"><section><div className="section-title"><h2>Identity</h2><NavLink to="/profile">View profile →</NavLink></div><div className="profile-panel panel"><div className="profile-avatar">{user?.username?.slice(0, 2).toUpperCase() || 'GV'}</div><div><div className="profile-name">{user?.username || 'Player'}</div><div className="profile-meta">{user?.email || 'Account email unavailable'}</div></div><span className="profile-badge">{user?.walletAddress ? 'Verified owner' : 'Wallet pending'}</span></div><div className="section-title"><h2>Linked games</h2><NavLink to="/games">View all →</NavLink></div>{games.length ? <div className="grid game-grid">{games.slice(0, 2).map(game => <GameCard key={game._id} game={game} />)}</div> : <div className="panel empty-state">No games available yet. Connect the backend to a game registry entry.</div>}</section><section><div className="section-title"><h2>Recent activity</h2><NavLink to="/activity">View all →</NavLink></div><div className="panel panel-pad"><ActivityList items={activity.slice(0, 4)} /></div><div style={{ marginTop: 18 }}><WalletPanel user={user} token={token} onUserChange={onWalletChange} /></div></section></div></div>
}

function AuthForm({ mode, onAuthenticated }) {
  const navigate = useNavigate()
  const isRegister = mode === 'register'
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  function update(field, value) { setForm(current => ({ ...current, [field]: value })) }
  async function submit(event) {
    event.preventDefault(); setMessage(''); setBusy(true)
    try {
      if (isRegister && form.password !== form.confirmPassword) throw new Error('Passwords do not match')
      const paths = isRegister ? ['/api/user/register', '/api/auth/register'] : ['/api/user/login', '/api/auth/login']
      const body = isRegister ? { username: form.username, email: form.email, password: form.password } : { email: form.email, password: form.password }
      const data = await apiFetchWithFallback(paths, '', { method: 'POST', body: JSON.stringify(body) })
      if (isRegister) {
        setMessage('Account created. You can sign in now.')
        navigate('/login')
      } else {
        localStorage.setItem('token', data.token)
        onAuthenticated(data.user)
        navigate('/dashboard')
      }
    } catch (err) { setMessage(err.message) } finally { setBusy(false) }
  }
  return <div className="login-page"><div className="login-art"><Brand /><div className="login-copy"><div className="eyebrow">{isRegister ? 'Build your player identity' : 'Your identity. Your inventory.'}</div><h1>{isRegister ? <>Keep your<br /><span style={{ color: 'var(--teal)' }}>progress.</span></> : <>Own your<br /><span style={{ color: 'var(--teal)' }}>game.</span></>}</h1><p>GameVault brings your gaming identities, accounts, and digital assets together in one player-owned layer.</p><div className="login-points"><div className="login-point"><span>✦</span> One identity across every world</div><div className="login-point"><span>◇</span> Transparent, verifiable ownership</div><div className="login-point"><span>↗</span> Verifiable ownership records</div></div></div></div><div className="login-form-area"><div className="login-card"><div className="eyebrow">{isRegister ? 'Start your vault' : 'Welcome back'}</div><h2>{isRegister ? 'Create your account' : 'Enter the vault'}</h2><p>{isRegister ? 'Set up your player profile in a few seconds.' : 'Sign in to access your player-owned dashboard.'}</p><form className="login-form" onSubmit={submit}>{isRegister && <label>Username<input type="text" value={form.username} onChange={event => update('username', event.target.value)} placeholder="player_name" required /></label>}<label>Email<input type="email" value={form.email} onChange={event => update('email', event.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" value={form.password} onChange={event => update('password', event.target.value)} placeholder="••••••••" required /></label>{isRegister && <label>Confirm password<input type="password" value={form.confirmPassword} onChange={event => update('confirmPassword', event.target.value)} placeholder="••••••••" required /></label>}{message && <StatusMessage message={message} error={!isRegister || message.includes('match')} />}<button className="primary-btn" type="submit" disabled={busy}>{busy ? 'Please wait...' : isRegister ? 'Create GameVault account →' : 'Sign in to GameVault →'}</button></form><div className="auth-switch">{isRegister ? <>Already have an account? <NavLink to="/login">Sign in</NavLink></> : <>New to GameVault? <NavLink to="/register">Create an account</NavLink></>}</div><div className="demo-note">Live backend · No demo session</div></div></div></div>
}

function Games({ games, token, onRefresh }) {
  const [selected, setSelected] = useState(null)
  const [externalAccountId, setExternalAccountId] = useState('')
  const [ownerWallet, setOwnerWallet] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function linkAccount(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const walletAccounts = await provider.send('eth_requestAccounts', [])
      const player = walletAccounts[0]
      const result = await linkGameAccountOnBlockchain(selected.blockchainGameId, externalAccountId, player)
      const data = await apiFetch('/api/game-accounts', token, { method: 'POST', body: JSON.stringify({ gameId: selected._id, externalAccountId, ownerWallet: ownerWallet || player, transactionHash: result.transactionHash }) })
      setMessage(`Game account linked: #${data.gameAccount.blockchainAccountId}`); setExternalAccountId(''); setOwnerWallet(''); onRefresh()
    } catch (err) { setMessage(err.message) } finally { setBusy(false) }
  }
  return <div className="page"><PageHeading eyebrow="Your collection" title="My games" description="Connected titles and the identities you carry between them." /><div className="grid game-grid">{games.map(game => <GameCard key={game._id} game={game} onLink={setSelected} />)}</div>{!games.length && <div className="panel empty-state">No games returned by the backend.</div>}{selected && <div className="modal-backdrop"><form className="modal-card panel" onSubmit={linkAccount}><button className="modal-close" type="button" onClick={() => setSelected(null)}>×</button><div className="eyebrow">Link account</div><h2>{selected.name}</h2><p className="muted">This action requires the verified developer wallet and a confirmed blockchain transaction.</p><label>External account ID<input className="filter-input form-input" value={externalAccountId} onChange={event => setExternalAccountId(event.target.value)} placeholder="player-001" required /></label><label>Owner wallet<input className="filter-input form-input" value={ownerWallet} onChange={event => setOwnerWallet(event.target.value)} placeholder="Defaults to connected wallet" /></label><button className="primary-btn" type="submit" disabled={busy}>{busy ? 'Waiting for transaction...' : 'Link on blockchain'}</button><StatusMessage message={message} error={message && !message.includes('linked:')} /></form></div>}</div>
}

function Assets({ accounts, assets, token, onRefresh }) {
  const [selectedAccount, setSelectedAccount] = useState('')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function createAsset(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const account = accounts.find(item => item._id === selectedAccount)
      if (!account) throw new Error('Select a game account first')
      const result = await addAssetOnBlockchain(account.blockchainAccountId, name, Number(quantity))
      const data = await apiFetch('/api/assets', token, { method: 'POST', body: JSON.stringify({ gameId: account.game?._id || account.game, gameAccountId: account._id, name, quantity: Number(quantity), transactionHash: result.transactionHash }) })
      setMessage(`Asset created: #${data.asset.blockchainAssetId}`); setName(''); setQuantity(1); onRefresh()
    } catch (err) { setMessage(err.message) } finally { setBusy(false) }
  }
  return <div className="page"><PageHeading eyebrow="Portable inventory" title="Asset inventory" description="Verified items held across your linked game accounts." /><div className="inventory-layout"><section><div className="section-title"><h2>Owned assets</h2></div>{assets.length ? <div className="asset-list">{assets.map(asset => <AssetRow key={asset._id} asset={asset} />)}</div> : <div className="panel empty-state">No assets found for your loaded game accounts.</div>}</section><form className="panel panel-pad action-panel" onSubmit={createAsset}><div className="eyebrow">Blockchain action</div><h2>Add asset</h2><p className="muted">Create on-chain first, then persist the verified event.</p><label>Game account<select className="filter-input form-input" value={selectedAccount} onChange={event => setSelectedAccount(event.target.value)} required><option value="">Select account</option>{accounts.map(account => <option key={account._id} value={account._id}>{account.game?.name || 'Game account'} · #{account.blockchainAccountId}</option>)}</select></label><label>Asset name<input className="filter-input form-input" value={name} onChange={event => setName(event.target.value)} placeholder="Shield of Valor" required /></label><label>Quantity<input className="filter-input form-input" type="number" min="1" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label><button className="primary-btn" type="submit" disabled={busy}>{busy ? 'Confirming...' : 'Add asset'}</button><StatusMessage message={message} error={message && !message.startsWith('Asset created')} /></form></div></div>
}

function TransferPanel({ accounts, token, onRefresh }) {
  const [selectedAccount, setSelectedAccount] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function transfer(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const account = accounts.find(item => item._id === selectedAccount)
      if (!account) throw new Error('Select a game account first')
      if (!newOwner) throw new Error('New owner wallet is required')
      const result = await transferAccountOnBlockchain(account.blockchainAccountId, newOwner)
      await apiFetch('/api/game-accounts/transfer/confirm', token, { method: 'POST', body: JSON.stringify({ transactionHash: result, gameAccountId: account._id, accountId: account.blockchainAccountId, newOwner }) })
      setMessage('Account ownership transferred and synchronized successfully'); setNewOwner(''); onRefresh()
    } catch (err) { setMessage(err.message) } finally { setBusy(false) }
  }
  return <form className="panel panel-pad action-panel" onSubmit={transfer}><div className="eyebrow">Ownership transfer</div><h2>Transfer account</h2><p className="muted">Confirm the wallet transfer on-chain before syncing MongoDB.</p><label>Game account<select className="filter-input form-input" value={selectedAccount} onChange={event => setSelectedAccount(event.target.value)} required><option value="">Select account</option>{accounts.map(account => <option key={account._id} value={account._id}>{account.game?.name || 'Game account'} · #{account.blockchainAccountId}</option>)}</select></label><label>New owner wallet<input className="filter-input form-input" value={newOwner} onChange={event => setNewOwner(event.target.value)} placeholder="0x..." required /></label><button className="primary-btn" type="submit" disabled={busy}>{busy ? 'Confirming transfer...' : 'Transfer ownership'}</button><StatusMessage message={message} error={message && !message.includes('synchronized')} /></form>
}

function Activity({ activity }) {
  return <div className="page"><PageHeading eyebrow="Proof of ownership" title="Activity" description="A transparent record of confirmed actions from this session." /><div className="panel panel-pad"><ActivityList items={activity} /></div></div>
}

function Profile({ user, accounts, token, onUserChange, onRefresh }) {
  return <div className="page"><PageHeading eyebrow="Identity settings" title="Profile" description="Your live account and verified wallet information." /><div className="grid profile-grid"><section className="panel panel-pad"><div className="profile-header"><div className="profile-big-avatar">{user?.username?.slice(0, 2).toUpperCase() || 'GV'}</div><div><div className="profile-title">{user?.username || 'Player'}</div><div className="profile-meta">{user?.email || 'Email unavailable'}</div></div></div><div className="profile-fields"><div><span className="field-label">Username</span><span className="field-value">{user?.username || '—'}</span></div><div><span className="field-label">Email</span><span className="field-value">{user?.email || '—'}</span></div><div><span className="field-label">User ID</span><span className="field-value">{user?.id || user?._id || '—'}</span></div><div><span className="field-label">Wallet</span><span className="field-value">{user?.walletAddress ? 'Verified' : 'Not linked'}</span></div></div></section><div className="profile-actions"><WalletPanel user={user} token={token} onUserChange={onUserChange} /><TransferPanel accounts={accounts} token={token} onRefresh={onRefresh} /></div></div></div>
}

function ProtectedRoute({ children, token, loading }) {
  if (loading) return <div className="loading-page">Loading your GameVault...</div>
  return token ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children, token }) {
  return token ? <Navigate to="/dashboard" replace /> : children
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [games, setGames] = useState([])
  const [accounts, setAccounts] = useState([])
  const [assets, setAssets] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(Boolean(token))
  const [loadError, setLoadError] = useState('')

  async function loadWorkspace(activeToken = token) {
    if (!activeToken) return
    setLoading(true); setLoadError('')
    try {
      const profile = await getProfile(activeToken)
      const [gamesData, accountsData] = await Promise.all([apiFetch('/api/games', activeToken), apiFetch('/api/game-accounts', activeToken)])
      const gameAccounts = accountsData.gameAccounts || []
      const assetResults = await Promise.all(gameAccounts.map(account => apiFetch(`/api/assets/account/${account._id}`, activeToken).catch(() => ({ assets: [] }))))
      setUser(current => ({ ...current, ...profile, id: profile.userId || profile.id || current?.id }))
      setGames(gamesData.games || [])
      setAccounts(gameAccounts)
      setAssets(assetResults.flatMap(result => result.assets || []))
    } catch (err) { setLoadError(err.message); if (err.status === 401) logout() } finally { setLoading(false) }
  }

  // Defer the stateful workspace load until after the route render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) queueMicrotask(() => loadWorkspace(token)) }, [token])

  function onAuthenticated(loginUser) { setUser(loginUser); setToken(localStorage.getItem('token')) }
  function onUserChange(updatedUser) { setUser(current => ({ ...current, ...updatedUser })) }
  function logout() { localStorage.removeItem('token'); setToken(null); setUser(null); setGames([]); setAccounts([]); setAssets([]); setActivity([]) }
  function refresh() { loadWorkspace(token) }

  const shellProps = { onLogout: logout, user }
  return <BrowserRouter><Routes><Route path="/login" element={<PublicRoute token={token}><AuthForm mode="login" onAuthenticated={onAuthenticated} /></PublicRoute>} /><Route path="/register" element={<PublicRoute token={token}><AuthForm mode="register" onAuthenticated={onAuthenticated} /></PublicRoute>} /><Route path="/dashboard" element={<ProtectedRoute token={token} loading={loading}><AppShell {...shellProps}><Dashboard user={user} games={games} accounts={accounts} assets={assets} activity={activity} onWalletChange={onUserChange} token={token} error={loadError} /></AppShell></ProtectedRoute>} /><Route path="/games" element={<ProtectedRoute token={token} loading={loading}><AppShell {...shellProps}><Games games={games} token={token} onRefresh={refresh} /></AppShell></ProtectedRoute>} /><Route path="/assets" element={<ProtectedRoute token={token} loading={loading}><AppShell {...shellProps}><Assets accounts={accounts} assets={assets} token={token} onRefresh={refresh} /></AppShell></ProtectedRoute>} /><Route path="/activity" element={<ProtectedRoute token={token} loading={loading}><AppShell {...shellProps}><Activity activity={activity} /></AppShell></ProtectedRoute>} /><Route path="/profile" element={<ProtectedRoute token={token} loading={loading}><AppShell {...shellProps}><Profile user={user} accounts={accounts} token={token} onUserChange={onUserChange} onRefresh={refresh} /></AppShell></ProtectedRoute>} /><Route path="/" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} /><Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} /></Routes></BrowserRouter>
}

export default App
