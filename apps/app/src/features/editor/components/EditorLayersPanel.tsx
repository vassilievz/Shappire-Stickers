import type { ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Paintbrush,
  Trash2,
  Type,
} from 'lucide-react';
import { elementDisplayName, type EditorElement } from '@/domain/editor/elements';
import { useEditorStore } from '@/features/editor/store/editorStore';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';

const KIND_ICONS = {
  image: ImageIcon,
  text: Type,
  drawing: Paintbrush,
} as const;

export function EditorLayersPanel() {
  const { t } = useTranslation();
  const elements = useEditorStore((state) => state.history.present);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const selectOnly = useEditorStore((state) => state.selectOnly);
  const toggleVisibility = useEditorStore((state) => state.toggleVisibility);
  const toggleLock = useEditorStore((state) => state.toggleLock);
  const reorder = useEditorStore((state) => state.reorder);
  const removeElements = useEditorStore((state) => state.removeElements);

  if (elements.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-[13px] text-ink-muted">
        {t('editor.layersPanel.noLayers')}
      </p>
    );
  }

  const ordered = [...elements].reverse();
  const selected = new Set(selectedIds);

  return (
    <ul className="flex flex-col gap-1 pb-2">
      {ordered.map((element) => (
        <LayerRow
          key={element.id}
          element={element}
          index={elements.indexOf(element)}
          total={elements.length}
          isSelected={selected.has(element.id)}
          onSelect={() => selectOnly(element.id)}
          onToggleVisibility={() => toggleVisibility(element.id)}
          onToggleLock={() => toggleLock(element.id)}
          onMoveUp={() => reorder(element.id, 'forward')}
          onMoveDown={() => reorder(element.id, 'backward')}
          onRemove={() => removeElements([element.id])}
        />
      ))}
    </ul>
  );
}

interface LayerRowProps {
  element: EditorElement;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function LayerRow({
  element,
  index,
  total,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onMoveUp,
  onMoveDown,
  onRemove,
}: LayerRowProps) {
  const { t } = useTranslation();
  const Icon = KIND_ICONS[element.kind];

  const posLabel =
    total <= 1
      ? t('editor.layersPanel.onlyLayer')
      : index === total - 1
        ? t('editor.layersPanel.front')
        : index === 0
          ? t('editor.layersPanel.back')
          : t('editor.layersPanel.position', { index: index + 1, total });

  return (
    <li
      className={cx(
        'flex items-center gap-2 rounded-[12px] border px-2 py-1.5 transition-colors',
        isSelected ? 'border-focus/50 bg-surface-2' : 'border-transparent hover:bg-surface-2/60',
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-surface-3 text-ink-soft">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">
            {elementDisplayName(element)}
          </span>
          <span className="block text-[11px] text-ink-muted">
            {posLabel}
            {element.locked ? ` · ${t('editor.layersPanel.locked')}` : ''}
            {element.visible ? '' : ` · ${t('editor.layersPanel.hidden')}`}
          </span>
        </span>
      </button>

      <div className="flex items-center gap-0.5">
        <LayerIconButton
          label={element.visible ? t('editor.properties.hide') : t('editor.properties.show')}
          onClick={onToggleVisibility}
        >
          {element.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </LayerIconButton>
        <LayerIconButton
          label={element.locked ? t('editor.properties.unlock') : t('editor.properties.lock')}
          onClick={onToggleLock}
        >
          {element.locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
        </LayerIconButton>
        <LayerIconButton label={t('editor.properties.forward')} onClick={onMoveUp}>
          <ArrowUp className="size-4" />
        </LayerIconButton>
        <LayerIconButton label={t('editor.properties.backward')} onClick={onMoveDown}>
          <ArrowDown className="size-4" />
        </LayerIconButton>
        <LayerIconButton label={t('editor.properties.delete')} tone="danger" onClick={onRemove}>
          <Trash2 className="size-4" />
        </LayerIconButton>
      </div>
    </li>
  );
}

function LayerIconButton({
  label,
  tone = 'default',
  onClick,
  children,
}: {
  label: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'flex size-8 items-center justify-center rounded-[9px] transition-colors',
        tone === 'danger'
          ? 'text-danger hover:bg-danger/12'
          : 'text-ink-muted hover:bg-surface-3 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
