import type { ReactNode } from 'react'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  title: string
  message?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  // Hides the Cancel button, leaving only Confirm - for a plain
  // acknowledgment dialog (e.g. "Saved") rather than an actual choice.
  // The backdrop still calls onCancel, so it's still dismissible that way.
  hideCancel?: boolean
  danger?: boolean
  confirming?: boolean
  confirmDisabled?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  hideCancel,
  danger,
  confirming,
  confirmDisabled,
  error,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) => (
  <div className="modal-overlay" onClick={confirming ? undefined : onCancel}>
    <div className="modal-card" onClick={(event) => event.stopPropagation()}>
      <h2>{title}</h2>
      {message && <p className="modal-message">{message}</p>}
      {children}
      {error && <p className="auth-form-error">{error}</p>}
      <div className="modal-actions">
        {!hideCancel && (
          <button type="button" className="button" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          className={`button ${danger ? 'danger' : 'primary'}`}
          onClick={onConfirm}
          disabled={confirming || confirmDisabled}
        >
          {confirming ? `${confirmLabel}…` : confirmLabel}
        </button>
      </div>
    </div>
  </div>
)

export default ConfirmDialog
