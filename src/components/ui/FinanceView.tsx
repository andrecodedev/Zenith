import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, X } from 'lucide-react';
import { addMonths, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import {
  PieChart, Pie,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';

type EntryType = 'income' | 'fixed' | 'variable' | 'investment';

interface FinanceEntry {
  id: string;
  type: EntryType;
  name: string;
  dateStr: string;
  amount: number;
  paid: boolean;
  sortOrder: number;
}

interface EntryForm {
  type: EntryType;
  name: string;
  dateStr: string;
  amountStr: string;
  paid: boolean;
  recurring: boolean;
  endYear: number;
  endMonth: number;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const parseAmt = (s: string): number => {
  let c = s.replace(/R\$\s?/g, '').trim();
  if (c.includes(',')) c = c.replace(/\./g, '').replace(',', '.');
  return Math.abs(parseFloat(c) || 0);
};

const mapRow = (r: Record<string, unknown>): FinanceEntry => ({
  id: r.id as string,
  type: r.type as EntryType,
  name: (r.name as string) ?? '',
  dateStr: (r.date_str as string) ?? '',
  amount: Number(r.amount) || 0,
  paid: Boolean(r.paid),
  sortOrder: Number(r.sort_order) || 0,
});

const parseDateStr = (s: string): number => {
  const [d, m] = (s || '').split('/').map(Number);
  if (!d || !m) return 9999;
  return m * 100 + d;
};

const CFG: Record<EntryType, { label: string; showDate: boolean; showPaid: boolean; hdr: string; tot: string; add: string; row: string; rowHover: string }> = {
  income: {
    label: 'Renda', showDate: false, showPaid: false,
    hdr: 'bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300',
    tot: 'bg-emerald-500/5 text-emerald-400',
    add: 'text-emerald-400 hover:text-emerald-300',
    row: 'border-emerald-500/15',
    rowHover: 'hover:bg-emerald-500/5',
  },
  fixed: {
    label: 'Despesas Fixas', showDate: true, showPaid: true,
    hdr: 'bg-rose-500/10 border-b border-rose-500/20 text-rose-300',
    tot: 'bg-rose-500/5 text-rose-400',
    add: 'text-rose-400 hover:text-rose-300',
    row: 'border-rose-500/15',
    rowHover: 'hover:bg-rose-500/5',
  },
  variable: {
    label: 'Despesas Variáveis', showDate: true, showPaid: true,
    hdr: 'bg-amber-500/10 border-b border-amber-500/20 text-amber-300',
    tot: 'bg-amber-500/5 text-amber-400',
    add: 'text-amber-400 hover:text-amber-300',
    row: 'border-amber-500/15',
    rowHover: 'hover:bg-amber-500/5',
  },
  investment: {
    label: 'Investimentos', showDate: true, showPaid: false,
    hdr: 'bg-violet-500/10 border-b border-violet-500/20 text-violet-300',
    tot: 'bg-violet-500/5 text-violet-400',
    add: 'text-violet-400 hover:text-violet-300',
    row: 'border-violet-500/15',
    rowHover: 'hover:bg-violet-500/5',
  },
};

function Editable({ value, onSave, placeholder = ',', right = false }: {
  value: string; onSave: (v: string) => void; placeholder?: string; right?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { setDraft(value); ref.current?.focus(); ref.current?.select(); } }, [editing, value]);
  const commit = () => { setEditing(false); if (draft !== value) onSave(draft); };
  if (editing) return (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className={`bg-transparent outline-none w-full text-sm ${right ? 'text-right font-mono' : ''}`} />
  );
  return (
    <span onClick={() => setEditing(true)}
      className={`cursor-text block truncate text-sm ${right ? 'text-right font-mono' : ''} ${!value ? 'text-text-tertiary/30' : ''}`}>
      {value || placeholder}
    </span>
  );
}

function DateEditable({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [ed, setEd] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ed) { setDraft(value); ref.current?.focus(); ref.current?.select(); } }, [ed, value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setDraft(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`);
  };

  const done = () => {
    setEd(false);
    if (/^\d{2}\/\d{2}$/.test(draft) && draft !== value) onSave(draft);
    else setDraft(value);
  };

  if (ed) return (
    <input ref={ref} value={draft} placeholder="DD/MM"
      onChange={e => handleChange(e.target.value)} onBlur={done}
      onKeyDown={e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { setEd(false); setDraft(value); } }}
      className="bg-transparent outline-none w-full text-sm" />
  );
  return (
    <span onClick={() => setEd(true)}
      className={`cursor-text block text-sm ${!value ? 'text-text-tertiary/30' : ''}`}>
      {value || 'DD/MM'}
    </span>
  );
}

const MONTH_PT    = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function EntryModal({ isOpen, onClose, onSubmit, currentYear, currentMonth }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: EntryForm, months: { year: number; month: number }[]) => Promise<void>;
  currentYear: number;
  currentMonth: number;
}) {
  const blank = (): EntryForm => ({
    type: 'fixed', name: '', dateStr: '', amountStr: '', paid: false,
    recurring: false, endYear: currentYear, endMonth: currentMonth,
  });
  const [form, setForm] = useState<EntryForm>(blank);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (isOpen) setForm(blank()); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const months = useMemo(() => {
    const result: { year: number; month: number }[] = [];
    let y = currentYear, m = currentMonth;
    for (let i = 0; i < 60; i++) {
      result.push({ year: y, month: m });
      if (!form.recurring || (y === form.endYear && m === form.endMonth)) break;
      m++; if (m > 12) { m = 1; y++; }
      if (y > form.endYear || (y === form.endYear && m > form.endMonth)) break;
    }
    return result;
  }, [form.recurring, form.endYear, form.endMonth, currentYear, currentMonth]);

  const handleDateInput = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 4);
    setForm(f => ({ ...f, dateStr: d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}` }));
  };

  const submit = async () => {
    if (!form.name.trim() || !form.amountStr.trim()) return;
    setBusy(true);
    await onSubmit(form, months);
    setBusy(false);
    onClose();
  };

  if (!isOpen) return null;

  const cfg = CFG[form.type];
  const isValid = form.name.trim() && form.amountStr.trim();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-bg-secondary border border-border-base rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-base shrink-0">
          <h2 className="text-base font-bold text-text-primary">Nova Entrada</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Tipo */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-text-tertiary mb-2">Tipo</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(['income', 'fixed', 'variable', 'investment'] as EntryType[]).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    form.type === t ? `${CFG[t].hdr} border-transparent` : 'border-border-base text-text-tertiary hover:bg-elements'
                  }`}>
                  {CFG[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-text-tertiary mb-2">Descrição</p>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Aluguel, Netflix, Salário..." autoFocus
              className="w-full bg-bg-primary border border-border-base rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-neutral-500 placeholder:text-text-tertiary/40" />
          </div>

          {/* Data + Valor */}
          <div className={`grid gap-3 ${cfg.showDate ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {cfg.showDate && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-tertiary mb-2">Data (DD/MM)</p>
                <input value={form.dateStr} onChange={e => handleDateInput(e.target.value)} placeholder="DD/MM"
                  className="w-full bg-bg-primary border border-border-base rounded-lg px-3 py-2 text-sm font-mono text-text-primary outline-none focus:border-neutral-500 placeholder:text-text-tertiary/40" />
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-tertiary mb-2">Valor (R$)</p>
              <input value={form.amountStr} onChange={e => setForm(f => ({ ...f, amountStr: e.target.value }))}
                placeholder="0,00"
                className="w-full bg-bg-primary border border-border-base rounded-lg px-3 py-2 text-sm font-mono text-text-primary outline-none focus:border-neutral-500 placeholder:text-text-tertiary/40" />
            </div>
          </div>

          {/* Pago */}
          {cfg.showPaid && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none"
              onClick={() => setForm(f => ({ ...f, paid: !f.paid }))}>
              <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.paid ? 'bg-green-500' : 'bg-elements'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.paid ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-sm text-text-secondary">Já pago</span>
            </label>
          )}

          {/* Recorrência */}
          <div className="border-t border-border-base/30 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer select-none"
              onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}>
              <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.recurring ? 'bg-violet-500' : 'bg-elements'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.recurring ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-sm text-text-secondary">Repetir em outros meses</span>
            </label>

            {form.recurring && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-text-tertiary">
                    De <span className="text-text-primary font-semibold">{MONTH_PT[currentMonth - 1]}/{currentYear}</span> até:
                  </span>
                  <select value={form.endMonth} onChange={e => setForm(f => ({ ...f, endMonth: Number(e.target.value) }))}
                    className="bg-bg-primary border border-border-base rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer">
                    {MONTH_PT.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
                  </select>
                  <select value={form.endYear} onChange={e => setForm(f => ({ ...f, endYear: Number(e.target.value) }))}
                    className="bg-bg-primary border border-border-base rounded-lg px-2 py-1 text-xs text-text-primary outline-none cursor-pointer">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {months.length > 0 && (
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-violet-300 mb-1">
                      Será criado em <span className="font-bold">{months.length}</span> {months.length === 1 ? 'mês' : 'meses'}:
                    </p>
                    <p className="text-xs text-violet-400/80 font-mono leading-relaxed">
                      {months.map(({ year: y, month: m }) => `${MONTH_SHORT[m - 1]}/${y}`).join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border-base shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-text-tertiary hover:text-text-primary cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={busy || !isValid}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              busy || !isValid
                ? 'bg-elements text-text-tertiary cursor-not-allowed'
                : 'bg-text-primary text-bg-primary hover:bg-text-secondary cursor-pointer'
            }`}>
            {busy ? 'Criando...' : months.length > 1 ? `Criar (${months.length} meses)` : 'Criar entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryRow({ entry, cfg, onUpdate, onDelete }: {
  entry: FinanceEntry;
  cfg: typeof CFG[EntryType];
  onUpdate: (id: string, u: Partial<FinanceEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const paidCls = entry.paid ? 'line-through text-green-400' : '';
  return (
    <div className={`group flex items-center gap-2 px-3 py-1.5 ${cfg.rowHover} border-b ${cfg.row} last:border-b-0 transition-colors text-text-primary`}>
      {cfg.showPaid && (
        <button type="button" onClick={() => onUpdate(entry.id, { paid: !entry.paid })}
          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
            entry.paid ? 'bg-green-500/20 border-green-400/60 text-green-400' : 'border-border-gray hover:border-text-tertiary'
          }`}>
          {entry.paid && <Check size={9} strokeWidth={3} />}
        </button>
      )}
      <div className={`flex-1 min-w-0 ${paidCls}`}>
        <Editable value={entry.name} onSave={v => onUpdate(entry.id, { name: v })} placeholder="Descrição" />
      </div>
      {cfg.showDate && (
        <div className={`w-14 shrink-0 hidden sm:block ${entry.paid ? 'line-through text-green-400/60' : 'text-text-tertiary'}`}>
          <DateEditable value={entry.dateStr} onSave={v => onUpdate(entry.id, { dateStr: v })} />
        </div>
      )}
      <div className={`w-20 sm:w-28 shrink-0 ${paidCls}`}>
        <Editable
          value={entry.amount > 0 ? fmt(entry.amount) : ''}
          onSave={v => onUpdate(entry.id, { amount: parseAmt(v) })}
          placeholder="R$ 0,00" right
        />
      </div>
      <button type="button" onClick={() => onDelete(entry.id)}
        className="shrink-0 w-5 h-5 flex items-center justify-center text-transparent group-hover:text-text-tertiary/50 hover:text-red-400! transition-all cursor-pointer">
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function Section({ type, entries, onAdd, onUpdate, onDelete }: {
  type: EntryType; entries: FinanceEntry[];
  onAdd: (t: EntryType) => void;
  onUpdate: (id: string, u: Partial<FinanceEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = CFG[type];
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const sorted = cfg.showDate
    ? [...entries].sort((a, b) => parseDateStr(a.dateStr) - parseDateStr(b.dateStr))
    : entries;
  return (
    <div className="bg-bg-secondary border border-border-base rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-2.5 ${cfg.hdr}`}>
        <span className="text-sm font-bold">{cfg.label}</span>
        <span className="text-xs font-mono font-semibold">{fmt(total)}</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-widest text-text-tertiary/50 border-b border-border-base/30">
        {cfg.showPaid && <span className="w-4 shrink-0" />}
        <span className="flex-1">Descrição</span>
        {cfg.showDate && <span className="w-14 shrink-0 hidden sm:block">Data</span>}
        <span className="w-20 sm:w-28 shrink-0 text-right">Valor</span>
        <span className="w-5 shrink-0" />
      </div>
      <div className="min-h-[32px] max-h-52 sm:max-h-none overflow-y-auto">
        {sorted.length === 0
          ? <p className="text-center text-text-tertiary/40 text-xs py-3">,</p>
          : sorted.map(e => <EntryRow key={e.id} entry={e} cfg={cfg} onUpdate={onUpdate} onDelete={onDelete} />)
        }
      </div>
      <div className={`flex items-center justify-between px-4 py-2 border-t border-border-base/30 ${cfg.tot}`}>
        <button type="button" onClick={() => onAdd(type)}
          className={`flex items-center gap-1 text-xs cursor-pointer transition-colors ${cfg.add}`}>
          <Plus size={11} strokeWidth={2.5} /> Adicionar
        </button>
        <span className="text-sm font-bold font-mono">{fmt(total)}</span>
      </div>
    </div>
  );
}

function Summary({ entries }: { entries: FinanceEntry[] }) {
  const sum = (t: EntryType) => entries.filter(e => e.type === t).reduce((s, e) => s + e.amount, 0);
  const renda = sum('income');
  const fixas = sum('fixed');
  const variaveis = sum('variable');
  const invest = sum('investment');
  const despesas = fixas + variaveis;
  const sobra = renda - despesas - invest;
  const cards = [
    { label: 'Renda', value: renda, color: 'text-emerald-400' },
    { label: 'Desp. Fixas', value: fixas, color: 'text-rose-400' },
    { label: 'Desp. Variáveis', value: variaveis, color: 'text-amber-400' },
    { label: 'Despesa Total', value: despesas, color: 'text-orange-400' },
    { label: 'Investimentos', value: invest, color: 'text-violet-400' },
    { label: 'Sobra do Mês', value: sobra, color: sobra >= 0 ? 'text-emerald-400' : 'text-red-400' },
  ];
  return (
    <div className="bg-bg-secondary border border-border-base rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border-base/50 bg-sky-500/10 flex items-center justify-between">
        <span className="text-sm font-bold text-sky-300">Resumo do Mês</span>
        <span className={`text-sm font-mono font-bold ${sobra >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(sobra)}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border-base/20">
        {cards.map(c => (
          <div key={c.label} className="px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-text-tertiary mb-0.5 truncate">{c.label}</p>
            <p className={`text-xs sm:text-sm font-mono font-bold ${c.color} truncate`}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const TT_STYLE: React.CSSProperties = {
  background: '#1f1f1f', border: '1px solid #282828', borderRadius: 10, padding: '8px 12px',
};

function FinanceCharts({ entries }: { entries: FinanceEntry[] }) {
  const sum = (t: EntryType) => entries.filter(e => e.type === t).reduce((s, e) => s + e.amount, 0);
  const renda = sum('income');
  const fixas = sum('fixed');
  const variaveis = sum('variable');
  const invest = sum('investment');
  const sobra = Math.max(0, renda - fixas - variaveis - invest);

  if (renda + fixas + variaveis + invest === 0) return null;

  const pieData = [
    { name: 'Fixas',     value: fixas,    fill: '#f43f5e' },
    { name: 'Variáveis', value: variaveis, fill: '#f59e0b' },
    { name: 'Investim.', value: invest,    fill: '#a855f7' },
    { name: 'Sobra',     value: sobra,     fill: '#22c55e' },
  ].filter(d => d.value > 0);

  const barData = [
    { name: 'Renda',     value: renda,    fill: '#22c55e' },
    { name: 'Fixas',     value: fixas,    fill: '#f43f5e' },
    { name: 'Variáveis', value: variaveis, fill: '#f59e0b' },
    { name: 'Investim.', value: invest,    fill: '#a855f7' },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTT = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    const val = Number(d.value ?? 0);
    return (
      <div style={TT_STYLE}>
        <p style={{ color: '#a0a0a0', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{d.name}</p>
        <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{fmt(val)}</p>
        {renda > 0 && val > 0 && (
          <p style={{ color: '#a0a0a0', fontSize: 10, marginTop: 2 }}>{((val / renda) * 100).toFixed(1)}% da renda</p>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Donut - Distribuição */}
      <div className="bg-bg-secondary border border-border-base rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border-base/30">
          <span className="text-sm font-bold text-text-primary">Distribuição da Renda</span>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%"
                innerRadius={52} outerRadius={82} paddingAngle={2} dataKey="value" stroke="none" />
              <ReTooltip content={renderTT} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-1">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }} />
                <span className="text-xs text-text-tertiary">{d.name}</span>
                {renda > 0 && (
                  <span className="text-xs font-mono text-text-tertiary/50">
                    {((d.value / renda) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar - Comparativo */}
      <div className="bg-bg-secondary border border-border-base rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border-base/30">
          <span className="text-sm font-bold text-text-primary">Comparativo por Categoria</span>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#a0a0a0', fontSize: 10 }} axisLine={false} tickLine={false} width={44}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
              />
              <ReTooltip content={renderTT} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={52} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function FinanceView() {
  const [refDate, setRefDate] = useState(() => new Date());
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1;
  const label = format(refDate, "MMMM 'de' yyyy", { locale: ptBR });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('finance_entries').select('*')
      .eq('user_id', user.id).eq('year', year).eq('month', month)
      .order('sort_order');
    setEntries((data || []).map(mapRow));
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const addEntry = useCallback(async (type: EntryType) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const id = crypto.randomUUID();
    const sortOrder = entries.filter(e => e.type === type).length;
    const entry: FinanceEntry = { id, type, name: '', dateStr: '', amount: 0, paid: false, sortOrder };
    setEntries(p => [...p, entry]);
    await supabase.from('finance_entries').insert({
      id, user_id: user.id, year, month, type, name: '', date_str: '', amount: 0, paid: false, sort_order: sortOrder,
    });
  }, [entries, year, month]);

  const updateEntry = useCallback(async (id: string, updates: Partial<FinanceEntry>) => {
    setEntries(p => p.map(e => e.id === id ? { ...e, ...updates } : e));
    const db: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) db.name = updates.name;
    if (updates.dateStr !== undefined) db.date_str = updates.dateStr;
    if (updates.amount !== undefined) db.amount = updates.amount;
    if (updates.paid !== undefined) db.paid = updates.paid;
    await supabase.from('finance_entries').update(db).eq('id', id);
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    setEntries(p => p.filter(e => e.id !== id));
    await supabase.from('finance_entries').delete().eq('id', id);
  }, []);

  const createEntries = useCallback(async (form: EntryForm, months: { year: number; month: number }[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const amount = parseAmt(form.amountStr);
    const sortBase = entries.filter(e => e.type === form.type).length;
    const rows = months.map(({ year: y, month: m }, idx) => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      year: y, month: m,
      type: form.type,
      name: form.name,
      date_str: form.dateStr,
      amount,
      paid: idx === 0 ? form.paid : false,
      sort_order: sortBase + idx,
    }));
    await supabase.from('finance_entries').insert(rows);
    const thisMonth = rows.filter(r => r.year === year && r.month === month);
    if (thisMonth.length > 0) {
      setEntries(p => [...p, ...thisMonth.map(r => mapRow(r as Record<string, unknown>))]);
    }
  }, [entries, year, month]);

  const by = (t: EntryType) => entries.filter(e => e.type === t);

  return (
    <>
      <div className="flex flex-col">
        <div className="sticky top-0 z-10 bg-bg-primary flex items-center justify-between px-4 py-3 border-b border-border-base">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRefDate(d => subMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-elements cursor-pointer text-text-tertiary hover:text-text-primary transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-text-primary capitalize min-w-[110px] sm:min-w-[160px] text-center select-none">
              {label}
            </span>
            <button type="button" onClick={() => setRefDate(d => addMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-elements cursor-pointer text-text-tertiary hover:text-text-primary transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {loading && <span className="text-text-tertiary text-xs animate-pulse">Carregando...</span>}
            <button type="button" onClick={() => setModalOpen(true)}
              className="whitespace-nowrap flex items-center gap-1.5 text-xs font-semibold bg-text-primary text-bg-primary px-3 py-1.5 rounded-lg hover:bg-text-secondary cursor-pointer transition-colors">
              <Plus size={12} strokeWidth={3} /> Nova Entrada
            </button>
          </div>
        </div>
        <div className="p-4 flex flex-col gap-4 pb-24">
          <Summary entries={entries} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <Section type="income" entries={by('income')} onAdd={addEntry} onUpdate={updateEntry} onDelete={deleteEntry} />
              <Section type="fixed" entries={by('fixed')} onAdd={addEntry} onUpdate={updateEntry} onDelete={deleteEntry} />
            </div>
            <div className="flex flex-col gap-4">
              <Section type="variable" entries={by('variable')} onAdd={addEntry} onUpdate={updateEntry} onDelete={deleteEntry} />
              <Section type="investment" entries={by('investment')} onAdd={addEntry} onUpdate={updateEntry} onDelete={deleteEntry} />
            </div>
          </div>
          <FinanceCharts entries={entries} />
        </div>
      </div>
      <EntryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={createEntries}
        currentYear={year}
        currentMonth={month}
      />
    </>
  );
}
