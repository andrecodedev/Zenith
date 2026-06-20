import { X, Trash2 } from 'lucide-react';
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

export function NotificationCenterModal({ isOpen, onClose, notificationsEnabled, setNotificationsEnabled, onTaskClick }: NotificationCenterModalProps) {
  const { appNotifications, clearNotifications } = useStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-base rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-base">
          <h3 className="text-xl font-bold font-title text-text-primary">Notificações</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={clearNotifications}
              className="p-2 text-text-tertiary hover:text-red-400 transition-colors cursor-pointer"
              title="Limpar Histórico"
            >
              <Trash2 size={20} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Settings Toggle */}
        <div className="p-4 bg-bg-primary/50 border-b border-border-base flex items-center justify-between">
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

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {appNotifications.length === 0 ? (
            <div className="text-center text-text-tertiary py-8">
              Nenhuma notificação ainda.
            </div>
          ) : (
            appNotifications.map(notif => (
              <div 
                key={notif.id} 
                onClick={() => {
                  if (onTaskClick && notif.routineId && notif.dateStr) {
                    onTaskClick(notif.routineId, notif.dateStr);
                    onClose();
                  }
                }}
                className={`p-3 rounded-lg border ${notif.routineId ? 'cursor-pointer hover:border-text-tertiary transition-colors' : ''} ${notif.read ? 'bg-bg-primary border-border-base opacity-70' : 'bg-elements border-border-gray'}`}
              >
                <h4 className="text-sm font-bold text-text-primary mb-1">{notif.title}</h4>
                <p className="text-xs text-text-secondary mb-2">{notif.message}</p>
                <span className="text-[10px] text-text-tertiary">
                  {formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
