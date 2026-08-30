import { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="bg-bg-primary w-full max-w-md rounded-2xl border border-border-base shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border-base">
          <h2 id="confirm-modal-title" className="text-lg font-bold font-title text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-secondary cursor-pointer"
            onClick={onCancel}
            disabled={busy}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {description ? (
          <p className="px-5 pt-4 text-sm text-text-secondary leading-relaxed">{description}</p>
        ) : null}
        <div className="flex justify-end gap-2 p-5">
          <button
            type="button"
            autoFocus
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:bg-bg-secondary cursor-pointer disabled:opacity-50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-500 cursor-pointer disabled:opacity-50 flex items-center gap-2"
            onClick={onConfirm}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
