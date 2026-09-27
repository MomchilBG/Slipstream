import { useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import './PasswordInput.css'

interface PasswordInputProps {
  id: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  placeholder?: string
  autoComplete?: string
}

const PasswordInput = ({ id, value, onChange, onBlur, placeholder, autoComplete }: PasswordInputProps) => {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-input">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A9.15 9.15 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-3.22 4.64" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}

export default PasswordInput
