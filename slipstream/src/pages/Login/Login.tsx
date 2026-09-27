import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import PasswordInput from '../../components/PasswordInput/PasswordInput'
import AuthField from '../../components/AuthField/AuthField'
import '../auth.css'

const Login = () => {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedIdentifier = identifier.trim()
    if (!trimmedIdentifier || !password) {
      setFormError('Enter your username or email and password.')
      return
    }

    setSubmitting(true)

    try {
      // supabase-js only signs in by email, so a username identifier is first
      // resolved to its email via the narrow email_for_username() lookup
      // (profiles.email itself isn't publicly readable - see migration 08).
      let email = trimmedIdentifier
      if (!trimmedIdentifier.includes('@')) {
        const { data: resolvedEmail, error: lookupError } = await supabase.rpc('email_for_username', {
          p_username: trimmedIdentifier,
        })
        if (lookupError || !resolvedEmail) {
          setFormError('Invalid username/email or password.')
          return
        }
        email = resolvedEmail
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setFormError('Invalid username/email or password.')
        return
      }

      navigate('/')
    } catch {
      setFormError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="auth-page">
      <form id="auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Log in</h1>

        <AuthField htmlFor="identifier" label="Username or email">
          <input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
          />
        </AuthField>

        <AuthField htmlFor="password" label="Password">
          <PasswordInput
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </AuthField>

        {formError && <p className="auth-form-error">{formError}</p>}

        <button type="submit" className="button primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p id="auth-switch">
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </section>
  )
}

export default Login
