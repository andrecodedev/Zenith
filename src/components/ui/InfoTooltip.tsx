import { useState, useRef } from 'react';
import { Info, Copy, Check } from 'lucide-react';

export function InfoTooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 300),
      });
    }
    setOpen(v => !v);
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
      >
        <Info size={14} />
      </button>
      {open && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 200, width: 288 }}
          className="bg-bg-primary border border-border-gray rounded-lg shadow-xl p-3 text-xs text-text-secondary leading-relaxed animate-in fade-in zoom-in-95 duration-150"
        >
          {children}
        </div>
      )}
    </span>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-2 flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded bg-elements hover:bg-elements-hover text-text-primary transition-colors cursor-pointer border border-border-base w-full justify-center"
    >
      {copied ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar Prompt para IA</>}
    </button>
  );
}
