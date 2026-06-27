const fs = require('fs');
let c = fs.readFileSync('src/components/ui/InvestmentView.tsx', 'utf8');

c = c.replace(/onDeleteWatchlist: \(id: string\) => void;\n  onRefreshWatchlist: \(id: string\) => Promise<void>;/, 
  `onDeleteWatchlist: (id: string) => void;
  onRefreshWatchlist: (id: string) => Promise<void>;
  onEditWatchlistName: (id: string, newName: string) => void;`);

c = c.replace(/function WatchlistSection\(\{ categories, watchlist, onAddWatchlist, onDeleteWatchlist, onRefreshWatchlist \}: \{/g,
  `function WatchlistSection({ categories, watchlist, onAddWatchlist, onDeleteWatchlist, onRefreshWatchlist, onEditWatchlistName }: {`);

const oldHeader = `<th className="w-16 px-3 py-2.5 border border-border-base"></th>`;
const newHeader = `<th className="w-20 px-3 py-2.5 text-right text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Ações</th>`;
c = c.replace(oldHeader, newHeader);

const oldActions = `<td className="px-3 py-2.5 border border-border-base">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleRefreshWatch(w.id)}
                              className={\`text-text-tertiary/50 hover:text-text-tertiary transition-colors cursor-pointer \${refreshingWatch === w.id ? 'animate-spin' : ''}\`}>
                              <RefreshCw size={9} />
                            </button>
                            <button onClick={() => onDeleteWatchlist(w.id)} className="text-text-tertiary/50 hover:text-red-400 cursor-pointer transition-colors"><Trash2 size={9} /></button>
                          </div>
                        </td>`;
const newActions = `<td className="px-3 py-2.5 border border-border-base">
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => {
                                const newName = window.prompt('Editar nome do ativo:', w.name);
                                if (newName && newName.trim() !== '') onEditWatchlistName(w.id, newName.trim());
                              }}
                              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Editar nome">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleRefreshWatch(w.id)}
                              className={\`text-text-secondary hover:text-text-primary transition-colors cursor-pointer \${refreshingWatch === w.id ? 'animate-spin' : ''}\`} title="Atualizar preço">
                              <RefreshCw size={14} />
                            </button>
                            <button onClick={() => onDeleteWatchlist(w.id)} className="text-text-secondary hover:text-red-400 cursor-pointer transition-colors" title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>`;
c = c.replace(oldActions, newActions);

const oldAddFunc = `const addWatchlistItem = useCallback(async (categoryId: string, ticker: string) => {`;
const editFunc = `const editWatchlistName = useCallback((id: string, newName: string) => {
    setWatchlist(prev => {
      const next = prev.map(w => w.id === id ? { ...w, name: newName } : w);
      persistWatchlist(next);
      return next;
    });
  }, []);

  const addWatchlistItem = useCallback(async (categoryId: string, ticker: string) => {`;
c = c.replace(oldAddFunc, editFunc);

const oldWatchlistSectionTag = `<WatchlistSection
              categories={categories} watchlist={watchlist}
              onAddWatchlist={addWatchlistItem}
              onDeleteWatchlist={deleteWatchlistItem}
              onRefreshWatchlist={refreshWatchlistItem}
            />`;
const newWatchlistSectionTag = `<WatchlistSection
              categories={categories} watchlist={watchlist}
              onAddWatchlist={addWatchlistItem}
              onDeleteWatchlist={deleteWatchlistItem}
              onRefreshWatchlist={refreshWatchlistItem}
              onEditWatchlistName={editWatchlistName}
            />`;
c = c.replace(oldWatchlistSectionTag, newWatchlistSectionTag);

fs.writeFileSync('src/components/ui/InvestmentView.tsx', c);
