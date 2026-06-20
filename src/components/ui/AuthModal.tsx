import React, { useState } from 'react';
import { X, Mail, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro durante a autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-primary w-full max-w-md rounded-2xl border border-border-base shadow-2xl overflow-hidden flex flex-col relative">
        <div className="p-6 border-b border-border-base flex items-center justify-between">
          <h2 className="text-xl font-bold font-title uppercase tracking-wider text-text-primary">
            {isLogin ? 'Bem-vindo de volta' : 'Criar nova conta'}
          </h2>
          <button onClick={onClose} className="cursor-pointer text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleAuth} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-bg-secondary border border-border-base rounded-lg py-2 pl-10 pr-4 text-text-primary focus:outline-none focus:border-border-gray transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-text-primary hover:opacity-80 text-bg-primary py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? 'Entrar' : 'Cadastrar')}
          </button>
          
          <div className="text-center mt-4">
            <span className="text-sm text-text-tertiary">
              Não tem uma conta?{' '}
              <a 
                href="mailto:contato.andrecodedev@gmail.com?subject=Solicitação de Acesso - Zenith" 
                className="text-text-primary hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
              >
                Solicite acesso
              </a>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
