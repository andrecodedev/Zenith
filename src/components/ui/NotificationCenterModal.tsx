import { useState } from 'react';
import { X, Trash2, Eye, EyeOff, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (val: boolean) => void;
  onTaskClick?: (routineId: string, dateStr: string) => void;
}

export function NotificationCenterModal({
  isOpen,
  onClose,
  notificationsEnabled,
  setNotificationsEnabled,
  onTaskClick,
}: NotificationCenterModalProps) {
  const {
    appNotifications,
    clearNotifications,
    deleteNotificationsByIds,
    setNotificationsRead,
    markNotificationRead,
  } = useStore();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const targetIds = selected.size > 0
    ? [...selected]
    : appNotifications.map(n => n.id);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === appNotifications.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(appNotifications.map(n => n.id)));
    }
  };

  // Eye no header: se algum alvo está não-lido → marca todos como lidos; senão desmark
  const handleBulkEye = () => {
    const targets = appNotifications.filter(n => targetIds.includes(n.id));
    const anyUnread = targets.some(n => !n.read);
    setNotificationsRead(targetIds, anyUnread);
  };

  const handleTrashClick = () => {
    if (appNotifications.length === 0) return;
    setConfirmDelete(true);
  };

  const handleConfirmDelete = () => {
    if (selected.size > 0) {
      deleteNotificationsByIds([...selected]);
      setSelected(new Set());
    } else {
      clearNotifications();
    }
    setConfirmDelete(false);
  };

  const handleCardClick = (id: string, routineId?: string, dateStr?: string) => {
    markNotificationRead(id);
    if (routineId && dateStr && onTaskClick) {
      onTaskClick(routineId, dateStr);
    }
  };

  const deleteCount = selected.size > 0 ? selected.size : appNotifications.length;
  const allSelected = appNotifications.length > 0 && selected.size === appNotifications.length;

  // Eye estado bulk: se algum alvo não lido → ícone Eye (vai marcar lido); senão EyeOff
  const targetNotifs = appNotifications.filter(n => targetIds.includes(n.id));
  const bulkEyeIsRead = targetNotifs.length > 0 && targetNotifs.every(n => n.read);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-base shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold font-title text-text-primary">Notificações</h3>
            {appNotifications.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                title={allSelected ? 'Desselecionar tudo' : 'Selecionar tudo'}
              >
                {allSelected ? <CheckSquare size={17} /> : <Square size={17} />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {appNotifications.length > 0 && (
              <button
                onClick={handleBulkEye}
                className="p-2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                title={bulkEyeIsRead
                  ? (selected.size > 0 ? 'Marcar selecionadas como não lidas' : 'Marcar todas como não lidas')
                  : (selected.size > 0 ? 'Marcar selecionadas como lidas' : 'Marcar todas como lidas')}
              >
                {bulkEyeIsRead ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
            <button
              onClick={handleTrashClick}
              className="p-2 text-text-tertiary hover:text-red-400 transition-colors cursor-pointer relative"
              title={selected.size > 0 ? `Excluir ${selected.size} selecionada(s)` : 'Excluir todas'}
            >
              <Trash2 size={18} />
              {selected.size > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {selected.size}
                </span>
              )}
            </button>
            <button
              onClick={() => { onClose(); setConfirmDelete(false); setSelected(new Set()); }}
              className="p-2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Confirm Delete Banner */}
        {confirmDelete && (
          <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/30 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
              <AlertTriangle size={16} />
              Excluir {deleteCount} notificaç{deleteCount === 1 ? 'ão' : 'ões'}?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 text-xs font-bold text-text-secondary hover:text-text-primary border border-border-base rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}

        {/* Settings Toggle */}
        <div className="p-4 bg-bg-primary/50 border-b border-border-base flex items-center justify-between shrink-0">
          <span className="text-sm font-bold text-text-primary">Receber Alertas do Navegador</span>
          <button
            onClick={() => {
              const newValue = !notificationsEnabled;
              setNotificationsEnabled(newValue);
              localStorage.setItem('notifications_enabled', String(newValue));
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${notificationsEnabled ? 'bg-green-500' : 'bg-text-tertiary'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {appNotifications.length === 0 ? (
            <div className="text-center text-text-tertiary py-8">
              Nenhuma notificação ainda.
            </div>
          ) : (
            appNotifications.map(notif => {
              const isSelected = selected.has(notif.id);
              const isClickable = !!(notif.routineId && notif.dateStr && onTaskClick);

              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-elements border-border-gray ring-1 ring-border-gray'
                      : notif.read
                      ? 'bg-bg-primary border-border-base opacity-60'
                      : 'bg-elements border-border-gray'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(notif.id)}
                    className="mt-0.5 shrink-0 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                  >
                    {isSelected
                      ? <CheckSquare size={16} className="text-text-primary" />
                      : <Square size={16} />}
                  </button>

                  {/* Content — clicar aqui marca como lida (+ navega se tiver tarefa) */}
                  <div
                    className={`flex-1 min-w-0 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => handleCardClick(notif.id, notif.routineId, notif.dateStr)}
                  >
                    <h4 className="text-sm font-bold text-text-primary mb-1 flex items-center gap-2">
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      )}
                      {notif.title}
                    </h4>
                    <p className="text-xs text-text-secondary mb-2 line-clamp-2">{notif.message}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-tertiary">
                        {formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: ptBR })}
                      </span>
                      {isClickable && (
                        <span className="text-[10px] text-text-primary underline">Ver tarefa →</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
