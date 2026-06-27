import { useState, useRef, useEffect, useMemo } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Search } from 'lucide-react';

// ── Types (exported for InvestmentView) ───────────────────────────────────────
export type AssetType =
  | 'acoes' | 'fiis' | 'etfs' | 'bdrs' | 'stock' | 'reit'
  | 'cripto' | 'fundos' | 'renda_fixa';

export interface TransactionData {
  ticker: string;
  categoryId: string;
  type: 'buy' | 'sell' | 'dividend';
  date: string;
  quantity: number;
  price: number;
  otherCosts: number;
  assetType: AssetType;
  meta?: RFMeta;
}

export interface RFMeta {
  emissor: string;
  tipoTitulo: string;
  indexador: string;
  taxa: number;
  forma: string;
  liquidezDiaria: boolean;
  vencimento: string;
}

export interface ICat { id: string; name: string; color: string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'acoes',      label: 'Ações' },
  { value: 'bdrs',       label: 'BDRs' },
  { value: 'cripto',     label: 'Criptomoedas' },
  { value: 'etfs',       label: 'ETFs' },
  { value: 'fiis',       label: 'FIIs' },
  { value: 'stock',      label: 'Stock' },
  { value: 'reit',       label: 'Reit' },
  { value: 'fundos',     label: 'Fundos de Investimentos' },
  { value: 'renda_fixa', label: 'Renda Fixa' },
];

const TIPO_TITULO_OPTS = ['CDB', 'LCI', 'LCA', 'LC', 'LIG', 'CRI', 'CRA', 'Debênture', 'Tesouro Selic', 'Tesouro IPCA', 'Tesouro Prefixado', 'Poupança'];
const INDEXADOR_OPTS   = ['CDI', 'IPCA', 'SELIC', 'IGPM', 'TJLP', 'TR', 'Pré', 'INPC'];
const FORMA_OPTS       = ['Pós-fixado', 'Pré-fixado', 'Híbrido', 'Isento de IR'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const parsePrice = (s: string): number => {
  const c = s.replace(/R\$\s?/g, '').trim();
  const commas = (c.match(/,/g) || []).length;
  const dots   = (c.match(/\./g) || []).length;
  if (commas === 1 && dots === 0) return Math.abs(parseFloat(c.replace(',', '.')) || 0);
  if (commas === 1 && dots >= 1)  return Math.abs(parseFloat(c.replace(/\./g, '').replace(',', '.')) || 0);
  return Math.abs(parseFloat(c) || 0);
};
const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const todayStr = new Date().toISOString().slice(0, 10);

// ── Sub-components ─────────────────────────────────────────────────────────────
const inputCls = 'w-full bg-bg-primary border border-border-base/40 hover:border-border-gray/60 rounded-lg px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-tertiary/40 focus:border-neutral-500/50 transition-colors';

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1 text-[13px] font-medium text-text-secondary">
        {label}
        {optional && <span className="text-text-tertiary/50 font-normal">(Opcional)</span>}
      </label>
      {children}
    </div>
  );
}

export function StyledSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.closest('[data-styled-select]')?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const estHeight = options.length * 40 + 8; // px estimado
      const openUp = spaceBelow < estHeight && rect.top > estHeight;
      setDropStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    }
    setOpen(v => !v);
  };

  const selectedLabel = options.find(o => o.value === value)?.label || 'Selecionar';

  const dropdown = open && (
    <div
      style={dropStyle}
      className="bg-bg-primary border border-border-base rounded-lg shadow-2xl flex flex-col"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="p-1">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-elements hover:text-text-primary rounded-md transition-colors cursor-pointer ${
              value === o.value ? 'bg-elements/50 text-text-primary' : 'text-text-secondary'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div data-styled-select className="relative">
      <button ref={btnRef} type="button" onClick={handleOpen}
        className={`flex items-center justify-between ${inputCls} text-left cursor-pointer`}>
        <span className="text-text-primary">{selectedLabel}</span>
        <ChevronDown size={14} className={`text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}

function AssetSearchDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Mock list for now. In a real app this hits brapi.dev /available
  const mockAssets = ['PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'BBAS3', 'MXRF11', 'HGLG11', 'IVVB11', 'BTC', 'ETH'];
  const filtered = search ? mockAssets.filter(a => a.toLowerCase().includes(search.toLowerCase())) : mockAssets;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className={`flex items-center justify-between ${inputCls} text-left cursor-pointer`}>
        <span className={value ? 'text-text-primary' : 'text-text-tertiary/40'}>{value || 'Selecionar'}</span>
        <ChevronDown size={14} className="text-text-tertiary" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-bg-primary border border-border-base rounded-lg shadow-xl overflow-hidden flex flex-col max-h-60">
          <div className="p-2 border-b border-border-base/40">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ativo..."
                className="w-full bg-bg-secondary rounded-md pl-8 pr-3 py-1.5 text-xs text-text-primary outline-none focus:border-neutral-500/50 border border-transparent transition-colors" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {filtered.length > 0 ? filtered.map(a => (
              <button key={a} type="button" onClick={() => { onChange(a); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-elements hover:text-text-primary rounded-md transition-colors cursor-pointer">
                {a}
              </button>
            )) : (
              <div className="px-3 py-2 text-xs text-text-tertiary text-center">
                Se não achar, pode digitar o código exato
                <button onClick={() => { onChange(search.toUpperCase()); setOpen(false); }} className="block w-full mt-2 py-1.5 bg-white/10 text-text-primary rounded hover:bg-white/30">Usar "{search.toUpperCase()}"</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-text-secondary">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${value ? 'bg-emerald-500' : 'bg-elements'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

// ── TransactionModal ──────────────────────────────────────────────────────────
export interface ITransactionForEdit {
  ticker: string; categoryId: string;
  type: 'buy' | 'sell' | 'dividend'; date: string;
  quantity: number; price: number; otherCosts: number;
  assetType?: AssetType; meta?: any;
}

export function TransactionModal({ categories, initialTicker, initialCategoryId, initialAssetType, initialData, onSave, onClose }: {
  categories: ICat[];
  initialTicker?: string;
  initialCategoryId?: string;
  initialAssetType?: AssetType;
  initialData?: ITransactionForEdit;
  onSave: (data: TransactionData) => Promise<void>;
  onClose: () => void;
}) {
  const isEditing = !!initialData;

  // Helper: converte número para string formatada para os inputs de preço
  const numToStr = (n: number) => n > 0 ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '';

  const [txType, setTxType] = useState<'buy' | 'sell' | 'dividend'>(initialData?.type ?? 'buy');
  const [assetType, setAssetType] = useState<AssetType>(initialData?.assetType ?? initialAssetType ?? 'acoes');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? initialCategoryId ?? categories[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  // Common fields
  const [ticker,     setTicker]     = useState(initialData?.ticker ?? initialTicker ?? '');
  const [date,       setDate]       = useState(initialData?.date ?? todayStr);
  const [qty,        setQty]        = useState(initialData?.quantity ? String(initialData.quantity) : '');
  const [priceStr,   setPriceStr]   = useState(initialData?.price ? numToStr(initialData.price) : '');
  const [otherCosts, setOtherCosts] = useState(initialData?.otherCosts ? numToStr(initialData.otherCosts) : '');

  // Fundos
  const totalInvested = useMemo(() => (initialData?.quantity ?? 0) * (initialData?.price ?? 0), [initialData]);
  const [valorInvestido, setValorInvestido] = useState(
    initialData?.assetType === 'fundos' && totalInvested > 0
      ? 'R$ ' + totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      : ''
  );
  const [precoCota, setPrecoCota] = useState(
    initialData?.assetType === 'fundos' && initialData.price > 0 ? numToStr(initialData.price) : ''
  );

  // Renda Fixa
  const rfMeta = initialData?.meta as any;
  const [emissor,        setEmissor]        = useState(rfMeta?.emissor ?? initialData?.ticker ?? initialTicker ?? 'Nubank');
  const [tipoTitulo,     setTipoTitulo]     = useState(rfMeta?.tipoTitulo ?? 'CDB');
  const [indexador,      setIndexador]      = useState(rfMeta?.indexador ?? 'CDI');
  const [taxa,           setTaxa]           = useState(rfMeta?.taxa ? String(rfMeta.taxa).replace('.', ',') : '100,00');
  const [forma,          setForma]          = useState(rfMeta?.forma ?? 'Pós-fixado');
  const [valorRF,        setValorRF]        = useState(
    initialData?.assetType === 'renda_fixa' && initialData.price > 0
      ? 'R$ ' + initialData.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      : ''
  );
  const [liquidezDiaria, setLiquidezDiaria] = useState(rfMeta?.liquidezDiaria ?? false);
  const [vencimento,     setVencimento]     = useState(rfMeta?.vencimento ?? '');

  const isCripto   = assetType === 'cripto';
  const isFundos   = assetType === 'fundos';
  const isRF       = assetType === 'renda_fixa';
  const isStandard = !isCripto && !isFundos && !isRF;

  // Calculated
  const qtyNum    = parseFloat(qty)  || 0;
  const priceNum  = parsePrice(priceStr);
  const otherNum  = parseFloat(otherCosts.replace(',', '.')) || 0;
  const viNum     = parseFloat(valorInvestido.replace(/[^\d]/g, '')) / 100 || 0;
  const pcNum     = parsePrice(precoCota);
  const cotasNum  = isFundos && pcNum > 0 ? viNum / pcNum : 0;
  const rfValorNum = parsePrice(valorRF);

  const total = isRF
    ? rfValorNum
    : isFundos
    ? viNum + otherNum
    : qtyNum * priceNum + otherNum;

  const isValid = isRF
    ? emissor.trim().length > 0 && rfValorNum > 0
    : isFundos
    ? ticker.trim().length > 0 && viNum > 0
    : ticker.trim().length > 0 && qtyNum > 0 && priceNum > 0;

  const handleChangeAssetType = (v: AssetType) => {
    setAssetType(v);
    const hint: Record<AssetType, string> = {
      acoes: 'ações', fiis: 'fii', etfs: 'etf', bdrs: 'bdr',
      stock: 'exterior', reit: 'exterior', cripto: 'cripto',
      fundos: 'renda', renda_fixa: 'renda',
    };
    const found = categories.find(c => c.name.toLowerCase().includes(hint[v]));
    if (found) setCategoryId(found.id);
  };

  const submit = async () => {
    if (!isValid || saving) return;
    setSaving(true);

    let data: TransactionData;

    if (isRF) {
      data = {
        ticker: emissor.trim(), categoryId, type: txType, date,
        quantity: 1, price: rfValorNum, otherCosts: 0, assetType,
        meta: { emissor: emissor.trim(), tipoTitulo, indexador, taxa: parseFloat(taxa) || 0, forma, liquidezDiaria, vencimento },
      };
    } else if (isFundos) {
      data = {
        ticker: ticker.trim().toUpperCase(), categoryId, type: txType, date,
        quantity: cotasNum, price: pcNum, otherCosts: otherNum, assetType,
      };
    } else {
      data = {
        ticker: ticker.trim().toUpperCase(), categoryId, type: txType, date,
        quantity: qtyNum, price: priceNum, otherCosts: otherNum, assetType,
      };
    }

    await onSave(data);
    onClose();
  };

  const catOptions = categories.map(c => ({ value: c.id, label: c.name }));

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans"
      style={{ zIndex: isEditing ? 60 : 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-bg-secondary border border-border-base/30 rounded-xl w-full max-w-[480px] shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0">
          <span className="text-lg font-bold text-text-primary tracking-tight">
            {isEditing ? 'Editar Lançamento' : 'Adicionar Lançamento'}
          </span>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary cursor-pointer transition-colors p-1 -mr-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {/* Tabs Compra / Venda */}
          <div className="px-6 flex">
            <div className="flex w-full bg-bg-primary rounded-lg p-1">
              {(['buy', 'sell', 'dividend'] as const).map(t => (
                <button key={t} type="button" onClick={() => setTxType(t)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all cursor-pointer ${
                    txType === t
                      ? 'bg-[#252A33] text-text-primary shadow-sm'
                      : 'text-text-tertiary hover:text-text-secondary'
                  }`}>
                  {t === 'buy' ? 'Compra' : t === 'sell' ? 'Venda' : 'Provento'}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 py-6 flex flex-col gap-5">

            {/* Tipo de ativo */}
            <Field label="Tipo de ativo">
              <StyledSelect value={assetType} onChange={v => handleChangeAssetType(v as AssetType)} options={ASSET_TYPES} />
            </Field>

            {/* Categoria */}
            <Field label="Categoria">
              <StyledSelect value={categoryId} onChange={setCategoryId} options={catOptions} />
            </Field>

            {/* ══ RENDA FIXA ═════════════════════════════════════════════════ */}
            {isRF && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Emissor">
                    <input list="bancos-list" value={emissor} onChange={e => setEmissor(e.target.value)}
                      placeholder="Ex: Banco Inter" className={inputCls} />
                    <datalist id="bancos-list">
                      <option value="Nubank" />
                      <option value="Banco Inter" />
                      <option value="BTG Pactual" />
                      <option value="XP Investimentos" />
                      <option value="Itaú" />
                      <option value="Bradesco" />
                      <option value="Banco do Brasil" />
                      <option value="Caixa Econômica" />
                    </datalist>
                  </Field>
                  <Field label="Tipo de título">
                    <StyledSelect value={tipoTitulo} onChange={setTipoTitulo}
                      options={TIPO_TITULO_OPTS.map(v => ({ value: v, label: v }))} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Indexador">
                    <StyledSelect value={indexador} onChange={setIndexador}
                      options={INDEXADOR_OPTS.map(v => ({ value: v, label: v }))} />
                  </Field>
                  <Field label="Taxa do CDI">
                    <div className="relative">
                      <input value={taxa} onChange={e => setTaxa(e.target.value)}
                        placeholder="100,00" className={`${inputCls} pr-8`} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary text-sm select-none">%</span>
                    </div>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Forma">
                    <StyledSelect value={forma} onChange={setForma}
                      options={FORMA_OPTS.map(v => ({ value: v, label: v }))} />
                  </Field>
                  <Field label="Valor investido">
                    <input value={valorRF} onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setValorRF(digits ? 'R$ ' + (parseInt(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                    }} placeholder="R$ 0,00" inputMode="numeric" className={inputCls} />
                  </Field>
                </div>
                <Toggle value={liquidezDiaria} onChange={setLiquidezDiaria} label="Liquidez diária" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Data da transação">
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} style={{ colorScheme: 'dark' }} />
                  </Field>
                  {!liquidezDiaria && (
                    <Field label="Data de vencimento">
                      <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className={inputCls} style={{ colorScheme: 'dark' }} />
                    </Field>
                  )}
                </div>
              </>
            )}

            {/* ══ FUNDOS ══════════════════════════════════════════════════════ */}
            {isFundos && (
              <>
                <Field label="Nome / Código do fundo">
                  <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
                    placeholder="Ex: MXRF11 ou Nome do fundo" className={inputCls} />
                </Field>
                <Field label="Data da transação">
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} style={{ colorScheme: 'dark' }} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Valor investido">
                    <input value={valorInvestido} onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setValorInvestido(digits ? 'R$ ' + (parseInt(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                    }} placeholder="R$ 0,00" inputMode="numeric" className={inputCls} />
                  </Field>
                  <Field label="Preço da cota em R$">
                    <input value={precoCota} onChange={e => setPrecoCota(e.target.value)}
                      placeholder="0,00000000" className={inputCls} />
                  </Field>
                </div>
                <Field label="Outros custos" optional>
                  <input value={otherCosts} onChange={e => setOtherCosts(e.target.value)}
                    placeholder="0,00" className={inputCls} />
                </Field>
                {cotasNum > 0 && (
                  <div className="bg-bg-primary rounded-lg px-4 py-3 flex items-center justify-between border border-border-base/20">
                    <span className="text-xs text-text-tertiary">Quantidade de cotas</span>
                    <span className="text-sm font-semibold text-text-primary">{cotasNum.toFixed(8)}</span>
                  </div>
                )}
              </>
            )}

            {/* ══ STANDARD + CRIPTO ═══════════════════════════════════════════ */}
            {(isStandard || isCripto) && (
              <>
                <Field label="Ativo">
                  <AssetSearchDropdown value={ticker} onChange={setTicker} />
                </Field>
                
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Data da transação">
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} style={{ colorScheme: 'dark' }} />
                  </Field>
                  <Field label="Quantidade">
                    <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                      placeholder={isCripto ? '0,00000001' : '1'}
                      min="0" step={isCripto ? '0.00000001' : '1'}
                      className={inputCls} />
                  </Field>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Preço em R$">
                    <input value={priceStr} onChange={e => setPriceStr(e.target.value)}
                      placeholder={isCripto ? '0,00000000' : '0,00'}
                      onKeyDown={e => e.key === 'Enter' && submit()}
                      className={inputCls} />
                  </Field>
                  <Field label="Outros custos" optional>
                    <input value={otherCosts} onChange={e => setOtherCosts(e.target.value)}
                      placeholder="0,00" className={inputCls} />
                  </Field>
                </div>
              </>
            )}

            {/* Valor total */}
            <div className={`mt-2 rounded-lg px-4 py-3.5 flex items-center justify-between border shadow-sm ${txType === 'buy' ? 'bg-elements/10 border-elements/10' : 'bg-red-500/10 border-red-500/20'}`}>
              <span className="text-sm font-medium text-text-secondary">Valor total</span>
              <span className={`text-xl font-bold tracking-tight ${txType === 'buy' ? 'text-text-primary' : 'text-red-400'}`}>
                {fmt(total)}
              </span>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-5 border-t border-border-base/40 shrink-0 bg-bg-primary/50 rounded-b-xl">
          <button onClick={onClose} className="px-2 py-2 text-sm font-medium text-text-tertiary hover:text-text-primary cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={!isValid || saving}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${txType === 'buy' ? 'bg-text-primary hover:opacity-80 text-bg-primary' : 'bg-red-500 hover:bg-red-600 text-[#ffffff]'}`}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Adicionar Lançamento'}
          </button>
        </div>

      </div>
    </div>
  );
}

