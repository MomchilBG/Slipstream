import type { ReactNode } from 'react'

export interface AuthFieldProps {
  htmlFor: string
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}

const AuthField = ({ htmlFor, label, required, error, children }: AuthFieldProps) => (
  <div className="auth-field">
    <label htmlFor={htmlFor}>
      {label}
      {required && <span className="auth-required-mark"> *</span>}
    </label>
    {children}
    {error && <span className="auth-error">{error}</span>}
  </div>
)

export default AuthField
