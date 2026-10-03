import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom'
import { ethers } from 'ethers'
import {
  addAssetOnBlockchain,
  linkGameAccountOnBlockchain,
  transferAccountOnBlockchain
} from './services/blockchainService'
import './App.css'

const API_URL = 'http://localhost:5000'
const GITHUB_REPOSITORY_URL = 'https://github.com/your-org/gamevault'

async function apiFetch(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
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

      if (error.status !== 404) {
        throw error
      }
    }
  }

  throw lastError
}

async function getProfile(token) {
  return apiFetch('/api/user/profile', token)
}

function getFriendlyError(error, fallback) {
  const message = error?.message || ''

  if (/user rejected|denied|cancelled/i.test(message)) {
    return 'Transaction cancelled.'
  }

  if (/not.*owner|owner.*not|unauthorized/i.test(message)) {
    return 'Connected wallet is not the current owner.'
  }

  if (/execution reverted|reverted|transaction failed/i.test(message)) {
    return fallback
  }

  return fallback
}

async function getConnectedWallet() {
  if (!window.ethereum) return ''

  const provider =
    new ethers.BrowserProvider(
      window.ethereum
    )

  const accounts = await provider.send(
    'eth_accounts',
    []
  )

  return accounts[0]
    ? ethers.getAddress(accounts[0])
    : ''
}

function Toast({ toast, onClose }) {
  if (!toast) return null

  const icon = {
    success: '✓',
    error: '!',
    warning: '⚠',
    info: 'i'
  }[toast.type] || 'i'

  return (
    <div
      className={`toast toast-${toast.type}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">{icon}</span>

      <div>{toast.message}</div>

      <button
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  )
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <span>G</span>
      </div>

      <div>
        <div className="brand-name">GAMEVAULT</div>
        <span className="brand-caption">PLAYER OWNED</span>
      </div>
    </div>
  )
}

function Sidebar({ open, onClose }) {
  const links = [
    ['⌂', 'Overview', '/dashboard'],
    ['▣', 'My Games', '/games'],
    ['◇', 'Asset Inventory', '/assets'],
    ['↗', 'Activity', '/activity'],
    ['◉', 'Profile', '/profile']
  ]

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <Brand />

      <div className="nav-label">Workspace</div>

      <nav className="nav-list">
        {links.map(([icon, label, path]) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="connection-mini">
          <span className="status-dot" />
          Local network connected
        </div>

        <div className="muted" style={{ marginTop: 8 }}>
          Live data workspace
        </div>
      </div>
    </aside>
  )
}

function Topbar({ onMenu, onLogout, user, onToast }) {
  const location = useLocation()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)

  const labels = {
    '/dashboard': 'Overview',
    '/games': 'My Games',
    '/assets': 'Asset Inventory',
    '/activity': 'Activity',
    '/profile': 'Profile'
  }

  const initials =
    user?.username?.slice(0, 2).toUpperCase() || 'GV'

  useEffect(() => {
    function closeMenu(event) {
      if (!event.target.closest('.user-menu')) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('click', closeMenu)

    return () => {
      document.removeEventListener('click', closeMenu)
    }
  }, [])

  function goTo(path) {
    setMenuOpen(false)
    navigate(path)
  }

  async function copyWallet() {
    if (!user?.walletAddress) {
      onToast('No verified wallet address to copy', 'error')
      setMenuOpen(false)
      return
    }

    try {
      await navigator.clipboard.writeText(user.walletAddress)

      onToast('Wallet address copied', 'success')
    } catch {
      onToast('Unable to copy wallet address', 'error')
    }

    setMenuOpen(false)
  }

  function logout() {
    setMenuOpen(false)
    onToast('Signed out of GameVault', 'success')
    onLogout()
  }

  return (
    <header className="topbar">
      <button
        className="mobile-menu"
        onClick={onMenu}
      >
        ☰
      </button>

      <div className="topbar-title">
        {labels[location.pathname] || 'GameVault'}
      </div>

      <div className="topbar-right">
        <div className="network">
          <span className="status-dot" />
          Hardhat Local
        </div>

        <div className="wallet-chip">
          {user?.walletAddress
            ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
            : 'Wallet not linked'}
        </div>

        <div className="user-menu">
          <button
            className={`user-trigger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(current => !current)}
            aria-expanded={menuOpen}
          >
            <span className="user-name">
              {user?.username || 'Player'}
            </span>

            <span className="avatar">
              {initials}
            </span>

            <span className="user-chevron">
              ⌄
            </span>
          </button>

          {menuOpen && (
            <div className="user-dropdown">
              <button onClick={() => goTo('/profile')}>
                <span>◉</span>
                Profile
              </button>

              <button onClick={() => goTo('/profile')}>
                <span>◎</span>
                Wallet
              </button>

              <button onClick={copyWallet}>
                <span>▣</span>
                Copy wallet address
              </button>

              <a
                href={GITHUB_REPOSITORY_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
              >
                <span>↗</span>
                GitHub
              </a>

              <div className="dropdown-divider" />

              <button
                className="danger-item"
                onClick={logout}
              >
                <span>⇥</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function AppShell({ children, onLogout, user, onToast }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="app-shell">
      <div className="shell-layout">
        <Sidebar
          open={open}
          onClose={() => setOpen(false)}
        />

        <main className="main-area">
          <Topbar
            onMenu={() => setOpen(true)}
            onLogout={onLogout}
            user={user}
            onToast={onToast}
          />

          {children}
        </main>
      </div>
    </div>
  )
}

function PageHeading({
  eyebrow,
  title,
  description,
  children
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          {eyebrow}
        </div>

        <h1>{title}</h1>

        {description && (
          <p>{description}</p>
        )}
      </div>

      {children}
    </div>
  )
}

function StatCard({
  label,
  value,
  detail
}) {
  return (
    <div className="panel stat-card">
      <span className="stat-label">
        {label}
      </span>

      <strong className="stat-value">
        {value}
      </strong>

      <span className="stat-detail">
        {detail}
      </span>
    </div>
  )
}

function StatusMessage({
  message,
  error = false
}) {
  return message ? (
    <div
      className={`feedback ${
        error ? 'feedback-error' : ''
      }`}
    >
      {message}
    </div>
  ) : null
}

function GameCard({ game, onLink }) {
  const id = game._id || game.id

  return (
    <div className="panel game-card">
      <div
        className={`game-cover ${
          game.name?.includes('Neon')
            ? 'cover-void'
            : 'cover-rift'
        }`}
      >
        <div>
          <div className="cover-title">
            {game.name?.slice(0, 2).toUpperCase()}
          </div>

          <div className="cover-subtitle">
            {game.description || 'PLAYER WORLD'}
          </div>
        </div>
      </div>

      <div className="game-content">
        <div className="game-row">
          <span className="game-name">
            {game.name}
          </span>

          <span
            className={`badge ${
              game.active === false
                ? 'badge-grey'
                : 'badge-live'
            }`}
          >
            {game.active === false
              ? 'Inactive'
              : 'Live'}
          </span>
        </div>

        <div className="game-details">
          <div>
            <span className="detail-label">
              Blockchain ID
            </span>

            <span className="detail-value">
              #{game.blockchainGameId}
            </span>
          </div>

          <div>
            <span className="detail-label">
              Developer
            </span>

            <span className="detail-value">
              {game.developerAddress
                ? `${game.developerAddress.slice(0, 6)}...${game.developerAddress.slice(-4)}`
                : 'Unknown'}
            </span>
          </div>
        </div>

        {onLink && (
          <button
            className="outline-btn card-action"
            onClick={() => onLink(game)}
          >
            Link game account
          </button>
        )}

        <div className="muted id-line">
          Mongo ID: {id}
        </div>
      </div>
    </div>
  )
}

function AssetRow({ asset, account }) {
  const owner =
    account?.ownerWallet ||
    asset.gameAccount?.ownerWallet

  const shortenedOwner = owner
    ? `${owner.slice(0, 6)}...${owner.slice(-4)}`
    : 'Owner unavailable'

  return (
    <div className="panel asset-card">
      <div className="asset-row">
        <div className="asset-icon">
          ◇
        </div>

        <div className="asset-info">
          <div className="asset-name">
            {asset.name}
          </div>

          <div className="asset-sub">
            Account #{account?.blockchainAccountId || '—'} ·{' '}
            {asset.game?.name || 'Linked game'}
          </div>

          <div className="asset-sub">
            Owner: {shortenedOwner}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="quantity">
            x{asset.quantity}
          </div>

          <div className="asset-sub">
            On-chain
          </div>
        </div>
      </div>
    </div>
  )
}

function shortAddress(address) {
  if (!address) return 'Unknown'

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatActivityTime(value) {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : date.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
}

function ActivityList({ items }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <strong>No recent activity</strong>
        <span>
          Your confirmed blockchain actions will appear here.
        </span>
      </div>
    )
  }

  return (
    <div className="activity-list">
      {items.map((item, index) => (
        <div
          className="activity-item"
          key={`${item.title}-${index}`}
        >
          {index < items.length - 1 && (
            <div className="activity-line" />
          )}

          <div className="activity-icon">
            {item.icon}
          </div>

          <div className="activity-copy">
            <div className="activity-main">
              <strong>{item.title}</strong>
              <br />
              {item.detail}
            </div>

            <div className="activity-time">
              {formatActivityTime(item.time)}

              <span className="activity-status">
                {' '}
                · Confirmed
              </span>
            </div>

            {item.type === 'transfer' && (
              <>
                <div className="activity-time">
                  {shortAddress(item.previousOwner)}
                  {' → '}
                  {shortAddress(item.newOwner)}
                </div>

                <div className="activity-time">
                  Tx: {shortAddress(item.blockchainId)}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function WalletPanel({
  user,
  token,
  onUserChange,
  onToast
}) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState('')

  async function connectAndVerify() {
    setBusy(true)
    setStatus('')
    setError(false)

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed')
      }

      const provider =
        new ethers.BrowserProvider(window.ethereum)

      const accounts =
        await provider.send(
          'eth_requestAccounts',
          []
        )

      const address = accounts[0]

      if (!address) {
        throw new Error(
          'No MetaMask account selected'
        )
      }

      setConnected(address)

      const challenge = await apiFetch(
        '/api/user/wallet/challenge',
        token,
        {
          method: 'POST'
        }
      )

      const signer =
        await provider.getSigner()

      const signature =
        await signer.signMessage(
          challenge.challenge
        )

      const result = await apiFetch(
        '/api/user/wallet/verify',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            walletAddress: address,
            signature
          })
        }
      )

      onUserChange({
        ...user,
        walletAddress: result.walletAddress
      })

      setStatus(
        'Wallet verified successfully'
      )

      onToast(
        'Wallet verification successful',
        'success'
      )
    } catch (err) {
      const message = getFriendlyError(
        err,
        'Wallet verification failed.'
      )

      setError(true)
      setStatus(message)

      onToast(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel panel-pad wallet-panel">
      <div className="section-title">
        <h2>Wallet identity</h2>

        <span
          className={`badge ${
            user?.walletAddress
              ? 'badge-live'
              : 'badge-grey'
          }`}
        >
          {user?.walletAddress
            ? 'Verified'
            : 'Not linked'}
        </span>
      </div>

      <div className="wallet-box">
        <span className="wallet-address">
          {user?.walletAddress ||
            connected ||
            'Connect MetaMask to verify ownership'}
        </span>

        <span style={{ color: 'var(--teal)' }}>
          {user?.walletAddress ? '✓' : '○'}
        </span>
      </div>

      <button
        className="primary-btn"
        onClick={connectAndVerify}
        disabled={busy}
      >
        {busy
          ? 'Verifying wallet...'
          : user?.walletAddress
            ? 'Re-verify wallet'
            : 'Connect & verify wallet'}
      </button>

      <StatusMessage
        message={status}
        error={error}
      />
    </section>
  )
}

function Dashboard({
  user,
  games,
  accounts,
  assets,
  activity,
  onWalletChange,
  token,
  error,
  onToast
}) {
  const registeredGames = new Map(
    games.map(game => [
      String(game._id),
      game
    ])
  )

  const linkedGames = Array.from(
    new Map(
      accounts
        .filter(account => account.game)
        .map(account => {
          const game = account.game
          const key = String(
            game._id || game
          )

          return [
            key,
            registeredGames.get(key) || game
          ]
        })
    ).values()
  )

  return (
    <div className="page">
      <PageHeading
        eyebrow="Player command center"
        title={`Welcome back, ${
          user?.username || 'player'
        }.`}
        description="Your gaming identity, accounts, and assets in one place."
      />

      <StatusMessage
        message={error}
        error
      />

      <div className="grid stats-grid">
        <StatCard
          label="Linked games"
          value={String(linkedGames.length).padStart(2, '0')}
          detail={
            linkedGames.length
              ? 'Linked game accounts'
              : 'No games linked'
          }
        />

        <StatCard
          label="Game accounts"
          value={String(accounts.length).padStart(2, '0')}
          detail={
            accounts.length
              ? 'MongoDB records'
              : 'No accounts linked'
          }
        />

        <StatCard
          label="Owned assets"
          value={String(assets.length).padStart(2, '0')}
          detail={
            assets.length
              ? 'Verified inventory'
              : 'No assets found'
          }
        />

        <StatCard
          label="Wallet status"
          value={
            user?.walletAddress
              ? 'ON'
              : 'OFF'
          }
          detail={
            user?.walletAddress
              ? 'Verified owner'
              : 'Connect wallet'
          }
        />
      </div>

      <div className="grid dashboard-grid">
        <section>
          <div className="section-title">
            <h2>Identity</h2>

            <NavLink to="/profile">
              View profile →
            </NavLink>
          </div>

          <div className="profile-panel panel">
            <div className="profile-avatar">
              {user?.username
                ?.slice(0, 2)
                .toUpperCase() || 'GV'}
            </div>

            <div>
              <div className="profile-name">
                {user?.username || 'Player'}
              </div>

              <div className="profile-meta">
                {user?.email ||
                  'Account email unavailable'}
              </div>
            </div>

            <span className="profile-badge">
              {user?.walletAddress
                ? 'Verified owner'
                : 'Wallet pending'}
            </span>
          </div>

          <div className="section-title">
            <h2>Linked games</h2>

            <NavLink to="/games">
              View all →
            </NavLink>
          </div>

          {linkedGames.length ? (
            <div className="grid game-grid">
              {linkedGames.slice(0, 2).map(game => (
                <GameCard
                  key={game._id}
                  game={game}
                />
              ))}
            </div>
          ) : (
            <div className="panel empty-state">
              No game accounts linked yet.
            </div>
          )}
        </section>

        <section>
          <div className="section-title">
            <h2>Recent activity</h2>

            <NavLink to="/activity">
              View all →
            </NavLink>
          </div>

          <div className="panel panel-pad">
            <ActivityList
              items={activity.slice(0, 4)}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <WalletPanel
              user={user}
              token={token}
              onUserChange={onWalletChange}
              onToast={onToast}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function AuthForm({
  mode,
  onAuthenticated
}) {
  const navigate = useNavigate()

  const isRegister =
    mode === 'register'

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function update(field, value) {
    setForm(current => ({
      ...current,
      [field]: value
    }))
  }

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    setBusy(true)

    try {
      if (
        isRegister &&
        form.password !== form.confirmPassword
      ) {
        throw new Error(
          'Passwords do not match'
        )
      }

      const paths = isRegister
        ? [
            '/api/user/register',
            '/api/auth/register'
          ]
        : [
            '/api/user/login',
            '/api/auth/login'
          ]

      const body = isRegister
        ? {
            username: form.username,
            email: form.email,
            password: form.password
          }
        : {
            email: form.email,
            password: form.password
          }

      const data =
        await apiFetchWithFallback(
          paths,
          '',
          {
            method: 'POST',
            body: JSON.stringify(body)
          }
        )

      if (isRegister) {
        setMessage(
          'Account created. You can sign in now.'
        )

        navigate('/login')
      } else {
        localStorage.setItem(
          'token',
          data.token
        )

        onAuthenticated(data.user)

        navigate('/dashboard')
      }
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-art">
        <Brand />

        <div className="login-copy">
          <div className="eyebrow">
            {isRegister
              ? 'Build your player identity'
              : 'Your identity. Your inventory.'}
          </div>

          <h1>
            {isRegister ? (
              <>
                Keep your
                <br />
                <span style={{ color: 'var(--teal)' }}>
                  progress.
                </span>
              </>
            ) : (
              <>
                Own your
                <br />
                <span style={{ color: 'var(--teal)' }}>
                  game.
                </span>
              </>
            )}
          </h1>

          <p>
            GameVault brings your gaming identities,
            accounts, and digital assets together
            in one player-owned layer.
          </p>

          <div className="login-points">
            <div className="login-point">
              <span>✦</span>
              One identity across every world
            </div>

            <div className="login-point">
              <span>◇</span>
              Transparent, verifiable ownership
            </div>

            <div className="login-point">
              <span>↗</span>
              Verifiable ownership records
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-area">
        <div className="login-card">
          <div className="eyebrow">
            {isRegister
              ? 'Start your vault'
              : 'Welcome back'}
          </div>

          <h2>
            {isRegister
              ? 'Create your account'
              : 'Enter the vault'}
          </h2>

          <p>
            {isRegister
              ? 'Set up your player profile in a few seconds.'
              : 'Sign in to access your player-owned dashboard.'}
          </p>

          <form
            className="login-form"
            onSubmit={submit}
          >
            {isRegister && (
              <label>
                Username

                <input
                  type="text"
                  value={form.username}
                  onChange={event =>
                    update(
                      'username',
                      event.target.value
                    )
                  }
                  placeholder="player_name"
                  required
                />
              </label>
            )}

            <label>
              Email

              <input
                type="email"
                value={form.email}
                onChange={event =>
                  update(
                    'email',
                    event.target.value
                  )
                }
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              Password

              <input
                type="password"
                value={form.password}
                onChange={event =>
                  update(
                    'password',
                    event.target.value
                  )
                }
                placeholder="••••••••"
                required
              />
            </label>

            {isRegister && (
              <label>
                Confirm password

                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={event =>
                    update(
                      'confirmPassword',
                      event.target.value
                    )
                  }
                  placeholder="••••••••"
                  required
                />
              </label>
            )}

            {message && (
              <StatusMessage
                message={message}
                error={
                  !isRegister ||
                  message.includes('match')
                }
              />
            )}

            <button
              className="primary-btn"
              type="submit"
              disabled={busy}
            >
              {busy
                ? 'Please wait...'
                : isRegister
                  ? 'Create GameVault account →'
                  : 'Sign in to GameVault →'}
            </button>
          </form>

          <div className="auth-switch">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <NavLink to="/login">
                  Sign in
                </NavLink>
              </>
            ) : (
              <>
                New to GameVault?{' '}
                <NavLink to="/register">
                  Create an account
                </NavLink>
              </>
            )}
          </div>

          <div className="demo-note">
            Live backend · No demo session
          </div>
        </div>
      </div>
    </div>
  )
}

function Games({
  games,
  token,
  onRefresh,
  onToast
}) {
  const [selected, setSelected] =
    useState(null)

  const [externalAccountId, setExternalAccountId] =
    useState('')

  const [message, setMessage] =
    useState('')

  const [busy, setBusy] =
    useState(false)

  async function linkAccount(event) {
    event.preventDefault()

    setBusy(true)
    setMessage('')

    try {
      if (!window.ethereum) {
        throw new Error(
          'MetaMask is not installed'
        )
      }

      const provider =
        new ethers.BrowserProvider(
          window.ethereum
        )

      const walletAccounts =
        await provider.send(
          'eth_requestAccounts',
          []
        )

      const player =
        walletAccounts[0]

      if (!player) {
        throw new Error(
          'No connected MetaMask wallet found'
        )
      }

      const result =
        await linkGameAccountOnBlockchain(
          selected.blockchainGameId,
          externalAccountId,
          player
        )

      const data = await apiFetch(
        '/api/game-accounts',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            gameId: selected._id,
            externalAccountId,
            ownerWallet: player,
            transactionHash:
              result.transactionHash
          })
        }
      )

      setMessage(
        `Game account linked: #${data.gameAccount.blockchainAccountId}`
      )

      onToast(
        'Game account linked successfully',
        'success'
      )

      setExternalAccountId('')

      onRefresh()
    } catch (err) {
      const message = getFriendlyError(
        err,
        'Game account linking failed.'
      )

      setMessage(message)
      onToast(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeading
        eyebrow="Your collection"
        title="My games"
        description="Connected titles and the identities you carry between them."
      />

      <div className="grid game-grid">
        {games.map(game => (
          <GameCard
            key={game._id}
            game={game}
            onLink={setSelected}
          />
        ))}
      </div>

      {!games.length && (
        <div className="panel empty-state">
          No games returned by the backend.
        </div>
      )}

      {selected && (
        <div className="modal-backdrop">
          <form
            className="modal-card panel"
            onSubmit={linkAccount}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() =>
                setSelected(null)
              }
            >
              ×
            </button>

            <div className="eyebrow">
              Link account
            </div>

            <h2>{selected.name}</h2>

            <p className="muted">
              This action requires the verified
              developer wallet and a confirmed
              blockchain transaction.
            </p>

            <label>
              External account ID

              <input
                className="filter-input form-input"
                value={externalAccountId}
                onChange={event =>
                  setExternalAccountId(
                    event.target.value
                  )
                }
                placeholder="player-001"
                required
              />
            </label>

            <button
              className="primary-btn"
              type="submit"
              disabled={busy}
            >
              {busy
                ? 'Waiting for transaction...'
                : 'Link on blockchain'}
            </button>

            <StatusMessage
              message={message}
              error={
                message &&
                !message.includes('linked:')
              }
            />
          </form>
        </div>
      )}
    </div>
  )
}

function Assets({
  accounts,
  assets,
  token,
  onRefresh,
  onToast
}) {
  const [selectedAccount, setSelectedAccount] =
    useState('')

  const [name, setName] =
    useState('')

  const [quantity, setQuantity] =
    useState(1)

  const [message, setMessage] =
    useState('')

  const [busy, setBusy] =
    useState(false)

  async function createAsset(event) {
    event.preventDefault()

    setBusy(true)
    setMessage('')

    try {
      const account =
        accounts.find(
          item =>
            item._id === selectedAccount
        )

      if (!account) {
        throw new Error(
          'Select a game account first'
        )
      }

      const result =
        await addAssetOnBlockchain(
          account.blockchainAccountId,
          name,
          Number(quantity)
        )

      const data = await apiFetch(
        '/api/assets',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            gameId:
              account.game?._id ||
              account.game,
            gameAccountId:
              account._id,
            name,
            quantity:
              Number(quantity),
            transactionHash:
              result.transactionHash
          })
        }
      )

      setMessage(
        `Asset created: #${data.asset.blockchainAssetId}`
      )

      onToast(
        'Asset created successfully',
        'success'
      )

      setName('')
      setQuantity(1)

      onRefresh()
    } catch (err) {
      const message = getFriendlyError(
        err,
        'Asset creation failed.'
      )

      setMessage(message)
      onToast(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeading
        eyebrow="Portable inventory"
        title="Asset inventory"
        description="Verified items held across your linked game accounts."
      />

      <div className="inventory-layout">
        <section>
          <div className="section-title">
            <h2>Owned assets</h2>
          </div>

          {assets.length ? (
            <div className="asset-list">
              {assets.map(asset => {
                const assetGameAccountId =
                  typeof asset.gameAccount === 'object'
                    ? asset.gameAccount?._id
                    : asset.gameAccount

                const account = accounts.find(
                  item =>
                    String(item._id) ===
                    String(assetGameAccountId)
                )

                return (
                  <AssetRow
                    key={asset._id}
                    asset={asset}
                    account={account}
                  />
                )
              })}
            </div>
          ) : (
            <div className="panel empty-state">
              No assets found for your loaded
              game accounts.
            </div>
          )}
        </section>

        <form
          className="panel panel-pad action-panel"
          onSubmit={createAsset}
        >
          <div className="eyebrow">
            Blockchain action
          </div>

          <h2>Add asset</h2>

          <p className="muted">
            Create on-chain first, then persist
            the verified event.
          </p>

          <label>
            Game account

            <select
              className="filter-input form-input"
              value={selectedAccount}
              onChange={event =>
                setSelectedAccount(
                  event.target.value
                )
              }
              required
            >
              <option value="">
                Select account
              </option>

              {accounts.map(account => (
                <option
                  key={account._id}
                  value={account._id}
                >
                  {account.game?.name ||
                    'Game account'}{' '}
                  · #
                  {account.blockchainAccountId}
                </option>
              ))}
            </select>
          </label>

          <label>
            Asset name

            <input
              className="filter-input form-input"
              value={name}
              onChange={event =>
                setName(event.target.value)
              }
              placeholder="Shield of Valor"
              required
            />
          </label>

          <label>
            Quantity

            <input
              className="filter-input form-input"
              type="number"
              min="1"
              value={quantity}
              onChange={event =>
                setQuantity(
                  event.target.value
                )
              }
              required
            />
          </label>

          <button
            className="primary-btn"
            type="submit"
            disabled={busy}
          >
            {busy
              ? 'Confirming...'
              : 'Add asset'}
          </button>

          <StatusMessage
            message={message}
            error={
              message &&
              !message.startsWith(
                'Asset created'
              )
            }
          />
        </form>
      </div>
    </div>
  )
}

function TransferPanel({
  accounts,
  token,
  onRefresh,
  onToast
}) {
  const [selectedAccount, setSelectedAccount] =
    useState('')

  const [currentOwner, setCurrentOwner] =
    useState('')

  const [connectedWallet, setConnectedWallet] =
    useState('')

  const [ownerLoading, setOwnerLoading] =
    useState(false)

  const [newOwner, setNewOwner] =
    useState('')

  const [message, setMessage] =
    useState('')

  const [busy, setBusy] =
    useState(false)

  const [transferStage, setTransferStage] =
    useState('idle')

  const ownershipVerified = Boolean(
    currentOwner &&
    connectedWallet &&
    currentOwner === connectedWallet
  )

  useEffect(() => {
    const ethereum = window.ethereum

    if (!ethereum) {
      return undefined
    }

    function updateConnectedWallet(accounts) {
      try {
        setConnectedWallet(
          accounts?.[0]
            ? ethers.getAddress(accounts[0])
            : ''
        )
      } catch {
        setConnectedWallet('')
      }
    }

    getConnectedWallet()
      .then(address =>
        updateConnectedWallet(
          address ? [address] : []
        )
      )
      .catch(() => setConnectedWallet(''))

    ethereum.on(
      'accountsChanged',
      updateConnectedWallet
    )

    return () => {
      ethereum.removeListener(
        'accountsChanged',
        updateConnectedWallet
      )
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (!cancelled) {
        setCurrentOwner('')
        setMessage('')
      }
    })

    if (!selectedAccount) {
      queueMicrotask(() => {
        if (!cancelled) {
          setOwnerLoading(false)
        }
      })
      return () => {
        cancelled = true
      }
    }

    const account = accounts.find(
      item => item._id === selectedAccount
    )

    if (!account) {
      queueMicrotask(() => {
        if (!cancelled) {
          setOwnerLoading(false)
        }
      })
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setOwnerLoading(true)
      }
    })

    getConnectedWallet()
      .then(address => {
        if (!cancelled) {
          setConnectedWallet(address)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnectedWallet('')
        }
      })

    apiFetch(
      `/api/game-accounts/blockchain-owner/${account.blockchainAccountId}`,
      token
    )
      .then(data => {
        if (!cancelled) {
          setCurrentOwner(
            ethers.getAddress(data.ownerWallet)
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentOwner('')
          setMessage(
            'Unable to verify the current blockchain owner.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOwnerLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedAccount, accounts, token])

  async function transfer(event) {
    event.preventDefault()

    setBusy(true)
    setTransferStage('confirming')
    setMessage('')

    try {
      const account =
        accounts.find(
          item =>
            item._id === selectedAccount
        )

      if (!account) {
        throw new Error(
          'Select a game account first'
        )
      }

      if (!ownershipVerified) {
        throw new Error(
          'Connected wallet is not the current blockchain owner. Switch MetaMask to the current owner before transferring.'
        )
      }

      if (!newOwner) {
        throw new Error(
          'New owner wallet is required'
        )
      }

      const result =
        await transferAccountOnBlockchain(
          account.blockchainAccountId,
          newOwner
        )

      setTransferStage('syncing')

      await apiFetch(
        '/api/game-accounts/transfer/confirm',
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            transactionHash: result,
            gameAccountId:
              account._id,
            accountId:
              account.blockchainAccountId,
            newOwner
          })
        }
      )

      setMessage(
        'Account ownership transferred and synchronized successfully'
      )

      onToast(
        'Transaction confirmed and ownership synchronized',
        'success'
      )

      setNewOwner('')

      onRefresh()
    } catch (err) {
      const message = getFriendlyError(
        err,
        'Transfer failed. Make sure you are connected with the current account owner.'
      )

      setMessage(message)
      onToast(message, 'error')
    } finally {
      setBusy(false)
      setTransferStage('idle')
    }
  }

  return (
    <form
      className="panel panel-pad action-panel"
      onSubmit={transfer}
    >
      <div className="eyebrow">
        Ownership transfer
      </div>

      <h2>Transfer account ownership</h2>

      <p className="muted">
        Confirm the wallet transfer on-chain
        before syncing MongoDB.
      </p>

      <label>
        Game account

        <select
          className="filter-input form-input"
          value={selectedAccount}
          onChange={event =>
            setSelectedAccount(
              event.target.value
            )
          }
          required
        >
          <option value="">
            Select account
          </option>

          {accounts.map(account => (
            <option
              key={account._id}
              value={account._id}
            >
              {account.game?.name ||
                'Game account'}{' '}
              · #
              {account.blockchainAccountId}
            </option>
          ))}
        </select>
      </label>

      <div className="verification-box">
        <div className="verification-heading">
          Ownership verification
        </div>

        <div>
          <div className="verification-label">
            Current blockchain owner
          </div>

          <strong
            className="wallet-address"
            title={currentOwner || undefined}
          >
            {ownerLoading
              ? 'Checking blockchain ownership...'
              : currentOwner
                ? shortAddress(currentOwner)
                : 'Unavailable'}
          </strong>
        </div>

        <div>
          <div className="verification-label">
            Connected wallet
          </div>

          <strong
            className="wallet-address"
            title={connectedWallet || undefined}
          >
            {connectedWallet
              ? shortAddress(connectedWallet)
              : 'Unavailable'}
          </strong>
        </div>
      </div>

      {ownerLoading && (
        <div className="feedback feedback-info">
          Checking blockchain ownership...
        </div>
      )}

      {currentOwner && connectedWallet && (
        <StatusMessage
          message={
            ownershipVerified
              ? '✓ Wallet verified. Connected wallet is the current owner.'
              : '⚠ Wallet mismatch. The connected wallet is not the current blockchain owner.'
          }
          error={!ownershipVerified}
        />
      )}

      <label>
        New owner wallet

        <input
          className="filter-input form-input"
          value={newOwner}
          onChange={event =>
            setNewOwner(
              event.target.value
            )
          }
          placeholder="0x..."
          required
        />
      </label>

      <button
        className="primary-btn"
        type="submit"
        disabled={
          busy ||
          !selectedAccount ||
          ownerLoading ||
          !currentOwner ||
          !connectedWallet ||
          !ownershipVerified ||
          !newOwner
        }
      >
        {transferStage === 'syncing'
          ? 'Synchronizing ownership...'
          : transferStage === 'confirming'
            ? 'Confirming transaction...'
            : ownerLoading
              ? 'Verifying owner...'
              : 'Transfer ownership'}
      </button>

      <StatusMessage
        message={message}
        error={
          message &&
          !message.includes('synchronized')
        }
      />
    </form>
  )
}

function Activity({ activity }) {
  return (
    <div className="page">
      <PageHeading
        eyebrow="Proof of ownership"
        title="Activity"
        description="A transparent record of confirmed actions from this session."
      />

      <div className="panel panel-pad">
        <ActivityList
          items={activity}
        />
      </div>
    </div>
  )
}

function Profile({
  user,
  accounts,
  token,
  onUserChange,
  onRefresh,
  onToast
}) {
  return (
    <div className="page">
      <PageHeading
        eyebrow="Identity settings"
        title="Profile"
        description="Your live account and verified wallet information."
      />

      <div className="grid profile-grid">
        <section className="panel panel-pad">
          <div className="profile-header">
            <div className="profile-big-avatar">
              {user?.username
                ?.slice(0, 2)
                .toUpperCase() || 'GV'}
            </div>

            <div>
              <div className="profile-title">
                {user?.username ||
                  'Player'}
              </div>

              <div className="profile-meta">
                {user?.email ||
                  'Email unavailable'}
              </div>
            </div>
          </div>

          <div className="profile-fields">
            <div>
              <span className="field-label">
                Username
              </span>

              <span className="field-value">
                {user?.username || '—'}
              </span>
            </div>

            <div>
              <span className="field-label">
                Email
              </span>

              <span className="field-value">
                {user?.email || '—'}
              </span>
            </div>

            <div>
              <span className="field-label">
                User ID
              </span>

              <span className="field-value">
                {user?.id ||
                  user?._id ||
                  '—'}
              </span>
            </div>

            <div>
              <span className="field-label">
                Wallet
              </span>

              <span className="field-value">
                {user?.walletAddress
                  ? 'Verified'
                  : 'Not linked'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="section-title">
              <h2>Linked games</h2>

              <span className="badge badge-live">
                {accounts.length}
              </span>
            </div>

            {accounts.length ? (
              <div
                style={{
                  display: 'grid',
                  gap: 12
                }}
              >
                {accounts.map(account => (
                  <div
                    key={account._id}
                    style={{
                      borderTop:
                        '1px solid var(--line)',
                      paddingTop: 12
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent:
                          'space-between',
                        gap: 12,
                        alignItems: 'center'
                      }}
                    >
                      <strong>
                        {account.game?.name ||
                          'Game'}
                      </strong>

                      <span className="badge badge-live">
                        Verified
                      </span>
                    </div>

                    <div className="profile-meta">
                      Account ID:{' '}
                      {account.externalAccountId}
                    </div>

                    <div className="profile-meta">
                      Blockchain account: #
                      {account.blockchainAccountId}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="profile-meta">
                No game accounts linked yet.
              </div>
            )}
          </div>
        </section>

        <div className="profile-actions">
          <WalletPanel
            user={user}
            token={token}
            onUserChange={onUserChange}
            onToast={onToast}
          />

          <TransferPanel
            accounts={accounts}
            token={token}
            onRefresh={onRefresh}
            onToast={onToast}
          />
        </div>
      </div>
    </div>
  )
}

function ProtectedRoute({
  children,
  token,
  loading
}) {
  if (loading) {
    return (
      <div className="loading-page">
        Loading your GameVault...
      </div>
    )
  }

  return token
    ? children
    : <Navigate to="/login" replace />
}

function PublicRoute({
  children,
  token
}) {
  return token
    ? <Navigate to="/dashboard" replace />
    : children
}

function App() {
  const [token, setToken] =
    useState(() =>
      localStorage.getItem('token')
    )

  const [user, setUser] =
    useState(null)

  const [games, setGames] =
    useState([])

  const [accounts, setAccounts] =
    useState([])

  const [assets, setAssets] =
    useState([])

  const [activity, setActivity] =
    useState([])

  const [loading, setLoading] =
    useState(Boolean(token))

  const [loadError, setLoadError] =
    useState('')

  const [toast, setToast] =
    useState(null)

  const toastTimer = useRef(null)

  const logout = useCallback(() => {
    localStorage.removeItem('token')

    setToken(null)
    setUser(null)
    setGames([])
    setAccounts([])
    setAssets([])
    setActivity([])
  }, [])

  const loadWorkspace = useCallback(async function loadWorkspace(
    activeToken = token
  ) {
    if (!activeToken) return

    setLoading(true)
    setLoadError('')

    try {
      const profile =
        await getProfile(activeToken)

      const [
        gamesData,
        accountsData
      ] = await Promise.all([
        apiFetch(
          '/api/games',
          activeToken
        ),

        apiFetch(
          '/api/game-accounts',
          activeToken
        )
      ])

      const gameAccounts =
        accountsData.gameAccounts || []

      const assetResults =
        await Promise.all(
          gameAccounts.map(
            account =>
              apiFetch(
                `/api/assets/account/${account._id}`,
                activeToken
              ).catch(() => ({
                assets: []
              }))
          )
        )

      const loadedAssets =
        assetResults.flatMap(
          result => result.assets || []
        )

      const accountActivity =
        gameAccounts.map(account => ({
          id: `account-${account._id}`,
          type: 'account',
          title: 'Game account linked',
          detail: `${account.game?.name || 'Game'} · ${account.externalAccountId}`,
          time: account.createdAt,
          blockchainId: account.blockchainAccountId
        }))

      const assetActivity =
        loadedAssets.map(asset => ({
          id: `asset-${asset._id}`,
          type: 'asset',
          title: 'Asset created',
          detail: `${asset.name} × ${asset.quantity}`,
          time: asset.createdAt,
          blockchainId: asset.blockchainAssetId
        }))

      const transferActivity =
        gameAccounts.flatMap(account =>
          (account.transferHistory || []).map(
            transfer => ({
              id: `transfer-${account._id}-${transfer.transactionHash}`,
              type: 'transfer',
              title: 'Ownership transferred',
              detail: `${account.game?.name || 'Game'} · #${account.blockchainAccountId}`,
              time: transfer.createdAt,
              blockchainId: transfer.transactionHash,
              previousOwner: transfer.previousOwner,
              newOwner: transfer.newOwner
            })
          )
        )

      const recentActivity = Array.from(
        new Map(
			[...accountActivity, ...assetActivity, ...transferActivity]
            .filter(item => {
              const timestamp =
                new Date(item.time).getTime()

              return (
                item.time &&
                !Number.isNaN(timestamp)
              )
            })
            .sort(
              (left, right) =>
                new Date(right.time).getTime() -
                new Date(left.time).getTime()
            )
            .map(item => [item.id, item])
        ).values()
      )

      setUser(current => ({
        ...current,
        ...profile,
        id:
          profile.userId ||
          profile.id ||
          current?.id
      }))

      setGames(
        gamesData.games || []
      )

      setAccounts(gameAccounts)

      setAssets(loadedAssets)
      setActivity(recentActivity)
    } catch (err) {
      setLoadError(
        getFriendlyError(
          err,
          'Unable to load your dashboard.'
        )
      )

      if (err.status === 401) {
        logout()
      }
    } finally {
      setLoading(false)
    }
  }, [logout, token])

  useEffect(() => {
    if (token) {
      queueMicrotask(() =>
        loadWorkspace(token)
      )
    }
  }, [loadWorkspace, token])

  function onAuthenticated(loginUser) {
    setUser(loginUser)
    setToken(
      localStorage.getItem('token')
    )
  }

  function onUserChange(updatedUser) {
    setUser(current => ({
      ...current,
      ...updatedUser
    }))
  }

  function refresh() {
    loadWorkspace(token)
  }

  function showToast(
    message,
    type = 'success'
  ) {
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current)
    }

    setToast({
      message,
      type
    })

    const duration =
      type === 'error'
        ? 6500
        : type === 'warning'
          ? 5600
          : 4200

    toastTimer.current = window.setTimeout(
      () => setToast(null),
      duration
    )
  }

  const shellProps = {
    onLogout: logout,
    user,
    onToast: showToast
  }

  return (
    <BrowserRouter>
      <Toast
        toast={toast}
        onClose={() =>
          setToast(null)
        }
      />

      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute token={token}>
              <AuthForm
                mode="login"
                onAuthenticated={
                  onAuthenticated
                }
              />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute token={token}>
              <AuthForm
                mode="register"
                onAuthenticated={
                  onAuthenticated
                }
              />
            </PublicRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              token={token}
              loading={loading}
            >
              <AppShell {...shellProps}>
                <Dashboard
                  user={user}
                  games={games}
                  accounts={accounts}
                  assets={assets}
                  activity={activity}
                  onWalletChange={
                    onUserChange
                  }
                  token={token}
                  error={loadError}
                  onToast={showToast}
                />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/games"
          element={
            <ProtectedRoute
              token={token}
              loading={loading}
            >
              <AppShell {...shellProps}>
                <Games
                  games={games}
                  token={token}
                  onRefresh={refresh}
                  onToast={showToast}
                />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/assets"
          element={
            <ProtectedRoute
              token={token}
              loading={loading}
            >
              <AppShell {...shellProps}>
                <Assets
                  accounts={accounts}
                  assets={assets}
                  token={token}
                  onRefresh={refresh}
                  onToast={showToast}
                />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/activity"
          element={
            <ProtectedRoute
              token={token}
              loading={loading}
            >
              <AppShell {...shellProps}>
                <Activity
                  activity={activity}
                />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute
              token={token}
              loading={loading}
            >
              <AppShell {...shellProps}>
                <Profile
                  user={user}
                  accounts={accounts}
                  token={token}
                  onUserChange={
                    onUserChange
                  }
                  onRefresh={refresh}
                  onToast={showToast}
                />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <Navigate
              to={
                token
                  ? '/dashboard'
                  : '/login'
              }
              replace
            />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to={
                token
                  ? '/dashboard'
                  : '/login'
              }
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App