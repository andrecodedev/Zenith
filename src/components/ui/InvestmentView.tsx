import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, Trash2, Target, ChevronDown, ChevronUp, Pencil, RefreshCw, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { TransactionData, AssetType } from './TransactionModal';
import { TransactionModal, StyledSelect } from './TransactionModal';
import { TransactionHistoryModal } from './TransactionHistoryModal';

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface ICategory {
  id: string; name: string; idealPercent: number; currentPercent: number; color: string; sortOrder: number;
}
interface IGoal {
  id: string; categoryId: string; label: string; targetAmount: number; priority: number;
}
interface IWatchlistItem {
  id: string; categoryId: string; ticker: string;
  name: string; price: number; changePercent: number; logoUrl?: string;
}
export interface ITransaction {
  id: string; ticker: string; categoryId: string;
  type: 'buy' | 'sell' | 'dividend'; date: string;
  quantity: number; price: number; otherCosts: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assetType?: AssetType; meta?: any;
}
interface IHolding {
  ticker: string; categoryId: string;
  qty: number; avgPrice: number; totalInvested: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assetType?: AssetType; meta?: any; purchaseDate?: string;
}
interface PConfig {
  investPatrimonio: number;
  patrimonio: number; aportar: number;
  caixaPercent: number; investPercent: number; despFixasPercent: number; despVariaveisPercent: number;
}
interface GoalInfo { label: string; targetAmount: number; currentAmount: number; priority: number; }
interface DistRow {
  label: string; currentPct: number; onCurrentPctCh?: (v: number) => void;
  idealPct: number; onIdealCh: (v: number) => void; goal?: GoalInfo;
}
type PriceData = { price: number; changePercent: number; name: string; fetchedAt: number; logoUrl?: string; _isRF?: boolean };
type PriceCache = Record<string, PriceData>;

// ── Constants & storage ────────────────────────────────────────────────────────
const INVEST_PAT_KEY = 'zenith_invest_patrimonio';
const GOALS_KEY = 'zenith_invest_goals';
const WATCHLIST_KEY = 'zenith_invest_watchlist';
const PRICE_CACHE_KEY = 'zenith_price_cache';
const CACHE_TTL = 30 * 60 * 1000;

const loadGoals = (): IGoal[] => { try { return JSON.parse(localStorage.getItem(GOALS_KEY) || '[]'); } catch { return []; } };
const persistGoals = (g: IGoal[]) => localStorage.setItem(GOALS_KEY, JSON.stringify(g));
const loadWatchlist = (): IWatchlistItem[] => { try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]'); } catch { return []; } };
const persistWatchlist = (w: IWatchlistItem[]) => localStorage.setItem(WATCHLIST_KEY, JSON.stringify(w));
const loadPriceCache = (): PriceCache => { try { return JSON.parse(localStorage.getItem(PRICE_CACHE_KEY) || '{}'); } catch { return {}; } };
const persistPriceCache = (c: PriceCache) => localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(c));

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtP = (n: number) => `${n.toFixed(2)}%`;
const parseFmt = (s: string): number => {
  let c = s.replace(/R\$\s?|%/g, '').trim();
  if (c.includes(',')) c = c.replace(/\./g, '').replace(',', '.');
  else c = c.replace(/\./g, '');
  return Math.abs(parseFloat(c) || 0);
};


const fetchQuote = async (ticker: string): Promise<{ name: string; price: number; changePercent: number; logoUrl?: string } | null> => {
  try {
    const token = import.meta.env.VITE_BRAPI_TOKEN || '';
    const res = await fetch(`https://brapi.dev/api/quote/${ticker}${token ? `?token=${token}` : ''}`);
    const json = await res.json();
    const r = json.results?.[0];
    if (!r) return null;
    return { 
      name: (r.longName || r.shortName || ticker) as string, 
      price: (r.regularMarketPrice || 0) as number, 
      changePercent: (r.regularMarketChangePercent || 0) as number,
      logoUrl: r.logourl as string | undefined
    };
  } catch { return null; }
};

const fetchPrices = async (tickers: string[], cache: PriceCache): Promise<PriceCache> => {
  const now = Date.now();
  // RF não são tickers de bolsa — filtrar antes de chamar a API
  const marketTickers = tickers.filter(t => !cache[t]?._isRF);
  const stale = marketTickers.filter(t => !cache[t] || now - cache[t].fetchedAt > CACHE_TTL);
  if (!stale.length) return cache;
  const chunks: string[][] = [];
  for (let i = 0; i < stale.length; i += 20) chunks.push(stale.slice(i, i + 20));
  const next = { ...cache };
  const token = import.meta.env.VITE_BRAPI_TOKEN || '';
  await Promise.all(chunks.map(async chunk => {
    try {
      const res = await fetch(`https://brapi.dev/api/quote/${chunk.join(',')}${token ? `?token=${token}` : ''}`);
      const json = await res.json();
      for (const r of (json.results || [])) {
        next[r.symbol || r.ticker] = { 
          price: r.regularMarketPrice || 0, 
          changePercent: r.regularMarketChangePercent || 0, 
          name: r.longName || r.shortName || r.ticker || r.symbol, 
          logoUrl: r.logourl,
          fetchedAt: now 
        };
      }
    } catch { /* ignore */ }
  }));
  return next;
};

type MacroRates = {
  cdiHistory?: Record<string, number>;
  [key: string]: number | Record<string, number> | undefined;
};

let cachedMacroRates: MacroRates | null = null;
const getMacroRates = async (): Promise<MacroRates> => {
  if (cachedMacroRates) return cachedMacroRates;
  try {
    const cachedStr = localStorage.getItem('ZENITH_MACRO_RATES_V2');
    if (cachedStr) {
      const data = JSON.parse(cachedStr);
      if (Date.now() - data.fetchedAt < 1000 * 60 * 60 * 24) {
        cachedMacroRates = data.rates;
        return data.rates;
      }
    }
    const [cdi, selic, ipca, cdiHistoryRes] = await Promise.all([
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json').then(r => r.json()),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json').then(r => r.json()),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json').then(r => r.json()),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/2000?formato=json').then(r => r.json()),
    ]);
    
    const cdiHistory: Record<string, number> = {};
    if (Array.isArray(cdiHistoryRes)) {
      cdiHistoryRes.forEach((item: { data: string; valor: string | number }) => {
        cdiHistory[item.data] = Number(item.valor) / 100; // Taxa ao dia em decimal puro
      });
    }

    const rates = {
      'CDI': Number(cdi[0].valor) / 100,
      'SELIC': Number(selic[0].valor) / 100,
      'IPCA': Number(ipca[0].valor) / 100,
      'IGPM': 0.040, 'INPC': 0.045, 'TR': 0.0065, 'TJLP': 0.075, 'PRÉ': 0,
      cdiHistory
    };
    cachedMacroRates = rates;
    localStorage.setItem('ZENITH_MACRO_RATES_V2', JSON.stringify({ rates, fetchedAt: Date.now() }));
    return rates;
  } catch {
    return {
      'CDI': 0.1415, 'SELIC': 0.1425,
      'IPCA': 0.0472, 'IGPM': 0.040, 'INPC': 0.045,
      'TR': 0.0065, 'TJLP': 0.075, 'PRÉ': 0,
      cdiHistory: {}
    };
  }
};

// Estima o valor atual de um ativo de Renda Fixa com base na taxa e dias decorridos
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const calcRFCurrentPrice = (valorInicial: number, meta: any, purchaseDate: string, macroRates: any, targetDate?: string | Date): number => {
  if (!valorInicial || !purchaseDate) return valorInicial;
  
  // Garante que o parse da data (YYYY-MM-DD) caia no mesmo dia local, evitando que UTC-3 jogue pro dia anterior
  const pParts = purchaseDate.split('-');
  const purchase = pParts.length === 3 ? new Date(Number(pParts[0]), Number(pParts[1]) - 1, Number(pParts[2]), 12, 0, 0) : new Date(purchaseDate);
  const now = targetDate ? (typeof targetDate === 'string' && targetDate.includes('-') ? new Date(Number(targetDate.split('-')[0]), Number(targetDate.split('-')[1]) - 1, Number(targetDate.split('-')[2]), 12, 0, 0) : new Date(targetDate)) : new Date();
  const dias = Math.max(0, (now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24));
  if (dias === 0) return valorInicial;
  
  const taxaPct = Number(meta?.taxa) || 100;
  const indexador = (meta?.indexador || 'CDI').toUpperCase();
  
  let fator = 1;
  
  // Cálculo EXATO para CDI usando o histórico diário do BCB
  if (indexador === 'CDI' && macroRates?.cdiHistory && Object.keys(macroRates.cdiHistory).length > 0) {
    const iterDate = new Date(purchase.getTime());
    iterDate.setHours(12, 0, 0, 0);
    const end = new Date(now.getTime());
    end.setHours(12, 0, 0, 0);
    
    while (iterDate <= end) {
      const dd = String(iterDate.getDate()).padStart(2, '0');
      const mm = String(iterDate.getMonth() + 1).padStart(2, '0');
      const yyyy = iterDate.getFullYear();
      const dateKey = `${dd}/${mm}/${yyyy}`;
      
      const cdiDiario = macroRates.cdiHistory[dateKey];
      if (cdiDiario !== undefined) {
        fator *= (1 + (cdiDiario * (taxaPct / 100)));
      }
      iterDate.setDate(iterDate.getDate() + 1);
    }
  } else {
    // Fallback de aproximação para outros indexadores
    const diasUteis = dias * (252 / 365);
    let taxaAnual: number;
    if (indexador === 'PRÉ' || indexador === 'PRÉ-FIXADO') {
      taxaAnual = taxaPct / 100;
    } else {
      const safeRates = macroRates || {};
      taxaAnual = (safeRates[indexador] ?? safeRates['CDI'] ?? 0.104) * (taxaPct / 100);
    }
    fator = Math.pow(1 + taxaAnual, diasUteis / 252);
  }

  const valorBruto = valorInicial * fator;
  
  // Retorna o valor bruto para espelhar o comportamento padrão do Investidor10 (que mostra saldo bruto)
  return valorBruto;
};

const calcHoldings = (transactions: ITransaction[]): IHolding[] => {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map<string, IHolding>();
  for (const t of sorted) {
    const cur = map.get(t.ticker) || { ticker: t.ticker, categoryId: t.categoryId, qty: 0, avgPrice: 0, totalInvested: 0, assetType: t.assetType, meta: t.meta, purchaseDate: t.date };
    if (t.type === 'buy') {
      const cost = t.quantity * t.price + t.otherCosts;
      const newQty = cur.qty + t.quantity;
      const newAvg = newQty > 0 ? (cur.qty * cur.avgPrice + cost) / newQty : 0;
      map.set(t.ticker, { ...cur, qty: newQty, avgPrice: newAvg, totalInvested: cur.totalInvested + cost, assetType: t.assetType, meta: t.meta, purchaseDate: cur.purchaseDate || t.date });
    } else if (t.type === 'sell') {
      const newQty = cur.qty - t.quantity;
      if (newQty < 0.0001) map.delete(t.ticker);
      else map.set(t.ticker, { ...cur, qty: newQty });
    }
  }
  return Array.from(map.values());
};

const mapCat = (r: Record<string, unknown>): ICategory => ({
  id: r.id as string, name: r.name as string,
  idealPercent: Number(r.ideal_percent) || 0,
  currentPercent: Number(r.current_value) || 0,
  color: (r.color as string) || '#6366f1',
  sortOrder: Number(r.sort_order) || 0,
});
const mapTransaction = (r: Record<string, unknown>): ITransaction => ({
  id: r.id as string, ticker: r.ticker as string,
  categoryId: (r.category_id as string) || '',
  type: r.type as 'buy' | 'sell' | 'dividend', date: r.date as string,
  quantity: Number(r.quantity) || 0, price: Number(r.price) || 0,
  otherCosts: Number(r.other_costs) || 0,
  assetType: r.asset_type as AssetType | undefined,
  meta: r.meta,
});

const DEFAULT_CATEGORIES = [
  { name: 'Ações',        idealPercent: 20, color: '#ef4444' },
  { name: 'Exterior',     idealPercent: 20, color: '#3b82f6' },
  { name: 'ETFs',         idealPercent: 5,  color: '#06b6d4' },
  { name: 'FIIs',         idealPercent: 25, color: '#f97316' },
  { name: 'Renda Fixa',   idealPercent: 25, color: '#22c55e' },
  { name: 'Criptomoedas', idealPercent: 5,  color: '#a855f7' },
];

// ── Editable cell ──────────────────────────────────────────────────────────────
function Editable({ value, onSave, right = false, placeholder = '' }: {
  value: string; onSave: (v: string) => void; right?: boolean; placeholder?: string;
}) {
  const [ed, setEd] = useState(false);
  const [d, setD] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (ed) { setD(value); setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 0); } }, [ed, value]);
  const done = () => { setEd(false); if (d !== value) onSave(d); };
  if (ed) return (
    <input ref={ref} value={d} onChange={e => setD(e.target.value)} onBlur={done}
      onKeyDown={e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') setEd(false); }}
      className={`bg-transparent outline-none w-full p-0 m-0 border-transparent border-0 ring-0 focus:ring-0 leading-tight text-xs sm:text-sm font-mono ${right ? 'text-right' : ''}`} />
  );
  return (
    <span onClick={() => setEd(true)}
      className={`cursor-text block w-full p-0 m-0 border-transparent border-0 leading-tight text-xs sm:text-sm font-mono ${right ? 'text-right' : ''} ${!value ? 'text-text-tertiary/30' : ''}`}>
      {value || placeholder || ' '}
    </span>
  );
}

// ── Distribution table ─────────────────────────────────────────────────────────
function DistTable({ title, patrimonioLabel = "Patrimônio atual", patrimonio, aportar, onPatrimonioCh, onAportarCh, rows, rebalance = false, isSimulator = false }: {
  title: string; patrimonioLabel?: string; patrimonio: number; aportar: number;
  onPatrimonioCh?: (v: number) => void; onAportarCh?: (v: number) => void;
  rows: DistRow[]; rebalance?: boolean; isSimulator?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const sumIdeal = rows.reduce((s, r) => s + r.idealPct, 0);
  const sumCurrentPct = rows.reduce((s, r) => s + r.currentPct, 0);
  const activeGoals = rows.filter(r => r.goal && r.goal.currentAmount < r.goal.targetAmount);
  const totalGoalPriority = Math.min(100, activeGoals.reduce((s, r) => s + (r.goal?.priority ?? 0), 0));

  let rowsFinal: (DistRow & { quantoColoco: number })[];

  if (isSimulator) {
    rowsFinal = rows.map(row => ({ ...row, quantoColoco: sumIdeal > 0 ? patrimonio * (row.idealPct / sumIdeal) : 0 }));
  } else if (rebalance && activeGoals.length > 0 && totalGoalPriority > 0 && aportar > 0) {
    const goalAporte = (totalGoalPriority / 100) * aportar;
    const goalMap = new Map<string, number>();
    let usedForGoals = 0;
    for (const r of activeGoals) {
      const share = (r.goal!.priority / totalGoalPriority) * goalAporte;
      const shortfall = r.goal!.targetAmount - r.goal!.currentAmount;
      const alloc = Math.min(share, shortfall);
      goalMap.set(r.label, alloc);
      usedForGoals += alloc;
    }
    const remainingAporte = aportar - usedForGoals;
    rowsFinal = rows.map(row => {
      if (goalMap.has(row.label)) return { ...row, quantoColoco: goalMap.get(row.label)! };
      const targetAmt = (row.idealPct / 100) * (patrimonio + remainingAporte);
      const currentAmt = (row.currentPct / 100) * patrimonio;
      return { ...row, quantoColoco: Math.max(0, targetAmt - currentAmt) };
    });
    const totalNGQC = rowsFinal.filter(r => !goalMap.has(r.label)).reduce((s, r) => s + r.quantoColoco, 0);
    if (totalNGQC > remainingAporte && totalNGQC > 0) {
      const scale = remainingAporte / totalNGQC;
      rowsFinal = rowsFinal.map(r => goalMap.has(r.label) ? r : { ...r, quantoColoco: r.quantoColoco * scale });
    }
  } else if (rebalance) {
    rowsFinal = rows.map(row => {
      const targetAmt = (row.idealPct / 100) * (patrimonio + aportar);
      const currentAmt = (row.currentPct / 100) * patrimonio;
      return { ...row, quantoColoco: Math.max(0, targetAmt - currentAmt) };
    });
    const totalQC = rowsFinal.reduce((s, r) => s + r.quantoColoco, 0);
    if (totalQC > aportar && totalQC > 0) {
      const scale = aportar / totalQC;
      rowsFinal = rowsFinal.map(r => ({ ...r, quantoColoco: r.quantoColoco * scale }));
    }
  } else {
    rowsFinal = rows.map(row => ({ ...row, quantoColoco: sumIdeal > 0 ? aportar * (row.idealPct / sumIdeal) : 0 }));
  }

  return (
    <div className="bg-bg-secondary border border-border-base rounded-xl overflow-hidden">
      <div onClick={() => setCollapsed(!collapsed)} className="px-4 py-3 border-b border-border-base bg-bg-secondary flex items-center justify-between cursor-pointer hover:bg-elements/10 transition-colors">
        <span className="text-sm sm:text-base font-bold text-text-primary pr-2">{title}</span>
        {collapsed ? <ChevronDown size={14} className="text-text-tertiary shrink-0" /> : <ChevronUp size={14} className="text-text-tertiary shrink-0" />}
      </div>
      {!collapsed && (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse">
          <thead>
            <tr className="bg-elements/20">
              <th colSpan={isSimulator ? 3 : 2} className={`px-4 py-2.5 text-left font-normal border border-border-base ${isSimulator ? 'w-full' : 'w-[60%]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap">{patrimonioLabel}</span>
                  <div className="w-32 text-right">
                    {onPatrimonioCh ? (
                      <Editable value={patrimonio > 0 ? fmt(patrimonio) : ''} onSave={v => onPatrimonioCh(parseFmt(v))} right placeholder="Editar" />
                    ) : (
                      <span className="text-sm font-mono font-bold text-text-primary cursor-default select-text">{fmt(patrimonio)}</span>
                    )}
                  </div>
                </div>
              </th>
              {!isSimulator && (
                <th colSpan={2} className="px-4 py-2.5 text-left font-normal border border-border-base w-[40%]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap">Quanto vou aportar</span>
                    <div className="w-24 text-right">
                      {onAportarCh && <Editable value={aportar > 0 ? fmt(aportar) : ''} onSave={v => onAportarCh(parseFmt(v))} right placeholder="Editar" />}
                    </div>
                  </div>
                </th>
              )}
            </tr>
            <tr className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider bg-bg-secondary">
              <th className={`px-4 py-2 text-left font-normal border border-border-base ${isSimulator ? 'w-[50%]' : 'w-[40%]'}`}>Categoria</th>
              {!isSimulator && <th className="px-3 py-2 text-right font-normal w-[20%] border border-border-base">% Atual</th>}
              <th className={`px-3 py-2 text-right font-normal ${isSimulator ? 'w-[25%]' : 'w-[15%]'} border border-border-base`}>% Ideal</th>
              <th className={`px-3 py-2 text-right font-normal ${isSimulator ? 'w-[25%]' : 'w-[25%]'} border border-border-base`}>{isSimulator ? 'Valor Destinado' : 'Quanto Coloco'}</th>
            </tr>
          </thead>
          <tbody className="bg-bg-primary">
            {rowsFinal.map(row => {
              const hasActiveGoal = row.goal && row.goal.currentAmount < row.goal.targetAmount;
              return (
                <tr key={row.label} className="hover:bg-elements/10 transition-colors">
                  <td className="px-4 py-2.5 text-xs sm:text-sm text-text-primary border border-border-base">
                    <div className="flex items-center gap-1.5">
                      {row.label}
                      {hasActiveGoal && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-elements/10 text-text-primary border border-border-base">
                          META
                        </span>
                      )}
                    </div>
                  </td>
                  {!isSimulator && (
                    <td className="px-3 py-2.5 text-right w-20 border border-border-base">
                      {row.onCurrentPctCh ? (
                        <Editable value={fmtP(row.currentPct)} onSave={v => row.onCurrentPctCh!(parseFmt(v))} right />
                      ) : (
                        <span className="text-xs sm:text-sm font-mono text-text-secondary">{fmtP(row.currentPct)}</span>
                      )}
                    </td>
                  )}
                  <td className={`px-3 py-2.5 text-right ${isSimulator ? 'w-[25%]' : 'w-24'} border border-border-base`}>
                    <Editable value={fmtP(row.idealPct)} onSave={v => row.onIdealCh(parseFmt(v))} right />
                  </td>
                  <td className={`px-3 py-2.5 text-right text-xs sm:text-sm font-mono border border-border-base ${row.quantoColoco > 0 ? (hasActiveGoal ? 'text-text-primary' : 'text-emerald-400') : 'text-text-tertiary/40'}`}>
                    {fmt(row.quantoColoco)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-bg-secondary">
            <tr>
              <td className="px-4 py-2.5 text-[10px] text-text-tertiary uppercase tracking-wider border border-border-base">Total</td>
              {!isSimulator && (
                <td className="px-3 py-2.5 text-right text-xs font-mono text-text-secondary border border-border-base">{rebalance ? fmtP(sumCurrentPct) : ''}</td>
              )}
              <td className="px-3 py-2.5 text-right text-xs font-mono text-text-secondary border border-border-base">{fmtP(sumIdeal)}</td>
              <td className="px-3 py-2.5 text-right text-xs font-mono text-text-secondary border border-border-base">
                {isSimulator ? fmt(rowsFinal.reduce((s, r) => s + r.quantoColoco, 0)) : fmt(aportar)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      )}
    </div>
  );
}

// ── Currency input ─────────────────────────────────────────────────────────────
function CurrencyInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { onChange(''); return; }
    onChange('R$ ' + parseInt(digits, 10).toLocaleString('pt-BR'));
  };
  return (
    <input value={value} onChange={handleChange} placeholder={placeholder} inputMode="numeric"
      className="w-full bg-bg-primary border border-border-base rounded-lg px-3 py-2 text-sm text-text-primary outline-none font-mono placeholder:text-text-tertiary/40 focus:border-border-gray transition-colors" />
  );
}

// ── Custom category dropdown ───────────────────────────────────────────────────
function CategoryDropdown({ categories, value, onChange }: {
  categories: ICategory[]; value: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = categories.find(c => c.id === value);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 bg-bg-primary border border-border-base rounded-lg px-3 py-2 text-sm text-text-primary cursor-pointer hover:border-border-gray transition-colors">
        {selected && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selected.color }} />}
        <span className="flex-1 text-left">{selected?.name ?? 'Selecionar'}</span>
        <ChevronDown size={14} className={`text-text-tertiary transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-bg-secondary border border-border-base rounded-xl shadow-2xl overflow-hidden">
          {categories.map(c => (
            <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors cursor-pointer text-left ${c.id === value ? 'bg-elements text-text-primary' : 'text-text-secondary hover:bg-elements/60'}`}>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Goal form modal ────────────────────────────────────────────────────────────
function GoalForm({ categories, initial, onSave, onClose }: {
  categories: ICategory[]; initial?: IGoal;
  onSave: (g: Omit<IGoal, 'id'>) => void; onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [targetStr, setTargetStr] = useState(initial ? 'R$ ' + initial.targetAmount.toLocaleString('pt-BR') : '');
  const [priority, setPriority] = useState(initial?.priority ?? 50);
  const isEdit = !!initial;
  const submit = () => {
    const targetAmount = parseFmt(targetStr);
    if (!categoryId || !label.trim() || targetAmount <= 0) return;
    onSave({ categoryId, label: label.trim(), targetAmount, priority });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-bg-secondary border border-border-base rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-base">
          <span className="text-sm font-bold text-text-primary">{isEdit ? 'Editar Meta' : 'Nova Meta'}</span>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer text-lg leading-none">×</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="block text-[10px] text-text-tertiary uppercase tracking-wider mb-1.5">Categoria</label>
            <CategoryDropdown categories={categories} value={categoryId} onChange={setCategoryId} />
          </div>
          <div>
            <label className="block text-[10px] text-text-tertiary uppercase tracking-wider mb-1.5">Nome da meta</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Reserva de Emergência"
              className="w-full bg-bg-primary border border-border-base rounded-lg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary/40 focus:border-border-gray transition-colors"
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div>
            <label className="block text-[10px] text-text-tertiary uppercase tracking-wider mb-1.5">Valor alvo</label>
            <CurrencyInput value={targetStr} onChange={setTargetStr} placeholder="R$ 15.000" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-text-tertiary uppercase tracking-wider">Prioridade do aporte</label>
              <span className={`text-sm font-bold font-mono ${priority === 100 ? 'text-red-400' : priority >= 70 ? 'text-text-primary' : 'text-emerald-400'}`}>{priority}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={priority} onChange={e => setPriority(Number(e.target.value))} className="w-full accent-neutral-500 cursor-pointer" />
            <div className="flex justify-between text-[9px] text-text-tertiary/50 mt-1"><span>Baixa</span><span>Média</span><span>Suprema</span></div>
            {priority === 100 && <p className="text-[10px] text-red-400/80 mt-1.5">Prioridade suprema, 100% do aporte irá para esta meta.</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border-base">
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-tertiary hover:text-text-primary cursor-pointer transition-colors">Cancelar</button>
          <button onClick={submit} className="px-4 py-2 text-sm font-semibold bg-text-primary text-bg-primary rounded-lg hover:opacity-80 cursor-pointer transition-colors">{isEdit ? 'Salvar' : 'Criar Meta'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Goal card ──────────────────────────────────────────────────────────────────
function GoalCard({ goal, category, currentAmount, onDelete, onEdit, onUpdatePriority }: {
  goal: IGoal; category: ICategory | undefined; currentAmount: number;
  onDelete: () => void; onEdit: () => void; onUpdatePriority: (p: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const progress = goal.targetAmount > 0 ? Math.min(100, (currentAmount / goal.targetAmount) * 100) : 0;
  const remaining = Math.max(0, goal.targetAmount - currentAmount);
  const done = remaining <= 0;
  return (
    <div className={`bg-bg-secondary border rounded-xl overflow-hidden ${done ? 'border-emerald-500/40' : 'border-border-base'}`}>
      <div className={`flex items-center gap-2 px-4 py-3 ${done ? 'bg-emerald-500/10' : 'bg-elements/5'}`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text-primary truncate">{goal.label}</p>
          <p className="text-[10px] text-text-tertiary">{category?.name ?? ''} · Meta: {fmt(goal.targetAmount)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {done && <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/15 px-2 py-0.5 rounded">Concluída!</span>}
          <button onClick={onEdit} className="text-text-tertiary/30 hover:text-text-primary cursor-pointer transition-colors"><Pencil size={12} /></button>
          <button onClick={() => setOpen(v => !v)} className="text-text-tertiary/50 hover:text-text-tertiary cursor-pointer transition-colors">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={onDelete} className="text-text-tertiary/30 hover:text-red-400 cursor-pointer transition-colors"><Trash2 size={12} /></button>
        </div>
      </div>
      <div className="px-4 py-3 border-t border-border-base/20">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-mono text-text-secondary">{fmt(currentAmount)}</span>
          <span className="font-mono text-text-tertiary">{fmt(goal.targetAmount)}</span>
        </div>
        <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-text-primary'}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-[10px] font-semibold ${done ? 'text-emerald-400' : 'text-text-primary'}`}>{progress.toFixed(1)}%</span>
          {!done && <span className="text-[10px] text-text-tertiary">Faltam {fmt(remaining)}</span>}
        </div>
      </div>
      {open && (
        <div className="px-4 py-3 border-t border-border-base/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Prioridade do aporte</span>
            <span className={`text-sm font-bold font-mono ${goal.priority === 100 ? 'text-red-400' : goal.priority >= 70 ? 'text-text-primary' : 'text-emerald-400'}`}>{goal.priority}%</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={goal.priority} onChange={e => onUpdatePriority(Number(e.target.value))} className="w-full accent-neutral-500 cursor-pointer" />
          <p className="text-[10px] text-text-tertiary/60 mt-1.5">
            {goal.priority === 100 ? 'Prioridade suprema, todo o aporte vai para esta meta.' : `${goal.priority}% do aporte é direcionado para esta meta.`}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Goals section ──────────────────────────────────────────────────────────────
function GoalsSection({ goals, categories, investPatrimonio, onAdd, onDelete, onUpdate }: {
  goals: IGoal[]; categories: ICategory[]; investPatrimonio: number;
  onAdd: (g: Omit<IGoal, 'id'>) => void; onDelete: (id: string) => void; onUpdate: (id: string, updates: Partial<IGoal>) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<IGoal | null>(null);
  const getCatCurrentAmount = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? (cat.currentPercent / 100) * investPatrimonio : 0;
  };
  const totalPriority = Math.min(100, goals.reduce((s, g) => {
    const currentAmount = getCatCurrentAmount(g.categoryId);
    return currentAmount < g.targetAmount ? s + g.priority : s;
  }, 0));
  return (
    <div className="shrink-0">
      <div className="flex flex-wrap items-center justify-between mb-3 gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <h2 className="text-base sm:text-lg font-bold text-text-primary whitespace-nowrap">Metas de Investimento</h2>
          {goals.length > 0 && totalPriority > 0 && (
            <span className="text-[10px] font-bold text-text-primary bg-elements/10 border border-border-base px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">{totalPriority}% do aporte direcionado</span>
          )}
        </div>
        <button onClick={() => setShowForm(true)} className="flex shrink-0 items-center gap-1 text-xs text-text-primary hover:text-text-primary cursor-pointer transition-colors font-semibold">
          <Plus size={12} strokeWidth={2.5} /> Nova Meta
        </button>
      </div>
      {goals.length === 0 ? (
        <div className="bg-bg-secondary border border-dashed border-border-base/40 rounded-xl px-4 py-6 text-center">
          <Target size={20} className="text-text-tertiary/30 mx-auto mb-2" />
          <p className="text-xs text-text-tertiary font-medium">Nenhuma meta definida ainda.</p>
          <p className="text-[11px] text-text-tertiary/50 mt-1">Crie uma meta para priorizar categorias no aporte.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {goals.map(g => (
            <GoalCard key={g.id} goal={g} category={categories.find(c => c.id === g.categoryId)}
              currentAmount={getCatCurrentAmount(g.categoryId)}
              onDelete={() => onDelete(g.id)} onEdit={() => setEditingGoal(g)}
              onUpdatePriority={p => onUpdate(g.id, { priority: p })} />
          ))}
        </div>
      )}
      {showForm && <GoalForm categories={categories} onSave={onAdd} onClose={() => setShowForm(false)} />}
      {editingGoal && (
        <GoalForm categories={categories} initial={editingGoal}
          onSave={data => onUpdate(editingGoal.id, data)} onClose={() => setEditingGoal(null)} />
      )}
    </div>
  );
}

// ── Add Transaction Modal ──────────────────────────────────────────────────────
// Transaction modal imported from TransactionModal.tsx

// ── Confirm Modal ──────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel = 'Excluir', onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-secondary border border-border-base rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-bold text-text-primary">{title}</h3>
          <p className="text-sm text-text-secondary">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="px-5 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Portfolio Summary cards ────────────────────────────────────────────────────
function PortfolioSummary({ holdings, prices, totalCost, transactions }: {
  holdings: IHolding[]; prices: PriceCache; totalCost: number; transactions: ITransaction[];
}) {
  const totalValue = holdings.reduce((s, h) => s + h.qty * (prices[h.ticker]?.price || h.avgPrice || 0), 0);
  const totalDividends = transactions.filter(t => t.type === 'dividend').reduce((s, t) => s + t.quantity * t.price, 0);
  const lucroCapital = totalValue - totalCost;
  const lucro = lucroCapital + totalDividends;
  const varPct = totalCost > 0 ? (lucro / totalCost) * 100 : 0;

  const cards = [
    { label: 'Patrimônio Atual', value: fmt(totalValue), colorClass: 'text-indigo-400' },
    { label: 'Custo Total', value: fmt(totalCost), colorClass: 'text-text-secondary' },
    { label: 'Proventos', value: fmt(totalDividends), colorClass: 'text-emerald-400' },
    { label: 'Lucro Total', value: (lucro >= 0 ? '+' : '') + fmt(lucro), colorClass: lucro >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Rentabilidade', value: (varPct >= 0 ? '+' : '') + varPct.toFixed(2) + '%', colorClass: varPct >= 0 ? 'text-emerald-400' : 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-bg-secondary border border-border-base rounded-2xl px-3 sm:px-5 py-3 sm:py-4 shadow-sm flex flex-col justify-center min-w-0 overflow-hidden">
          <p className="text-[10px] sm:text-xs font-medium text-text-tertiary mb-1 sm:mb-1.5 truncate">{c.label}</p>
          <p className={`text-base sm:text-xl font-bold font-mono tracking-tight truncate ${c.colorClass}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── DonutChart (pure SVG, no recharts bugs) ───────────────────────────────────
function DonutChart({ data, size = 160 }: { data: { name: string; value: number; fill: string }[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.3;           // raio do centro do anel
  const strokeW = size * 0.175;   // espessura do anel
  const circumference = 2 * Math.PI * r;
  const gap = data.length > 1 ? 2 : 0; // px de gap entre fatias
  const total = data.reduce((s, d) => s + d.value, 0);

  const segments = data.reduce((acc, d, i) => {
    const pct = d.value / total;
    const dash = Math.max(0, pct * circumference - gap);
    const prevPct = i > 0 ? data[i - 1].value / total : 0;
    const offset = i > 0 ? acc[i - 1].offset + prevPct * circumference : 0;
    acc.push({ ...d, dash, space: circumference - dash, offset });
    return acc;
  }, [] as (typeof data[0] & { dash: number; space: number; offset: number })[]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      {/* trilha de fundo */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
      {segments.map((seg, i) => (
        <circle
          key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={seg.fill} strokeWidth={strokeW}
          strokeDasharray={`${seg.dash} ${seg.space}`}
          strokeDashoffset={-seg.offset}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

// ── Portfolio Chart ────────────────────────────────────────────────────────────
function PortfolioChart({ categories, holdings, prices }: {
  categories: ICategory[]; holdings: IHolding[]; prices: PriceCache;
}) {
  const data = categories.map(c => {
    const value = holdings.filter(h => h.categoryId === c.id).reduce((s, h) => {
      const p = prices[h.ticker]?.price || (h.qty > 0 ? h.totalInvested / h.qty : 0);
      return s + h.qty * p;
    }, 0);
    return { name: c.name, value, fill: c.color };
  }).filter(d => d.value > 0);

  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-bg-secondary border border-border-base rounded-xl p-5 flex flex-col h-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-bold text-text-primary">Ativos na Carteira</h3>
        <div className="w-full sm:w-40">
          <StyledSelect
            value="all"
            onChange={() => {}}
            options={[{ value: 'all', label: 'Todos os tipos' }]}
          />
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 flex-1 px-4">
        <div className="shrink-0 relative flex items-center justify-center w-full sm:w-auto">
          <DonutChart data={data} size={160} />
        </div>

        <div className="flex-1 grid grid-cols-1 gap-3 min-w-[160px]">
          {data.map(d => (
            <div key={d.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: d.fill }} />
                <span className="text-xs font-semibold text-text-secondary truncate">{d.name}</span>
              </div>
              <span className="text-xs font-mono font-bold text-text-primary">{(d.value / total * 100).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Evolution Chart ────────────────────────────────────────────────────────────
function EvolutionChart({ transactions, prices, holdings }: { transactions: ITransaction[]; prices: PriceCache, holdings: IHolding[] }) {
  const [period, setPeriod] = useState<'12m' | 'all'>('12m');
  const [hiddenSeries, setHiddenSeries] = useState({ valorAplicado: false, ganhoCapital: false });

  const data = useMemo(() => {
    if (transactions.length === 0) return [];
    
    // Sort transactions by date
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    
    const timeline: { date: string; rawDate: string; valorAplicado: number; ganhoCapital: number; valorAtivos: number }[] = [];
    const holdMap = new Map<string, { qty: number; totalInvested: number }>();
    
    let currentCusto = 0;
    
    for (const t of sorted) {
      const cur = holdMap.get(t.ticker) || { qty: 0, totalInvested: 0 };
      
      if (t.type === 'buy') {
        const cost = t.quantity * t.price + t.otherCosts;
        currentCusto += cost;
        holdMap.set(t.ticker, { qty: cur.qty + t.quantity, totalInvested: cur.totalInvested + cost });
      } else {
        // We'll approximate cost reduction (avg price reduction)
        const avg = cur.qty > 0 ? cur.totalInvested / cur.qty : 0;
        const costReduction = avg * t.quantity;
        currentCusto -= costReduction;
        holdMap.set(t.ticker, { qty: Math.max(0, cur.qty - t.quantity), totalInvested: Math.max(0, cur.totalInvested - costReduction) });
      }
      
      // Calculate current value based on the most recent prices (which is an approximation since we don't have historical prices, but gives an idea of accumulated wealth)
      let currentValor = 0;
      holdMap.forEach((val, ticker) => {
        let currentPrice = prices[ticker]?.price || 0;
        
        // Se for Renda Fixa, calcula o valor EXATO retroativo até a data deste ponto no gráfico
        if (prices[ticker]?._isRF) {
          const holding = holdings.find(h => h.ticker === ticker); 
          if (holding) {
             const buyTxs = transactions.filter(tx => tx.ticker === ticker && tx.type === 'buy' && new Date(tx.date) <= new Date(t.date));
             let totalVal = 0;
             buyTxs.forEach(tx => {
               const cost = tx.quantity * tx.price + tx.otherCosts;
               totalVal += calcRFCurrentPrice(cost, holding.meta, tx.date, cachedMacroRates, t.date);
             });
             const totalBuyQty = buyTxs.reduce((sum, tx) => sum + tx.quantity, 0);
             const proportion = totalBuyQty > 0 ? (val.qty / totalBuyQty) : 0;
             currentPrice = val.qty > 0 ? (totalVal * proportion) / val.qty : 0;
          }
        }
        
        currentValor += val.qty * (currentPrice > 0 ? currentPrice : (val.totalInvested / val.qty || 0)); // fallback to avg cost if no price
      });
      
      timeline.push({
        date: new Date(t.date).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' }),
        rawDate: t.date,
        valorAplicado: currentCusto,
        ganhoCapital: currentValor - currentCusto,
        valorAtivos: currentValor
      });
    }
    
    // Deduplicate by date keeping the last entry per month/year
    const deduped: typeof timeline = [];
    timeline.forEach(t => {
      if (deduped.length > 0 && deduped[deduped.length - 1].date === t.date) {
        deduped[deduped.length - 1] = t;
      } else {
        deduped.push(t);
      }
    });
    
    // Filter by period
    if (period === '12m') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return deduped.filter(d => new Date(d.rawDate) >= oneYearAgo);
    }
    
    return deduped;
  }, [transactions, prices, period, holdings]);

  if (data.length === 0) return null;

  return (
    <div className="bg-bg-secondary border border-border-base rounded-xl p-5 flex flex-col h-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-bold text-text-primary">Evolução do Patrimônio</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-36">
            <StyledSelect
              value={period}
              onChange={v => setPeriod(v as '12m' | 'all')}
              options={[
                { value: '12m', label: '12 Meses' },
                { value: 'all', label: 'Desde o início' },
              ]}
            />
          </div>
          <div className="w-full sm:w-36">
            <StyledSelect
              value="all"
              onChange={() => {}}
              options={[{ value: 'all', label: 'Todos os tipos' }]}
            />
          </div>
        </div>
      </div>
      
      <div className="flex gap-6 mb-4 items-center justify-center">
        <div 
          className={`flex items-center gap-2 cursor-pointer transition-opacity ${hiddenSeries.valorAplicado ? 'opacity-40 hover:opacity-70' : 'opacity-100 hover:opacity-80'}`}
          onClick={() => setHiddenSeries(s => ({ ...s, valorAplicado: !s.valorAplicado }))}
        >
          <div className="w-4 h-1.5 rounded-sm bg-[#10b981]" />
          <span className="text-xs text-text-tertiary select-none">Valor aplicado</span>
        </div>
        <div 
          className={`flex items-center gap-2 cursor-pointer transition-opacity ${hiddenSeries.ganhoCapital ? 'opacity-40 hover:opacity-70' : 'opacity-100 hover:opacity-80'}`}
          onClick={() => setHiddenSeries(s => ({ ...s, ganhoCapital: !s.ganhoCapital }))}
        >
          <div className="w-4 h-1.5 rounded-sm bg-[#a7f3d0]" />
          <span className="text-xs text-text-tertiary select-none">Ganho de Capital</span>
        </div>
      </div>

      <div className="flex-1 min-h-[220px] -ml-4 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => 'R$ ' + (val/1000).toFixed(1) + 'k'} />
            <Tooltip 
              cursor={{fill: '#2a323c', opacity: 0.4}}
              contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              formatter={(value: unknown) => fmt(Number(value))}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
            />
            {!hiddenSeries.valorAplicado && (
              <Bar dataKey="valorAplicado" name="Valor Aplicado" stackId="a" fill="#10b981" radius={hiddenSeries.ganhoCapital ? [4, 4, 4, 4] : [0, 0, 4, 4]} barSize={32} />
            )}
            {!hiddenSeries.ganhoCapital && (
              <Bar dataKey="ganhoCapital" name="Ganho de Capital" stackId="a" fill="#a7f3d0" radius={hiddenSeries.valorAplicado ? [4, 4, 4, 4] : [4, 4, 0, 0]} barSize={32} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Category Section (Meus Ativos per category) ───────────────────────────────
function CategorySection({ cat, holdings, prices, totalPortfolioValue, onUpdate, onDeleteTicker, onAddTransaction, onEditTicker }: {
  cat: ICategory; holdings: IHolding[]; prices: PriceCache;
  totalPortfolioValue: number;
  onUpdate: (id: string, u: Partial<ICategory>) => void;
  onDeleteTicker: (ticker: string) => void;
  onAddTransaction: (ticker?: string, categoryId?: string) => void;
  onEditTicker: (ticker: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ ticker: string; name: string } | null>(null);


  const rows = holdings.map(h => {
    const pd = prices[h.ticker];
    const currentPrice = pd?.price || h.avgPrice || 0;
    const changePercent = pd?.changePercent || 0;
    const name = pd?.name || h.ticker;
    const logoUrl = pd?.logoUrl;
    const saldo = h.qty * currentPrice;
    const variacaoPct = h.avgPrice > 0 && currentPrice > 0 ? (currentPrice / h.avgPrice - 1) * 100 : null;
    const pctCarteira = totalPortfolioValue > 0 && saldo > 0 ? saldo / totalPortfolioValue * 100 : null;
    return { ...h, name, currentPrice, changePercent, saldo, variacaoPct, pctCarteira, logoUrl };
  });

  const totalValue = rows.reduce((s, r) => s + r.saldo, 0);
  const saldoComVar = rows.filter(r => r.variacaoPct !== null).reduce((s, r) => s + r.saldo, 0);
  const weightedVar = saldoComVar > 0 ? rows.filter(r => r.variacaoPct !== null).reduce((s, r) => s + r.variacaoPct! * r.saldo, 0) / saldoComVar : null;
  const pctCart = totalPortfolioValue > 0 && totalValue > 0 ? totalValue / totalPortfolioValue * 100 : null;

  return (
    <div className="bg-bg-secondary border border-border-base rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 border-b border-border-base/30 cursor-pointer select-none bg-bg-secondary hover:bg-elements/10 transition-colors"
        onClick={() => setCollapsed(v => !v)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-bold" style={{ color: cat.color }}>{cat.name}</span>
          {collapsed ? <ChevronDown size={12} className="text-text-tertiary/50" /> : <ChevronUp size={12} className="text-text-tertiary/50" />}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6 text-right w-full sm:w-auto mt-2 sm:mt-0 justify-end" onClick={e => e.stopPropagation()}>
          <div className="sm:w-12 flex flex-col justify-end">
            <div className="text-[9px] text-text-tertiary/50 uppercase tracking-wider">Ativos</div>
            <div className="text-xs font-bold font-mono text-text-primary">{rows.length}</div>
          </div>
          <div className="sm:w-24 flex flex-col justify-end">
            <div className="text-[9px] text-text-tertiary/50 uppercase tracking-wider">Valor Total</div>
            <div className="text-xs font-bold font-mono text-text-primary">{totalValue > 0 ? fmt(totalValue) : '—'}</div>
          </div>
          <div className="sm:w-20 flex flex-col justify-end">
            <div className="text-[9px] text-text-tertiary/50 uppercase tracking-wider">Variação</div>
            <div className={`text-xs font-bold font-mono ${weightedVar !== null ? (weightedVar >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-text-tertiary/50'}`}>
              {weightedVar !== null ? `${weightedVar >= 0 ? '+' : ''}${weightedVar.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div className="sm:w-28 flex flex-col justify-end">
            <div className="text-[9px] text-text-tertiary/50 uppercase tracking-wider">% Cart / Ideal</div>
            <div className="text-xs font-bold font-mono text-text-primary flex items-center justify-end gap-1">
              <span>{pctCart !== null ? pctCart.toFixed(1) + '%' : '—'}</span>
              <span className="text-text-tertiary/40">/</span>
              <span className="w-12 text-right">
                <Editable value={fmtP(cat.idealPercent)} onSave={v => onUpdate(cat.id, { idealPercent: parseFmt(v) })} right />
              </span>
            </div>
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Em Carteira */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-border-base border-collapse min-w-[580px]">
              <thead>
                <tr className="bg-bg-secondary">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Ativo</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Qtd</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Preço Médio</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Preço Atual</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Variação</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Saldo</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">% Cart</th>
                  <th className="w-14 px-3 py-2.5 text-center text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.ticker} className="hover:bg-elements/10 transition-colors group">
                    <td className="px-4 py-2.5 border border-border-base">
                      <div className="flex items-center gap-2">
                        {r.logoUrl ? (
                          <div className="w-8 h-8 rounded-md bg-elements/10 flex items-center justify-center overflow-hidden shrink-0 border border-border-base/50">
                            <img src={r.logoUrl} alt={r.ticker} className="w-6 h-6 object-contain" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-elements flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0">
                            {r.ticker.substring(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-text-primary truncate">{r.ticker}</div>
                          <div className="text-[9px] text-text-tertiary truncate max-w-[90px]">{r.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-secondary border border-border-base">{r.qty > 0 ? r.qty : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-secondary border border-border-base">{r.avgPrice > 0 ? fmt(r.avgPrice) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-primary border border-border-base">{r.currentPrice > 0 ? fmt(r.currentPrice) : <span className="text-text-tertiary/40">-</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono border border-border-base">
                      {r.variacaoPct !== null
                        ? <span className={`font-semibold ${r.variacaoPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.variacaoPct >= 0 ? '+' : ''}{r.variacaoPct.toFixed(2)}%</span>
                        : <span className="text-text-tertiary/40">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-primary border border-border-base">{r.saldo > 0 ? fmt(r.saldo) : <span className="text-text-tertiary/40">-</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-tertiary border border-border-base">{r.pctCarteira !== null ? r.pctCarteira.toFixed(2) + '%' : <span className="text-text-tertiary/40">-</span>}</td>
                    <td className="px-3 py-2.5 border border-border-base">
                      <div className="flex items-center justify-end gap-2.5 transition-opacity">
                        <button onClick={() => onAddTransaction(r.ticker, cat.id)} title="Novo lançamento"
                          className="text-text-tertiary/50 hover:text-indigo-400 cursor-pointer transition-colors"><Plus size={14} strokeWidth={2.5} /></button>
                        <button onClick={() => onEditTicker(r.ticker)} title="Editar Lançamento"
                          className="text-text-tertiary/50 hover:text-emerald-400 cursor-pointer transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => setConfirmDelete({ ticker: r.ticker, name: r.name })}
                          className="text-text-tertiary/50 hover:text-red-400 cursor-pointer transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-5 text-center text-xs text-text-tertiary/40 border border-border-base">Nenhum ativo em carteira · Adicione um lançamento para começar</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-b border-border-base/20">
            <button onClick={() => onAddTransaction(undefined, cat.id)}
              className="text-xs text-text-tertiary/40 hover:text-text-primary cursor-pointer transition-colors flex items-center gap-1">
              <Plus size={11} strokeWidth={2.5} /> Adicionar Lançamento
            </button>
          </div>

        </>
      )}

      {confirmDelete !== null && (
        <ConfirmModal
          title={`Excluir ${confirmDelete.ticker}`}
          message={`Todos os lançamentos de ${confirmDelete.name || confirmDelete.ticker} serão removidos permanentemente. Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir tudo"
          onConfirm={() => { onDeleteTicker(confirmDelete.ticker); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ── Watchlist Section (Na Mira for Planejamento tab) ─────────────────────────
function WatchlistSection({ categories, watchlist, onAddWatchlist, onDeleteWatchlist, onRefreshWatchlist, onEditWatchlistTicker }: {
  categories: ICategory[]; watchlist: IWatchlistItem[];
  onAddWatchlist: (catId: string, ticker: string) => Promise<void>;
  onDeleteWatchlist: (id: string) => void;
  onRefreshWatchlist: (id: string) => Promise<void>;
  onEditWatchlistTicker: (id: string, newTicker: string) => void;
}) {
  const [tableCollapsed, setTableCollapsed] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    categories.forEach(c => initial[c.id] = true);
    return initial;
  });
  const toggleCat = (id: string) => setCollapsedCats(prev => ({ ...prev, [id]: !prev[id] }));
  const [addingCatId, setAddingCatId] = useState<string | null>(null);
  const [watchInput, setWatchInput] = useState('');
  const [watchLoading, setWatchLoading] = useState(false);
  const [refreshingWatch, setRefreshingWatch] = useState<string | null>(null);


  const submitWatch = async (catId: string) => {
    if (!watchInput.trim()) { setAddingCatId(null); return; }
    setWatchLoading(true);
    await onAddWatchlist(catId, watchInput.trim().toUpperCase());
    setWatchInput(''); setAddingCatId(null); setWatchLoading(false);
  };
  const handleRefreshWatch = async (id: string) => {
    setRefreshingWatch(id);
    await onRefreshWatchlist(id);
    setRefreshingWatch(null);
  };

  if (watchlist.length === 0 && addingCatId === null) {
    return (
      <div className="bg-bg-secondary border border-border-base rounded-xl p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-bold text-text-primary">Ativos na Mira</h2>
        </div>
        <div className="flex gap-2 flex-wrap mt-2">
          {categories.map(cat => (
             <button key={cat.id} onClick={() => setAddingCatId(cat.id)}
               className="text-xs text-text-tertiary hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-1 rounded px-2 py-1">
               <Plus size={11} /> Adicionar em {cat.name}
             </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-border-base rounded-xl overflow-hidden shrink-0">
      <div onClick={() => setTableCollapsed(!tableCollapsed)} className="px-4 py-3 border-b border-border-base bg-bg-secondary flex items-center justify-between cursor-pointer hover:bg-elements/10 transition-colors">
        <span className="text-sm sm:text-base font-bold text-text-primary">Ativos na Mira</span>
        {tableCollapsed ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronUp size={14} className="text-text-tertiary" />}
      </div>
      {!tableCollapsed && (<div>
      
      {categories.map(cat => {
        const catWatchlist = watchlist.filter(w => w.categoryId === cat.id);
        return (
          <div key={cat.id} className="border-b border-border-base/10 last:border-0">
            <div onClick={() => toggleCat(cat.id)} className="px-4 py-2 bg-elements/10 flex items-center justify-between cursor-pointer hover:bg-elements/20 transition-colors">
              <span className="text-sm font-bold" style={{ color: cat.color }}>{cat.name}</span>
              {collapsedCats[cat.id] ? <ChevronDown size={12} className="text-text-tertiary/50" /> : <ChevronUp size={12} className="text-text-tertiary/50" />}
            </div>
            {!collapsedCats[cat.id] && catWatchlist.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-border-base border-collapse min-w-[380px]">
                  <thead>
                    <tr className="bg-bg-secondary">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Ticker</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Nome</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Preço Atual</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Variação Dia</th>
                      <th className="w-20 px-3 py-2.5 text-right text-[10px] font-semibold text-text-tertiary uppercase tracking-wider border border-border-base">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-bg-primary">
                    {catWatchlist.map(w => (
                      <tr key={w.id} className="hover:bg-elements/10 transition-colors group">
                        <td className="px-4 py-2.5 font-mono font-bold text-text-primary border border-border-base">
                          <div className="flex items-center gap-2">
                            {w.logoUrl ? (
                              <div className="w-8 h-8 rounded-md bg-elements/10 flex items-center justify-center overflow-hidden shrink-0 border border-border-base/50">
                                <img src={w.logoUrl} alt={w.ticker} className="w-6 h-6 object-contain" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-md bg-elements flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0">
                                {w.ticker.substring(0, 2)}
                              </div>
                            )}
                            <span>{w.ticker}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-text-tertiary truncate max-w-[140px] border border-border-base">{w.name}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-text-secondary border border-border-base">{w.price > 0 ? fmt(w.price) : '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono border border-border-base">
                          {w.price > 0
                            ? <span className={`font-semibold ${w.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{w.changePercent >= 0 ? '+' : ''}{w.changePercent.toFixed(2)}%</span>
                            : <span className="text-text-tertiary/40">-</span>}
                        </td>
                        <td className="px-3 py-2.5 border border-border-base">
                          <div className="flex items-center justify-end gap-3 transition-opacity">
                            <button onClick={() => {
                                const newTicker = window.prompt('Editar ticker do ativo:', w.ticker);
                                if (newTicker && newTicker.trim() !== '') onEditWatchlistTicker(w.id, newTicker.trim().toUpperCase());
                              }}
                              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer" title="Editar ticker">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleRefreshWatch(w.id)}
                              className={`text-text-secondary hover:text-text-primary transition-colors cursor-pointer ${refreshingWatch === w.id ? 'animate-spin' : ''}`} title="Atualizar preço">
                              <RefreshCw size={14} />
                            </button>
                            <button onClick={() => onDeleteWatchlist(w.id)} className="text-text-secondary hover:text-red-400 cursor-pointer transition-colors" title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {!collapsedCats[cat.id] && (
              <div className="px-4 py-2.5">
                {addingCatId === cat.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Ex: PETR4" value={watchInput} onChange={e => setWatchInput(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter') submitWatch(cat.id); else if (e.key === 'Escape') setAddingCatId(null); }}
                        autoFocus className="bg-bg-primary border border-border-base rounded px-2 py-1 text-xs w-28 uppercase focus:outline-none focus:border-neutral-500" />
                      <button onClick={() => submitWatch(cat.id)} disabled={watchLoading || !watchInput.trim()}
                        className="bg-text-primary hover:bg-text-primary/90 text-bg-primary px-2 py-1 rounded text-[10px] font-semibold cursor-pointer disabled:opacity-50">
                        {watchLoading ? 'Buscando...' : 'Salvar'}
                      </button>
                      <button onClick={() => setAddingCatId(null)} className="text-text-tertiary hover:text-text-primary px-1 cursor-pointer"><X size={12} /></button>
                    </div>
                    <span className="text-[9px] text-text-tertiary/50">O ticker deve existir na B3 (ex: BBDC4) ou Cripto (ex: BTC-USD).</span>
                  </div>
                ) : (
                  <button onClick={() => setAddingCatId(cat.id)}
                    className="text-xs text-text-tertiary/40 hover:text-text-primary cursor-pointer transition-colors flex items-center gap-1">
                    <Plus size={11} strokeWidth={2.5} /> Adicionar Interesse
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>)}
    </div>
  );
}

function TransactionsTab({ transactions, categories, onEdit, onDelete }: {
  transactions: ITransaction[];
  categories: ICategory[];
  onEdit: (t: ITransaction) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<ITransaction | null>(null);
  const [period, setPeriod] = useState<'12m' | 'all'>('12m');
  const [categoryId, setCategoryId] = useState<string>('all');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (categoryId !== 'all' && t.categoryId !== categoryId) return false;
      if (period === '12m') {
        const d = new Date(t.date);
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        if (d < cutoff) return false;
      }
      return true;
    });
  }, [transactions, period, categoryId]);

  const chartData = useMemo(() => {
    const map = new Map<string, { month: string; compras: number; vendas: number }>();
    for (const t of filteredTransactions) {
      const m = t.date.slice(0, 7); // YYYY-MM
      const cur = map.get(m) || { month: m, compras: 0, vendas: 0 };
      const val = t.quantity * t.price + t.otherCosts;
      if (t.type === 'buy') cur.compras += val;
      if (t.type === 'sell') cur.vendas += val;
      map.set(m, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).map(d => ({
      ...d,
      label: d.month.split('-').reverse().join('/') // MM/YYYY
    }));
  }, [filteredTransactions]);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-bg-secondary border border-border-base rounded-xl p-5 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-text-primary">Consolidação de aportes</h3>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <div className="w-full sm:w-36">
              <StyledSelect
                value={period}
                onChange={v => setPeriod(v as '12m' | 'all')}
                options={[
                  { value: '12m', label: '12 Meses' },
                  { value: 'all', label: 'Desde o início' },
                ]}
              />
            </div>
            <div className="w-full sm:w-36">
              <StyledSelect
                value={categoryId}
                onChange={setCategoryId}
                options={[
                  { value: 'all', label: 'Todos os tipos' },
                  ...[...categories].sort((a, b) => a.sortOrder - b.sortOrder).map(c => ({ value: c.id, label: c.name }))
                ]}
              />
            </div>
          </div>
        </div>
        <div className="h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => 'R$ ' + (val/1000).toFixed(1) + 'k'} />
              <Tooltip 
                cursor={{fill: '#2a323c', opacity: 0.4}}
                contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                formatter={(value: unknown) => fmt(Number(value))}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              />
              <Bar dataKey="compras" name="Compras" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="vendas" name="Vendas" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="flex flex-col gap-3">
        {[...categories].sort((a, b) => a.sortOrder - b.sortOrder).map(cat => (
          <TransactionCategorySection 
            key={cat.id} 
            cat={cat} 
            transactions={transactions} 
            onEdit={onEdit} 
            onDelete={setConfirmDelete} 
          />
        ))}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Excluir lançamento"
          message={`Tem certeza que deseja excluir o lançamento de ${confirmDelete.ticker}? Esta ação não pode ser desfeita.`}
          onConfirm={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function TransactionCategorySection({ cat, transactions, onEdit, onDelete }: {
  cat: ICategory; transactions: ITransaction[]; 
  onEdit: (t: ITransaction) => void; onDelete: (t: ITransaction) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const catTxs = transactions.filter(t => t.categoryId === cat.id).sort((a, b) => b.date.localeCompare(a.date));
  if (catTxs.length === 0) return null;

  return (
    <div className="bg-bg-secondary border border-border-base rounded-xl overflow-hidden">
      <div 
        className="flex items-center justify-between p-4 bg-bg-secondary border-b border-border-base/30 cursor-pointer hover:bg-elements/10 transition-colors"
        onClick={() => setCollapsed(v => !v)}
      >
        <h4 className="font-bold text-text-primary flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ background: cat.color }} />
          {cat.name}
          {collapsed ? <ChevronDown size={12} className="text-text-tertiary/50 ml-2" /> : <ChevronUp size={12} className="text-text-tertiary/50 ml-2" />}
        </h4>
        <span className="text-xs text-text-secondary">{catTxs.length} lançamentos</span>
      </div>
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-base/50 bg-bg-primary/50">
                <th className="px-4 py-3 text-xs font-semibold text-text-tertiary">Ativo</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-tertiary">Tipo</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-tertiary">Data</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-tertiary text-right">Qtd</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-tertiary text-right">Preço</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-tertiary text-right">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-text-tertiary text-center">Opções</th>
              </tr>
            </thead>
            <tbody>
              {catTxs.map(t => (
                <tr key={t.id} className="border-b border-border-base/50 last:border-0 hover:bg-bg-primary transition-colors">
                  <td className="px-4 py-3 text-xs sm:text-sm font-bold text-text-primary">{t.ticker}</td>
                  <td className="px-4 py-3 text-xs sm:text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${t.type === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : t.type === 'sell' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      {t.type === 'buy' ? 'Compra' : t.type === 'sell' ? 'Venda' : 'Provento'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs sm:text-sm text-text-secondary">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-xs sm:text-sm font-mono text-text-primary text-right">{t.quantity}</td>
                  <td className="px-4 py-3 text-xs sm:text-sm font-mono text-text-primary text-right">{fmt(t.price)}</td>
                  <td className="px-4 py-3 text-xs sm:text-sm font-mono text-text-primary text-right">{fmt(t.quantity * t.price + t.otherCosts)}</td>
                  <td className="px-4 py-3 text-xs sm:text-sm text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(t); }} className="text-text-tertiary hover:text-indigo-400 transition-colors cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(t); }} className="text-text-tertiary hover:text-rose-400 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────
export function InvestmentView() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [goals, setGoals] = useState<IGoal[]>(loadGoals);
  const [watchlist, setWatchlist] = useState<IWatchlistItem[]>(loadWatchlist);
  const [priceCache, setPriceCache] = useState<PriceCache>(loadPriceCache);
  const [config, setConfig] = useState<PConfig>({
    investPatrimonio: Number(localStorage.getItem(INVEST_PAT_KEY)) || 0,
    patrimonio: 0, aportar: 0,
    caixaPercent: 5, investPercent: 15, despFixasPercent: 50, despVariaveisPercent: 30,
  });
  const [loading, setLoading] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [addModal, setAddModal] = useState<{ ticker?: string; categoryId?: string } | null>(null);
  const [editingTx, setEditingTx] = useState<ITransaction | null>(null);
  const [historyTicker, setHistoryTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'resumo' | 'planejamento' | 'lancamentos'>('resumo');
  const [userId, setUserId] = useState<string | null>(null);
  const seededRef = useRef(false);
  const priceCacheRef = useRef(priceCache);

  useEffect(() => {
    priceCacheRef.current = priceCache;
  }, [priceCache]);

  // Derived state
  const holdings = useMemo(() => calcHoldings(transactions), [transactions]);
  const totalCost = useMemo(() => holdings.reduce((s, h) => s + h.totalInvested, 0), [holdings]);
  const totalValue = useMemo(
    () => holdings.reduce((s, h) => s + h.qty * (priceCache[h.ticker]?.price || 0), 0),
    [holdings, priceCache]
  );
  const enrichedCategories = useMemo(() => categories.map(c => {
    const catValue = holdings.filter(h => h.categoryId === c.id).reduce((s, h) => s + h.qty * (priceCache[h.ticker]?.price || 0), 0);
    const currentPercent = totalValue > 0 ? catValue / totalValue * 100 : 0;
    return { ...c, currentPercent };
  }), [categories, holdings, priceCache, totalValue]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const [{ data: cats }, { data: txData }, { data: cfgData }] = await Promise.all([
        supabase.from('investment_categories').select('*').eq('user_id', user.id).order('sort_order'),
        supabase.from('investment_transactions').select('*').eq('user_id', user.id).order('date'),
        supabase.from('portfolio_config').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (cats && cats.length > 0) {
        setCategories(cats.map(mapCat));
      } else if (!seededRef.current) {
        seededRef.current = true;
        const defaults = DEFAULT_CATEGORIES.map((d, i) => ({
          id: crypto.randomUUID(), user_id: user.id,
          name: d.name, ideal_percent: d.idealPercent, current_value: 0,
          color: d.color, sort_order: i,
        }));
        await supabase.from('investment_categories').insert(defaults);
        setCategories(defaults.map((d, i) => ({
          id: d.id, name: d.name, idealPercent: DEFAULT_CATEGORIES[i].idealPercent,
          currentPercent: 0, color: d.color, sortOrder: i,
        })));
      }

      if (txData && txData.length > 0) setTransactions(txData.map(mapTransaction));

      if (cfgData) {
        setConfig(prev => ({
          ...prev,
          patrimonio: Number(cfgData.patrimonio) || 0,
          aportar: Number(cfgData.aportar) || 0,
          caixaPercent: Number(cfgData.caixa_percent) || 5,
          investPercent: Number(cfgData.invest_percent) || 15,
          despFixasPercent: Number(cfgData.desp_fixas_percent) || 50,
          despVariaveisPercent: Number(cfgData.desp_variaveis_percent) || 30,
        }));
      }
      setLoading(false);
    };
    load();
  }, []);

  // Fetch prices whenever the set of tickers changes
  useEffect(() => {
    const tickers = holdings.map(h => h.ticker);
    if (tickers.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingPrices(true);
    Promise.all([fetchPrices(tickers, priceCacheRef.current), getMacroRates()]).then(([cache, macroRates]) => {
      const nextCache = { ...cache };
      let hasChanges = false;
      
      // Inject RF calculated prices
      holdings.forEach(h => {
        if (h.assetType === 'renda_fixa') {
          // Calcula o valor total EXATO somando cada aporte individualmente
          const buyTxs = transactions.filter(t => t.ticker === h.ticker && t.type === 'buy');
          let totalBrutoFuturo = 0;
          buyTxs.forEach(t => {
            const cost = t.quantity * t.price + t.otherCosts;
            totalBrutoFuturo += calcRFCurrentPrice(cost, h.meta, t.date, macroRates);
          });
          
          // Se houve vendas (resgates parciais), ajustamos o valor total proporcionalmente à quantidade restante
          const totalBuyQty = buyTxs.reduce((sum, t) => sum + t.quantity, 0);
          const proportion = totalBuyQty > 0 ? (h.qty / totalBuyQty) : 0;
          const adjustedTotal = totalBrutoFuturo * proportion;
          
          const newPrice = h.qty > 0 ? adjustedTotal / h.qty : 0;
          nextCache[h.ticker] = {
            ...nextCache[h.ticker],
            price: newPrice,
            changePercent: h.avgPrice > 0 ? ((newPrice / h.avgPrice) - 1) * 100 : 0,
            name: h.ticker,
            fetchedAt: Date.now(),
            _isRF: true
          } as PriceData & { _isRF?: boolean };
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setPriceCache(nextCache);
        persistPriceCache(nextCache);
      } else {
        setPriceCache(cache);
        persistPriceCache(cache);
      }
      setLoadingPrices(false);
    });
  }, [holdings, transactions]);

  const saveConfig = useCallback(async (updates: Partial<PConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      if (updates.investPatrimonio !== undefined) {
        localStorage.setItem(INVEST_PAT_KEY, String(updates.investPatrimonio));
      } else if (userId) {
        supabase.from('portfolio_config').upsert({
          user_id: userId,
          patrimonio: next.patrimonio, aportar: next.aportar,
          caixa_percent: next.caixaPercent, invest_percent: next.investPercent,
          desp_fixas_percent: next.despFixasPercent, desp_variaveis_percent: next.despVariaveisPercent,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' }).then(() => {});
      }
      return next;
    });
  }, [userId]);

  const updateCat = useCallback(async (id: string, updates: Partial<ICategory>) => {
    setCategories(p => p.map(c => c.id === id ? { ...c, ...updates } : c));
    const db: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.idealPercent !== undefined) db.ideal_percent = updates.idealPercent;
    if (updates.currentPercent !== undefined) db.current_value = updates.currentPercent;
    await supabase.from('investment_categories').update(db).eq('id', id);
  }, []);

  const addTransaction = useCallback(async (data: TransactionData) => {
    if (!userId) return;
    const id = crypto.randomUUID();
    setTransactions(prev => [...prev, { ...data, id }]);
    const { error } = await supabase.from('investment_transactions').insert({
      id, user_id: userId, ticker: data.ticker,
      category_id: data.categoryId || null,
      type: data.type, date: data.date,
      quantity: data.quantity, price: data.price, other_costs: data.otherCosts,
      asset_type: data.assetType, meta: data.meta,
    });
    if (error) {
      console.error('Supabase Insert Error:', error);
      alert('Erro ao salvar no banco: ' + error.message);
    }
  }, [userId]);

  const deleteTransactionsByTicker = useCallback(async (ticker: string) => {
    setTransactions(prev => prev.filter(t => t.ticker !== ticker));
    if (userId) await supabase.from('investment_transactions').delete().eq('user_id', userId).eq('ticker', ticker);
  }, [userId]);

  const deleteTransaction = useCallback(async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (userId) await supabase.from('investment_transactions').delete().eq('id', id);
  }, [userId]);

  const addGoal = useCallback((g: Omit<IGoal, 'id'>) => {
    const next = [...goals, { ...g, id: crypto.randomUUID() }];
    setGoals(next); persistGoals(next);
  }, [goals]);

  const deleteGoal = useCallback((id: string) => {
    const next = goals.filter(g => g.id !== id);
    setGoals(next); persistGoals(next);
  }, [goals]);

  const updateGoal = useCallback((id: string, updates: Partial<IGoal>) => {
    const next = goals.map(g => g.id === id ? { ...g, ...updates } : g);
    setGoals(next); persistGoals(next);
  }, [goals]);

  const editWatchlistTicker = useCallback(async (id: string, newTicker: string) => {
    setWatchlist(prev => {
      const next = prev.map(w => w.id === id ? { ...w, ticker: newTicker } : w);
      persistWatchlist(next);
      return next;
    });
    
    const quote = await fetchQuote(newTicker);
    if (quote) {
      setWatchlist(prev => {
        const next = prev.map(w => w.id === id ? { ...w, name: quote.name, price: quote.price, changePercent: quote.changePercent, logoUrl: quote.logoUrl } : w);
        persistWatchlist(next);
        return next;
      });
    }
  }, []);

  const addWatchlistItem = useCallback(async (categoryId: string, ticker: string) => {
    const quote = await fetchQuote(ticker);
    const item: IWatchlistItem = { id: crypto.randomUUID(), categoryId, ticker, name: quote?.name || ticker, price: quote?.price || 0, changePercent: quote?.changePercent || 0, logoUrl: quote?.logoUrl };
    setWatchlist(prev => { const next = [...prev, item]; persistWatchlist(next); return next; });
  }, []);

  const deleteWatchlistItem = useCallback((id: string) => {
    setWatchlist(prev => { const next = prev.filter(w => w.id !== id); persistWatchlist(next); return next; });
  }, []);

  const refreshWatchlistItem = useCallback(async (id: string) => {
    const item = watchlist.find(w => w.id === id);
    if (!item) return;
    const quote = await fetchQuote(item.ticker);
    if (!quote) return;
    setWatchlist(prev => { const next = prev.map(w => w.id === id ? { ...w, name: quote.name, price: quote.price, changePercent: quote.changePercent, logoUrl: quote.logoUrl } : w); persistWatchlist(next); return next; });
  }, [watchlist]);

  const investPatrimonio = totalValue > 0 ? totalValue : config.investPatrimonio;

  const investRows: DistRow[] = enrichedCategories.map(c => {
    const goal = goals.find(g => g.categoryId === c.id);
    const catValue = holdings.filter(h => h.categoryId === c.id).reduce((s, h) => s + h.qty * (priceCache[h.ticker]?.price || 0), 0);
    return {
      label: c.name,
      currentPct: c.currentPercent,
      idealPct: c.idealPercent,
      onIdealCh: (v: number) => updateCat(c.id, { idealPercent: v }),
      goal: goal ? { label: goal.label, targetAmount: goal.targetAmount, currentAmount: catValue, priority: goal.priority } : undefined,
    };
  });

  const moneyRows: DistRow[] = [
    { label: 'Valor em Caixa (no banco)', currentPct: 0, idealPct: config.caixaPercent, onIdealCh: v => saveConfig({ caixaPercent: v }) },
    { label: 'Investimentos', currentPct: 0, idealPct: config.investPercent, onIdealCh: v => saveConfig({ investPercent: v }) },
    { label: 'Despesas Fixas', currentPct: 0, idealPct: config.despFixasPercent, onIdealCh: v => saveConfig({ despFixasPercent: v }) },
    { label: 'Despesas Variáveis', currentPct: 0, idealPct: config.despVariaveisPercent, onIdealCh: v => saveConfig({ despVariaveisPercent: v }) },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 overflow-x-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
          <span className="text-xl font-bold text-text-primary">Controle de Investimentos</span>
          <div className="flex bg-bg-primary rounded-lg p-1 border border-border-base">
            <button
              onClick={() => setActiveTab('resumo')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${activeTab === 'resumo' ? 'bg-text-primary text-bg-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
            >
              Resumo
            </button>
            <button
              onClick={() => setActiveTab('planejamento')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${activeTab === 'planejamento' ? 'bg-text-primary text-bg-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
            >
              Planejamento
            </button>
            <button
              onClick={() => setActiveTab('lancamentos')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${activeTab === 'lancamentos' ? 'bg-text-primary text-bg-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
            >
              Lançamentos
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loadingPrices && <span className="text-text-tertiary/50 text-xs animate-pulse">Atualizando cotações...</span>}
          {loading && <span className="text-text-tertiary text-xs animate-pulse">Carregando...</span>}

        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-12 sm:pb-8 flex flex-col gap-6">
        {activeTab === 'resumo' && (
          <>
            <PortfolioSummary holdings={holdings} prices={priceCache} totalCost={totalCost} transactions={transactions} />

            {holdings.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <EvolutionChart transactions={transactions} prices={priceCache} holdings={holdings} />
                <PortfolioChart categories={categories} holdings={holdings} prices={priceCache} />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-text-primary">Meus Ativos</h2>
                <button onClick={() => setAddModal({})}
                  className="flex items-center gap-1 text-xs text-text-primary hover:text-text-primary cursor-pointer transition-colors font-semibold">
                  <Plus size={12} strokeWidth={2.5} /> Adicionar Lançamento
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {[...categories].sort((a, b) => a.sortOrder - b.sortOrder).map(cat => (
                  <CategorySection key={cat.id} cat={cat}
                    holdings={holdings.filter(h => h.categoryId === cat.id)}
                    prices={priceCache}
                    totalPortfolioValue={totalValue}
                    onUpdate={updateCat}
                    onDeleteTicker={deleteTransactionsByTicker}
                    onAddTransaction={(ticker, categoryId) => setAddModal({ ticker, categoryId: categoryId ?? cat.id })}
                    onEditTicker={(ticker) => {
                      setHistoryTicker(ticker);
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
        
        {activeTab === 'planejamento' && (
          <>
            <div className="flex flex-col gap-4 shrink-0">
              <DistTable
                title="Distribuição de Investimentos" 
                patrimonio={investPatrimonio} aportar={config.aportar}
                onAportarCh={v => saveConfig({ aportar: v })}
                rows={investRows} rebalance
              />
              <DistTable
                title="Distribuição de Dinheiro (Simulador)" 
                patrimonioLabel="Dinheiro a Distribuir (ex: Salário)"
                patrimonio={config.patrimonio} aportar={0}
                onPatrimonioCh={v => saveConfig({ patrimonio: v })}
                rows={moneyRows}
                isSimulator
              />
            </div>

            <GoalsSection
              goals={goals} categories={enrichedCategories}
              investPatrimonio={investPatrimonio}
              onAdd={addGoal} onDelete={deleteGoal} onUpdate={updateGoal}
            />
            
            <WatchlistSection
              categories={categories} watchlist={watchlist}
              onAddWatchlist={addWatchlistItem}
              onDeleteWatchlist={deleteWatchlistItem}
              onRefreshWatchlist={refreshWatchlistItem}
              onEditWatchlistTicker={editWatchlistTicker}
            />
          </>
        )}

        {activeTab === 'lancamentos' && (
          <TransactionsTab
            transactions={transactions}
            categories={categories}
            onEdit={setEditingTx}
            onDelete={deleteTransaction}
          />
        )}
      </div>

      {addModal !== null && (
        <TransactionModal
          categories={categories}
          initialTicker={addModal.ticker}
          initialCategoryId={addModal.categoryId ?? categories[0]?.id}
          onSave={addTransaction}
          onClose={() => setAddModal(null)}
        />
      )}

      {editingTx !== null && (
        <TransactionModal
          categories={categories}
          initialTicker={editingTx.ticker}
          initialCategoryId={editingTx.categoryId ?? categories[0]?.id}
          initialData={editingTx}
          onSave={async (data) => {
            await supabase.from('investment_transactions').delete().eq('id', editingTx.id);
            setTransactions(prev => prev.filter(x => x.id !== editingTx.id));
            await addTransaction(data);
            setEditingTx(null);
          }}
          onClose={() => setEditingTx(null)}
        />
      )}

      {historyTicker && (
        <TransactionHistoryModal
          ticker={historyTicker}
          transactions={transactions.filter(t => t.ticker === historyTicker)}
          onClose={() => setHistoryTicker(null)}
          onEdit={(t) => { setHistoryTicker(null); setEditingTx(t); }}
          onDelete={deleteTransaction}
        />
      )}
    </div>
  );
}
