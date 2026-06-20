import { Search, X } from 'lucide-react';
import type { Category } from '../../types';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (id: string | null) => void;
  categories: Category[];
}

export function FilterBar({ searchQuery, onSearchChange, selectedCategory, onCategoryChange, categories }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar tarefas..."
          className="w-full bg-bg-secondary border border-border-base rounded-lg py-2 pl-9 pr-9 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-neutral-500 transition-colors"
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
