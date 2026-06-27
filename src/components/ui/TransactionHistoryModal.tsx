import { X, Pencil, Trash2 } from 'lucide-react';
import type { ITransaction } from './InvestmentView';

interface Props {
  ticker: string;
  transactions: ITransaction[];
  onClose: () => void;
  onEdit: (t: ITransaction) => void;
  onDelete: (id: string) => Promise<void>;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

export function TransactionHistoryModal({ ticker, transactions, onClose, onEdit, onDelete }: Props) {
  const typeLabel = (type: string) => type === 'buy' ? 'Compra' : type === 'sell' ? 'Venda' : 'Provento';
  const typeDot = (type: string) => type === 'buy' ? 'bg-emerald-500' : type === 'sell' ? 'bg-rose-500' : 'bg-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-secondary w-full max-w-xl rounded-2xl shadow-2xl border border-border-base flex flex-col max-h-[80vh] overflow-hidden">
        
        <div className="flex items-center justify-between p-6 border-b border-border-base">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Histórico de Lançamentos</h2>
            <p className="text-sm text-text-secondary mt-1">Ativo: <span className="text-text-primary font-bold">{ticker}</span></p>
          </div>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-primary rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {transactions.length === 0 ? (
            <p className="text-text-secondary text-center py-8">Nenhum lançamento encontrado.</p>
          ) : (
            <div className="space-y-3">
              {[...transactions].sort((a, b) => b.date.localeCompare(a.date)).map(t => (
                <div key={t.id} className="flex items-center justify-between bg-bg-primary border border-border-base rounded-xl px-4 py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${typeDot(t.type)}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary">{typeLabel(t.type)}</p>
                      <p className="text-xs text-text-secondary">{fmtDate(t.date)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-sm font-mono text-text-primary">{t.quantity > 1 ? `${t.quantity} cotas` : fmt(t.price)}</span>
                    {t.quantity > 1 && <span className="text-xs font-mono text-text-secondary">{fmt(t.price)} / cota</span>}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { onEdit(t); }}
                      className="p-2 text-text-tertiary hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                      title="Editar Lançamento"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => { if (confirm('Excluir este lançamento?')) onDelete(t.id); }}
                      className="p-2 text-text-tertiary hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Excluir Lançamento"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
