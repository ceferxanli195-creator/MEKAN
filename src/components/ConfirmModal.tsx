import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Təsdiq et',
  cancelText = 'İmtina',
  isDanger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="confirm-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="confirm-modal-dialog"
        className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isDanger
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
                  : 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400'
                : 'bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400'
            }`}
          >
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
