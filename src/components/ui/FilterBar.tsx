import { Search, X, ChevronDown } from 'lucide-react';
import React, { useState, useRef } from 'react';
import type { Category, TaskStatus } from '../../types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (id: string | null) => void;
  categories: Category[];
  statusFilter: TaskStatus | 'all';
  onStatusFilterChange: (status: TaskStatus | 'all') => void;
  sortMode: 'manual' | 'time' | 'status';
  onSortModeChange: (mode: 'manual' | 'time' | 'status') => void;
}

export function FilterBar({ searchQuery, onSearchChange, selectedCategory, onCategoryChange, categories, statusFilter, onStatusFilterChange, sortMode, onSortModeChange }: FilterBarProps) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusRect, setStatusRect] = useState<DOMRect | null>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortRect, setSortRect] = useState<DOMRect | null>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);

  const statusOptions = [
    { value: 'all', label: 'Status: Todos' },
    { value: 'pending', label: 'Pendente' },
    { value: 'in_progress', label: 'Em Andamento' },
    { value: 'completed', label: 'Concluído' },
    { value: 'late', label: 'Atrasado' },
    { value: 'canceled', label: 'Cancelado' },
    { value: 'vacation', label: 'Férias' },
  ];

  const sortOptions = [
    { value: 'manual', label: 'Ordem Manual' },
    { value: 'time', label: 'Por Horário' },
    { value: 'status', label: 'Por Status' },
  ];

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar tarefas..."
            className="w-full h-full bg-bg-secondary border border-border-base rounded-lg py-2 pl-9 pr-9 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neutral-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:flex-none">
            <button
              ref={statusBtnRef}
              type="button"
              onClick={() => {
                if (!isStatusOpen && statusBtnRef.current) {
                  setStatusRect(statusBtnRef.current.getBoundingClientRect());
                }
                setIsStatusOpen(!isStatusOpen);
              }}
              className={`w-full bg-bg-secondary border rounded-lg pl-3 pr-4 py-2 text-sm text-text-primary transition-all flex justify-between items-center cursor-pointer ${isStatusOpen ? 'border-border-gray ring-1 ring-border-gray' : 'border-border-base hover:border-border-gray'}`}>
              <span className="truncate pr-2">{statusOptions.find(o => o.value === statusFilter)?.label}</span>
              <ChevronDown size={16} className={`shrink-0 text-text-tertiary transition-transform duration-200 ${isStatusOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isStatusOpen && (
              <>
                <div className="fixed inset-0 z-60" onClick={() => setIsStatusOpen(false)} />
                <div
                  style={statusRect ? {
                    position: 'fixed',
                    top: statusRect.bottom + 6,
                    left: statusRect.left,
                    width: statusRect.width > 160 ? statusRect.width : 160,
                    zIndex: 61,
                    maxHeight: Math.min(250, window.innerHeight - statusRect.bottom - 12),
                  } : {}}
                    className="bg-bg-secondary border border-border-base rounded-lg shadow-xl overflow-y-auto flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200"
                  >
                    {statusOptions.map(option => (
                      <button key={option.value} type="button" onClick={() => { onStatusFilterChange(option.value as any); setIsStatusOpen(false); }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer ${statusFilter === option.value ? 'text-text-primary bg-elements font-medium' : 'text-text-secondary hover:bg-elements hover:text-text-primary'}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
              </>
            )}
          </div>
          
          <div className="relative flex-1 sm:flex-none">
            <button
              ref={sortBtnRef}
              type="button"
              onClick={() => {
                if (!isSortOpen && sortBtnRef.current) {
                  setSortRect(sortBtnRef.current.getBoundingClientRect());
                }
                setIsSortOpen(!isSortOpen);
              }}
              className={`w-full bg-bg-secondary border rounded-lg pl-3 pr-4 py-2 text-sm text-text-primary transition-all flex justify-between items-center cursor-pointer ${isSortOpen ? 'border-border-gray ring-1 ring-border-gray' : 'border-border-base hover:border-border-gray'}`}>
              <span className="truncate pr-2">{sortOptions.find(o => o.value === sortMode)?.label}</span>
              <ChevronDown size={16} className={`shrink-0 text-text-tertiary transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isSortOpen && (
              <>
                <div className="fixed inset-0 z-60" onClick={() => setIsSortOpen(false)} />
                <div
                  style={sortRect ? {
                    position: 'fixed',
                    top: sortRect.bottom + 6,
                    left: sortRect.left,
                    width: sortRect.width > 140 ? sortRect.width : 140,
                    zIndex: 61,
                    maxHeight: Math.min(200, window.innerHeight - sortRect.bottom - 12),
                  } : {}}
                    className="bg-bg-secondary border border-border-base rounded-lg shadow-xl overflow-y-auto flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200"
                  >
                    {sortOptions.map(option => (
                      <button key={option.value} type="button" onClick={() => { onSortModeChange(option.value as any); setIsSortOpen(false); }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer ${sortMode === option.value ? 'text-text-primary bg-elements font-medium' : 'text-text-secondary hover:bg-elements hover:text-text-primary'}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onCategoryChange(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
            selectedCategory === null
              ? 'bg-text-primary text-bg-primary border-text-primary'
              : 'bg-bg-secondary text-text-secondary border-border-base hover:border-border-gray'
          }`}
        >
          Todas
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(selectedCategory === cat.id ? null : cat.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-text-primary text-bg-primary border-text-primary'
                : 'bg-bg-secondary text-text-secondary border-border-base hover:border-border-gray'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
