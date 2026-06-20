import { X, Mail, Lock } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-primary w-full max-w-md rounded-2xl border border-border-base shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border-base flex items-center justify-between">
          <h2 className="text-xl font-bold font-title uppercase tracking-wider">
            Bem-vindo de volta
          </h2>
          <button onClick={onClose} className="cursor-pointer text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
              <input 
                type="email" 
                className="w-full bg-bg-secondary border border-border-base rounded-lg py-2 pl-10 pr-4 text-text-primary focus:outline-none focus:border-border-gray transition-colors"
                placeholder="seu@email.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
              <input 
                type="password" 
                className="w-full bg-bg-secondary border border-border-base rounded-lg py-2 pl-10 pr-4 text-text-primary focus:outline-none focus:border-border-gray transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            onClick={() => {
              // Placeholder for auth success
              onSuccess();
              onClose();
            }}
            className="w-full mt-4 bg-text-primary hover:opacity-80 text-bg-primary py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
