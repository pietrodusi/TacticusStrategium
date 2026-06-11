import { useState } from 'react'
import { ConfirmDialog, type ConfirmRequest } from '../components/ConfirmDialog'

/**
 * Per-component confirm flow: call `askConfirm({...})` where you would have
 * called window.confirm(), and render `{confirmDialog}` in the tree.
 */
export function useConfirm() {
  const [req, setReq] = useState<ConfirmRequest | null>(null)
  return {
    askConfirm: setReq,
    confirmDialog: req ? <ConfirmDialog req={req} onClose={() => setReq(null)} /> : null,
  }
}
