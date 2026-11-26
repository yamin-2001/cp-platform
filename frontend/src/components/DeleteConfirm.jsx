import React from 'react'
import { MdDelete, MdClose } from 'react-icons/md'

/**
 * A styled confirmation dialog for destructive actions, replacing
 * `window.confirm` (which is unstyled, blocks the main thread, and does
 * not match the app's design language).
 */
const DeleteConfirm = ({
  open,
  title = 'Delete this item?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  busy = false,
}) => {
  if (!open) return null

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
      <div className="modal-box bg-base-200 border border-base-300">
        <button
          onClick={onCancel}
          className="btn btn-ghost btn-xs absolute right-3 top-3 text-muted"
          aria-label="Close"
        >
          <MdClose size={16} />
        </button>
        <h3 id="delete-confirm-title" className="font-display font-bold text-lg mb-2 pr-8">{title}</h3>
        <p className="text-sm text-muted mb-5">{message}</p>
        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-error btn-sm gap-1.5" onClick={onConfirm} disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : <MdDelete size={15} aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel} />
    </div>
  )
}

export default DeleteConfirm
