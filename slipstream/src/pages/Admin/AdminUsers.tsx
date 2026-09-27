import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { searchAdminUsers, setUserBlocked } from '../../lib/admin'
import type { AdminUserRow } from '../../lib/admin'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import { formatFullName } from '../../lib/formatName'
import './Admin.css'

const adminTabClass = ({ isActive }: { isActive: boolean }) => isActive ? 'active' : undefined

const AdminUsers = () => {
  const { profile } = useAuth()
  const [term, setTerm] = useState('')
  const [users, setUsers] = useState<AdminUserRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [blockTarget, setBlockTarget] = useState<AdminUserRow | null>(null)
  const [blocking, setBlocking] = useState(false)
  const [blockError, setBlockError] = useState<string | null>(null)
  const [pendingUnblockId, setPendingUnblockId] = useState<string | null>(null)
  const [unblockError, setUnblockError] = useState<string | null>(null)

  const runSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setUnblockError(null)
    const result = await searchAdminUsers(term)
    setUsers(result)
    setLoading(false)
  }

  const applyBlocked = (userId: string, blocked: boolean) => {
    setUsers((current) => current?.map((user) => (user.id === userId ? { ...user, isBlocked: blocked } : user)) ?? current)
  }

  const confirmBlock = async () => {
    if (!blockTarget) return
    setBlocking(true)
    setBlockError(null)

    const { error } = await setUserBlocked(blockTarget.id, true)
    setBlocking(false)

    if (error) {
      setBlockError(error.message)
      return
    }

    applyBlocked(blockTarget.id, true)
    setBlockTarget(null)
  }

  const handleUnblock = async (user: AdminUserRow) => {
    setPendingUnblockId(user.id)
    setUnblockError(null)
    const { error } = await setUserBlocked(user.id, false)
    setPendingUnblockId(null)

    if (error) {
      setUnblockError(`Couldn't unblock ${user.username}: ${error.message}`)
      return
    }

    applyBlocked(user.id, false)
  }

  return (
    <section id="admin-page">
      <h1>Admin</h1>
      <nav id="admin-tabs">
        <NavLink to="/admin/users" className={adminTabClass}>
          Users
        </NavLink>
        <NavLink to="/admin/posts" className={adminTabClass}>
          Posts
        </NavLink>
      </nav>

      <form id="admin-user-search" onSubmit={(event) => void runSearch(event)}>
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search by username, email, or name"
          aria-label="Search users"
        />
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {unblockError && <p className="auth-form-error">{unblockError}</p>}

      {users === null ? (
        <p>Type a username, email, or name above to find a user.</p>
      ) : loading ? (
        <p>Loading…</p>
      ) : users.length === 0 ? (
        <p>No users match that search.</p>
      ) : (
        <ul id="admin-user-list">
          {users.map((user) => (
            <li key={user.id} className="admin-user-row">
              <div className="admin-user-identity">
                <Link to={`/users/${user.username}`} className="admin-user-username">
                  {user.username}
                </Link>
                <span className="admin-user-meta">
                  {formatFullName(user.firstName, user.lastName)} · {user.email}
                </span>
              </div>
              {user.isBlocked && <span className="admin-status-pill">Blocked</span>}
              {user.isBlocked ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => void handleUnblock(user)}
                  disabled={pendingUnblockId === user.id}
                >
                  {pendingUnblockId === user.id ? 'Unblocking…' : 'Unblock'}
                </button>
              ) : (
                <button
                  type="button"
                  className="button danger"
                  onClick={() => setBlockTarget(user)}
                  disabled={user.id === profile?.id}
                  title={user.id === profile?.id ? "You can't block your own account" : undefined}
                >
                  Block
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {blockTarget && (
        <ConfirmDialog
          title="Block user"
          message={`Block ${blockTarget.username}? They won't be able to create posts or comments until unblocked.`}
          confirmLabel="Block"
          danger
          confirming={blocking}
          error={blockError}
          onConfirm={() => void confirmBlock()}
          onCancel={() => {
            setBlockTarget(null)
            setBlockError(null)
          }}
        />
      )}
    </section>
  )
}

export default AdminUsers
