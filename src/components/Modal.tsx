import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  children?: ReactNode
  confirmText?: string
  cancelText?: string
  busy?: boolean
  danger?: boolean
  onClose: () => void
  onConfirm?: () => void
}

export default function Modal({
  open, title, description, children, confirmText = '확인', cancelText = '취소',
  busy = false, danger = false, onClose, onConfirm,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="modal-card">
        <div className="modal-symbol" data-danger={danger} aria-hidden="true">{danger ? '!' : '✓'}</div>
        <div>
          <p className="eyebrow">ITS DIARY</p>
          <h2 id="modal-title">{title}</h2>
          {description && <p className="modal-description">{description}</p>}
          {children}
        </div>
        <div className="modal-actions">
          {onConfirm && (
            <button className="button button-quiet" type="button" disabled={busy} onClick={onClose}>
              {cancelText}
            </button>
          )}
          <button
            className={`button ${danger ? 'button-danger' : 'button-primary'}`}
            type="button"
            disabled={busy}
            onClick={onConfirm ?? onClose}
          >
            {busy ? '저장 중…' : confirmText}
          </button>
        </div>
      </div>
    </dialog>
  )
}
