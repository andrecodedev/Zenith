import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  ArrowLeft, Plus, Trash2, FileText,
  Bold, Italic, Strikethrough, Underline as UnderlineIcon,
  List, ListOrdered, ListChecks, Heading1, Heading2, Heading3,
  Quote, Minus, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Code, Undo2, Redo2, Link as LinkIcon, Highlighter,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Confirm Modal ──────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-xs shadow-2xl p-5 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-text-primary text-base mb-1">{title}</h3>
        <p className="text-text-tertiary text-sm mb-5">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-border-base text-text-secondary hover:bg-elements transition-colors cursor-pointer text-sm">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer text-sm font-medium">
            Deletar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toolbar Button ─────────────────────────────────────────────────────────────
function TB({ onClick, active, title, children }: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded transition-colors cursor-pointer shrink-0 ${active ? 'bg-white/20 text-text-primary' : 'text-text-tertiary hover:text-text-primary hover:bg-white/10'}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-border-base mx-0.5 shrink-0" />;
}

// ── Color Picker ───────────────────────────────────────────────────────────────
const TEXT_COLORS = [
  '#f87171','#fb923c','#facc15','#4ade80','#34d399','#60a5fa',
  '#a78bfa','#f472b6','#ffffff','#d4d4d8','#a1a1aa','#71717a',
];
const HIGHLIGHT_COLORS = ['#fef08a','#bbf7d0','#bfdbfe','#fde68a','#fce7f3','#e9d5ff'];

function ColorPicker({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  if (!editor) return null;
  return (
    <div className="relative">
      <TB onClick={() => setOpen(o => !o)} active={open} title="Cor do texto / Destaque">
        <span className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-bold leading-none">A</span>
          <span className="w-3.5 h-0.5 rounded-full" style={{ background: editor.getAttributes('textStyle').color || '#ffffff' }} />
        </span>
      </TB>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-bg-secondary border border-border-base rounded-lg p-3 shadow-xl w-52">
            <p className="text-[10px] text-text-tertiary mb-2 uppercase tracking-wider">Cor do texto</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {TEXT_COLORS.map(c => (
                <button key={c} onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setOpen(false); }}
                  className="w-6 h-6 rounded-full border-2 border-white/20 cursor-pointer hover:scale-110 hover:border-white/60 transition-all shrink-0"
                  style={{ background: c }} />
              ))}
              <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setOpen(false); }}
                className="w-6 h-6 rounded-full border border-border-base cursor-pointer hover:bg-elements transition-colors flex items-center justify-center text-text-tertiary text-[9px] shrink-0">
                ✕
              </button>
            </div>
            <p className="text-[10px] text-text-tertiary mb-2 uppercase tracking-wider">Destaque</p>
            <div className="flex flex-wrap gap-1.5">
              {HIGHLIGHT_COLORS.map(c => (
                <button key={c} onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color: c }).run(); setOpen(false); }}
                  className="w-6 h-6 rounded-full border-2 border-white/20 cursor-pointer hover:scale-110 hover:border-white/60 transition-all shrink-0"
                  style={{ background: c }} />
              ))}
              <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); setOpen(false); }}
                className="w-6 h-6 rounded-full border border-border-base cursor-pointer hover:bg-elements transition-colors flex items-center justify-center text-text-tertiary text-[9px] shrink-0">
                ✕
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Link Input ─────────────────────────────────────────────────────────────────
function LinkButton({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  if (!editor) return null;

  const apply = () => {
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
    else editor.chain().focus().unsetLink().run();
    setOpen(false);
    setUrl('');
  };

  return (
    <div className="relative">
      <TB onClick={() => { setOpen(o => !o); setUrl(editor.getAttributes('link').href || ''); }} active={editor.isActive('link')} title="Link">
        <LinkIcon size={14} />
      </TB>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-bg-secondary border border-border-base rounded-lg p-3 shadow-xl flex gap-2 min-w-[240px]">
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && apply()}
              placeholder="https://..." autoFocus
              className="flex-1 text-sm bg-bg-primary border border-border-base rounded px-2 py-1.5 text-text-primary outline-none focus:border-border-gray" />
            <button onMouseDown={e => { e.preventDefault(); apply(); }}
              className="px-3 py-1.5 bg-btn-bg hover:bg-btn-hover text-text-primary rounded text-sm cursor-pointer transition-colors">
              OK
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Language Selector (code block) ────────────────────────────────────────────
const CODE_LANGS = ['javascript', 'typescript', 'python', 'html', 'css', 'sql', 'bash', 'json', 'markdown', 'plaintext'];

function LangSelector({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  if (!editor || !editor.isActive('codeBlock')) return null;
  const currentLang = editor.getAttributes('codeBlock').language || 'auto';
  return (
    <div className="relative ml-1">
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
        className="px-2 py-0.5 text-[10px] font-mono bg-elements rounded border border-border-base text-text-tertiary hover:text-text-primary cursor-pointer transition-colors"
      >
        {currentLang}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-bg-secondary border border-border-base rounded-lg shadow-xl overflow-hidden min-w-[120px]">
            {CODE_LANGS.map(lang => (
              <button
                key={lang}
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  editor.chain().focus().updateAttributes('codeBlock', { language: lang }).run();
                  setOpen(false);
                }}
                className={`block w-full text-left px-3 py-1.5 text-xs font-mono cursor-pointer transition-colors ${
                  currentLang === lang ? 'text-text-primary bg-elements' : 'text-text-secondary hover:bg-elements hover:text-text-primary'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Toolbar ────────────────────────────────────────────────────────────────────
function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border-base bg-bg-secondary/60 shrink-0 flex-wrap">
      {/* Histórico */}
      <TB onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)"><Undo2 size={14} /></TB>
      <TB onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)"><Redo2 size={14} /></TB>
      <Divider />

      {/* Títulos */}
      <TB onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1"><Heading1 size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2"><Heading2 size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3"><Heading3 size={14} /></TB>
      <Divider />

      {/* Formatação inline */}
      <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito (Ctrl+B)"><Bold size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico (Ctrl+I)"><Italic size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)"><UnderlineIcon size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado"><Strikethrough size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Código inline"><Code size={14} /></TB>
      <Divider />

      {/* Cor + Destaque */}
      <ColorPicker editor={editor} />
      <TB onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Destacar"><Highlighter size={14} /></TB>
      <Divider />

      {/* Alinhamento */}
      <TB onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinhar esquerda"><AlignLeft size={14} /></TB>
      <TB onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centralizar"><AlignCenter size={14} /></TB>
      <TB onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinhar direita"><AlignRight size={14} /></TB>
      <TB onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificar"><AlignJustify size={14} /></TB>
      <Divider />

      {/* Listas */}
      <TB onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista"><List size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada"><ListOrdered size={14} /></TB>
      <TB onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Lista de tarefas"><ListChecks size={14} /></TB>
      <Divider />

      {/* Blocos */}
      <TB onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citação"><Quote size={14} /></TB>
      <TB
        onClick={() => {
          if (editor.isActive('codeBlock')) editor.chain().focus().toggleCodeBlock().run();
          else editor.chain().focus().setCodeBlock({ language: 'javascript' }).run();
        }}
        active={editor.isActive('codeBlock')}
        title="Bloco de código"
      >
        <span className="text-[10px] font-mono font-bold">{'</>'}</span>
      </TB>
      <LangSelector editor={editor} />
      <TB onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha horizontal"><Minus size={14} /></TB>

      {/* Link */}
      <Divider />
      <LinkButton editor={editor} />
    </div>
  );
}

// ── Note Editor ────────────────────────────────────────────────────────────────
function NoteEditor({ noteId, onBack }: { noteId: string; onBack: () => void }) {
  const { notes, updateNote, deleteNote } = useStore();
  const note = notes.find(n => n.id === noteId);
  const [title, setTitle] = useState(note?.title ?? '');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((newTitle: string, newContent: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(async () => {
      await updateNote(noteId, { title: newTitle, content: newContent });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    }, 800);
  }, [noteId, updateNote]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight: createLowlight(common), defaultLanguage: null }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Comece a escrever...' }),
    ],
    content: note?.content ?? '',
    onUpdate: ({ editor }) => {
      save(title, editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && note && editor.getHTML() !== note.content) {
      editor.commands.setContent(note.content ?? '');
    }
  }, [noteId]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    save(val, editor?.getHTML() ?? '');
  };

  const handleDelete = async () => {
    await deleteNote(noteId);
    onBack();
  };

  if (!note) return null;

  return (
    <div className="flex flex-col h-full -mx-2 lg:-mx-8">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-base bg-bg-secondary/80 backdrop-blur shrink-0 sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer text-sm shrink-0">
          <ArrowLeft size={16} />
          Notas
        </button>
        <span className="text-xs text-text-tertiary">
          {saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? 'Salvo' : ''}
        </span>
        <button onClick={() => setShowDeleteModal(true)} className="text-text-tertiary hover:text-red-400 transition-colors cursor-pointer p-1.5 rounded hover:bg-red-500/10 shrink-0">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <Toolbar editor={editor} />

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto bg-bg-primary">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <input
            value={title}
            onChange={handleTitleChange}
            placeholder="Sem título"
            className="w-full text-3xl font-bold text-text-primary bg-transparent border-none outline-none placeholder:text-text-tertiary mb-6"
          />
          <EditorContent editor={editor} className="prose-editor min-h-[60vh] outline-none" />
        </div>
      </div>

      {showDeleteModal && (
        <ConfirmModal
          title="Deletar nota"
          message={`"${title || 'Sem título'}" será removida permanentemente.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}

// ── Notes List ─────────────────────────────────────────────────────────────────
export function NotesView() {
  const { notes, fetchNotes, createNote } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotes().finally(() => setIsLoading(false));
  }, []);

  const handleCreate = async () => {
    const id = await createNote();
    setSelectedId(id);
  };

  if (selectedId) {
    return <NoteEditor noteId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Bloco de Notas</h1>
          <p className="text-text-tertiary text-sm mt-0.5">{notes.length} {notes.length === 1 ? 'nota' : 'notas'}</p>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-btn-bg hover:bg-btn-hover text-text-primary rounded-lg font-medium text-sm transition-colors cursor-pointer">
          <Plus size={16} />
          Nova nota
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">Carregando...</div>
      ) : notes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-16">
          <FileText size={48} className="text-text-tertiary/30" />
          <p className="text-text-tertiary">Nenhuma nota ainda.</p>
          <button onClick={handleCreate} className="text-sm text-text-secondary hover:text-text-primary underline cursor-pointer transition-colors">
            Criar primeira nota
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => {
            const preview = note.content.replace(/<[^>]+>/g, '').slice(0, 120);
            const date = format(new Date(note.updatedAt), "d 'de' MMM", { locale: ptBR });
            return (
              <button key={note.id} onClick={() => setSelectedId(note.id)}
                className="text-left p-4 rounded-xl border border-border-base bg-bg-secondary hover:border-neutral-500 hover:bg-elements transition-all cursor-pointer">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <FileText size={14} className="text-text-tertiary shrink-0" />
                  <span className="text-xs text-text-tertiary ml-auto">{date}</span>
                </div>
                <h3 className="font-semibold text-text-primary truncate mb-1">{note.title || 'Sem título'}</h3>
                <p className="text-xs text-text-tertiary line-clamp-3 leading-relaxed">{preview || 'Nota vazia'}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
