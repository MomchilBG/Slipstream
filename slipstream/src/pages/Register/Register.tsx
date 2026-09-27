import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import PasswordInput from '../../components/PasswordInput/PasswordInput'
import AuthField from '../../components/AuthField/AuthField'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import '../auth.css'

interface FormValues {
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
  confirmPassword: string
}

type FormErrors = Partial<Record<keyof FormValues, string>>
type Touched = Partial<Record<keyof FormValues, boolean>>

const NAME_PATTERN = /^.{4,32}$/
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Only the checks that don't need a round-trip to the database - those run
// live as the user types/blurs. Username availability still has to be
// checked against Supabase at submit time.
const validate = (values: FormValues): FormErrors => {
  const errors: FormErrors = {}

  if (!NAME_PATTERN.test(values.firstName.trim())) {
    errors.firstName = 'First name must be 4-32 characters.'
  }
  if (values.lastName.trim() && !NAME_PATTERN.test(values.lastName.trim())) {
    errors.lastName = 'Last name must be 4-32 characters.'
  }
  if (!USERNAME_PATTERN.test(values.username)) {
    errors.username = 'Username must be 3-32 characters: lowercase letters, numbers, or underscores.'
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (values.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.'
  }
  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

const Register = () => {
  const navigate = useNavigate()
  const [values, setValues] = useState<FormValues>({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [touched, setTouched] = useState<Touched>({})
  const [usernameTakenError, setUsernameTakenError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [showConfirmEmailDialog, setShowConfirmEmailDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Derived from the latest values on every render, so an error clears the
  // moment it's fixed instead of waiting for the next blur or submit.
  const liveErrors = validate(values)

  const fieldError = (field: keyof FormValues): string | undefined => {
    if (!touched[field]) return undefined
    if (field === 'username' && usernameTakenError && !liveErrors.username) return usernameTakenError
    return liveErrors[field]
  }

  const updateField = <K extends keyof FormValues,>(field: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (field === 'username') setUsernameTakenError(null)
  }

  const markTouched = (field: keyof FormValues) => {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setTouched({
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      password: true,
      confirmPassword: true,
    })

    if (Object.keys(liveErrors).length > 0) return

    setSubmitting(true)

    // signUp()'s error message masks the underlying unique-constraint
    // violation from the profiles.username trigger (it just returns a
    // generic "Database error saving new user"), so availability has to be
    // checked proactively rather than parsed out of a failed signup.
    const { data: usernameTaken } = await supabase.rpc('is_username_taken', { p_username: values.username })
    if (usernameTaken) {
      setSubmitting(false)
      setUsernameTakenError('This username is already taken.')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: {
        data: {
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim() || null,
          username: values.username,
        },
      },
    })
    setSubmitting(false)

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        setFormError('This email is already registered.')
      } else if (error.message.toLowerCase().includes('database error')) {
        // signUp() masks the real cause behind this generic message (see the
        // comment on the availability check above) - the likeliest one at
        // this point is someone else taking the username in the race window
        // between that check and this insert.
        setFormError('Something went wrong creating your account. If your username was just taken, try a different one.')
      } else {
        setFormError(error.message)
      }
      return
    }

    if (data.session) {
      navigate('/')
      return
    }

    setShowConfirmEmailDialog(true)
  }

  return (
    <section id="auth-page">
      <form id="auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Register</h1>

        <AuthField htmlFor="firstName" label="First name" required error={fieldError('firstName')}>
          <input
            id="firstName"
            value={values.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
            onBlur={() => markTouched('firstName')}
            placeholder="4-32 characters"
            maxLength={32}
            autoComplete="given-name"
          />
        </AuthField>

        <AuthField htmlFor="lastName" label="Last name" error={fieldError('lastName')}>
          <input
            id="lastName"
            value={values.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
            onBlur={() => markTouched('lastName')}
            placeholder="Optional, 4-32 characters"
            maxLength={32}
            autoComplete="family-name"
          />
        </AuthField>

        <AuthField htmlFor="username" label="Username" required error={fieldError('username')}>
          <input
            id="username"
            value={values.username}
            onChange={(event) => updateField('username', event.target.value.toLowerCase())}
            onBlur={() => markTouched('username')}
            placeholder="3-32 chars: lowercase letters, numbers, underscores"
            maxLength={32}
            autoComplete="username"
          />
        </AuthField>

        <AuthField htmlFor="email" label="Email" required error={fieldError('email')}>
          <input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => updateField('email', event.target.value)}
            onBlur={() => markTouched('email')}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </AuthField>

        <AuthField htmlFor="password" label="Password" required error={fieldError('password')}>
          <PasswordInput
            id="password"
            value={values.password}
            onChange={(event) => updateField('password', event.target.value)}
            onBlur={() => markTouched('password')}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </AuthField>

        <AuthField htmlFor="confirmPassword" label="Confirm password" required error={fieldError('confirmPassword')}>
          <PasswordInput
            id="confirmPassword"
            value={values.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            onBlur={() => markTouched('confirmPassword')}
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />
        </AuthField>

        {formError && <p className="auth-form-error">{formError}</p>}

        <button type="submit" className="button primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p id="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>

      {showConfirmEmailDialog && (
        <ConfirmDialog
          title="Check your email"
          message={`We sent a confirmation link to ${values.email.trim()}. Confirm your account, then log in.`}
          confirmLabel="Go to log in"
          cancelLabel="Close"
          onConfirm={() => navigate('/login')}
          onCancel={() => setShowConfirmEmailDialog(false)}
        />
      )}
    </section>
  )
}

export default Register
