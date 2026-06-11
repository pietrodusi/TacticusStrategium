export interface ConfirmRequest {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}

/**
 * In-app replacement for window.confirm(). Brave (and other dialog-blocking
 * browsers, especially on mobile) silently suppress native dialogs — confirm()
 * returns false immediately and the guarded action never runs.
 * Use via hooks/useConfirm rather than rendering directly.
 */
export function ConfirmDialog({ req, onClose }: { req: ConfirmRequest; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={req.title}
        className="panel panel-glow w-full max-w-sm space-y-3 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="display text-base font-bold uppercase tracking-[0.1em] text-bone">{req.title}</h3>
        <p className="text-sm text-ash">{req.body}</p>
        <div className="flex justify-end gap-2 border-t border-iron/50 pt-3">
          <button onClick={onClose} className="btn px-3 py-1.5 text-xs">
            Cancel
          </button>
          <button
            onClick={() => {
              onClose()
              req.onConfirm()
            }}
            className={`btn px-3 py-1.5 text-xs ${
              req.danger ? 'border-blood text-blood-bright hover:bg-blood/20' : 'btn-primary'
            }`}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
