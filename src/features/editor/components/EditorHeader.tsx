import { ArrowLeft, Check, LoaderCircle, Redo2, Save, Send, Undo2 } from 'lucide-react';
import { IconButton } from '@/shared/components/primitives';
import { cx } from '@/shared/utils/cx';
import type { SaveStatus } from '@/features/editor/store/editorStore';
import { useTranslation } from '@/i18n';

export interface EditorHeaderProps {
  projectName: string;
  dirty: boolean;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  exporting: boolean;
  onBack: () => void;
  onRename: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExport: () => void;
}

export function EditorHeader({
  projectName,
  dirty,
  saveStatus,
  canUndo,
  canRedo,
  exporting,
  onBack,
  onRename,
  onUndo,
  onRedo,
  onSave,
  onExport,
}: EditorHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="safe-top flex items-center gap-2 border-b border-line bg-surface/95 px-2.5 py-2 backdrop-blur">
      <IconButton label={t('common.back')} onClick={onBack}>
        <ArrowLeft className="size-5" aria-hidden />
      </IconButton>

      <button
        type="button"
        onClick={onRename}
        className="min-w-0 flex-1 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
      >
        <span className="block truncate text-[14px] font-medium text-ink">{projectName}</span>
        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
          {saveStatus === 'saving' ? (
            <>
              <LoaderCircle className="size-3 animate-spin" aria-hidden />
              {t('editor.header.saving')}
            </>
          ) : dirty ? (
            t('editor.header.unsaved')
          ) : saveStatus === 'error' ? (
            <span className="text-danger">{t('editor.header.error')}</span>
          ) : (
            <>
              <Check className="size-3" aria-hidden />
              {t('editor.header.savedOnDevice')}
            </>
          )}
        </span>
      </button>

      <IconButton label={t('editor.header.undo')} onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="size-5" aria-hidden />
      </IconButton>
      <IconButton label={t('editor.header.redo')} onClick={onRedo} disabled={!canRedo}>
        <Redo2 className="size-5" aria-hidden />
      </IconButton>
      <IconButton label={t('editor.header.save')} onClick={onSave}>
        <Save className={cx('size-5', dirty ? 'text-ink' : 'opacity-70')} aria-hidden />
      </IconButton>

      <button
        type="button"
        onClick={onExport}
        disabled={exporting}
        className="ml-1 inline-flex h-10 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-[12px] bg-accent px-3.5 text-[13px] font-semibold text-on-accent transition-all active:scale-[0.97] active:opacity-85 disabled:opacity-50 touch-manipulation"
      >
        {exporting ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <Send className="size-4" aria-hidden />
        )}
        {t('editor.header.export')}
      </button>
    </header>
  );
}
