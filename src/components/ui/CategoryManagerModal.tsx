import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, Plus, Trash2, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { CATEGORY_COLOR_OPTIONS, getCategoryStyles } from '../../utils/colors';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryManagerModal({ isOpen, onClose }: CategoryManagerModalProps) {
  const { categories, addCategory, updateCategory, deleteCategory, routines } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLOR_OPTIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateNew = () => {
    setEditingId('new');
    setName('');
    setColor(CATEGORY_COLOR_OPTIONS[0]);
  };

  const handleEdit = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    setEditingId(id);
    setName(cat.name);
    setColor(cat.color);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingId === 'new') {
        await addCategory({ name: name.trim(), color, icon: 'tag' });
      } else if (editingId) {
        await updateCategory(editingId, { name: name.trim(), color });
      }
      setEditingId(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const routinesUsingIt = routines.filter(r => r.categoryId === id);
    if (routinesUsingIt.length > 0) {
      alert('Não é possível excluir esta categoria porque há tarefas vinculadas a ela.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await deleteCategory(id);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]" onMouseDown={(e) => { if (e.target === e.currentTarget && !editingId) onClose(); }}>
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-md max-h-[85vh] shadow-2xl relative flex flex-col overflow-hidden">
        
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-md z-[80] flex items-center justify-center p-6 text-center animate-in fade-in">
            <div className="max-w-sm w-full space-y-6">
              <div>
                <h3 className="text-xl font-bold font-title text-red-500 mb-2">Excluir Categoria</h3>
                <p className="text-sm text-text-secondary">Tem certeza? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => handleDelete(showDeleteConfirm)} className="w-full bg-red-500 hover:bg-red-600 text-white rounded-lg py-3 font-bold transition-colors">Sim, excluir</button>
                <button onClick={() => setShowDeleteConfirm(null)} className="w-full bg-elements hover:bg-elements-hover text-text-primary rounded-lg py-3 font-medium transition-colors">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        <div className="p-5 border-b border-border-base flex justify-between items-center bg-bg-secondary/50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            {editingId && (
              <button onClick={() => setEditingId(null)} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                <ArrowLeft size={20} />
              </button>
            )}
            <h2 className="text-xl font-bold font-title">{editingId === 'new' ? 'Nova Categoria' : editingId ? 'Editar Categoria' : 'Gerenciar Categorias'}</h2>
          </div>
          {!editingId && (
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {editingId ? (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Nome da Categoria</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Saúde, Estudos..."
                  className="w-full bg-bg-primary border border-border-base rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-border-gray focus:ring-1 focus:ring-border-gray transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Cor da Categoria</label>
                <div className="grid grid-cols-4 gap-3">
                  {CATEGORY_COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-10 rounded-md transition-all cursor-pointer ${getCategoryStyles(c)} ${color === c ? 'ring-2 ring-text-primary ring-offset-2 ring-offset-bg-secondary scale-110 shadow-lg' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={!name.trim() || isSubmitting}
                  className="flex-1 bg-btn-bg hover:bg-btn-hover active:bg-btn-active disabled:opacity-50 text-text-primary rounded-lg py-3 font-bold transition-all cursor-pointer flex justify-center items-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Salvar
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleCreateNew}
                className="w-full py-3 px-4 rounded-lg border border-dashed border-border-gray hover:border-text-primary text-text-secondary hover:text-text-primary transition-all flex items-center justify-center gap-2 font-medium cursor-pointer"
              >
                <Plus size={18} /> Criar nova categoria
              </button>

              <div className="space-y-2">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-primary border border-border-base group">
                    <div className="flex items-center gap-3">
                      <span className={`w-4 h-4 rounded-full ${getCategoryStyles(cat.color)} border-none`} />
                      <span className="font-medium text-text-primary">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(cat.id)} className="p-2 text-text-secondary hover:text-text-primary rounded-md hover:bg-elements transition-colors cursor-pointer">
                        Editar
                      </button>
                      <button onClick={() => setShowDeleteConfirm(cat.id)} className="p-2 text-text-secondary hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
