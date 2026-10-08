import { useState } from 'react';
import { MessageSquare, Stamp } from 'lucide-react';
import { Button } from '@/shared/components/primitives';
import { Modal } from '@/shared/components/overlays';
import {
  generateSpeechBubbleCanvas,
  generateStampCanvas,
  STAMP_PRESETS,
  type BubbleType,
} from '@/services/imaging/stickerShapes';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';

export interface StickerTemplatesModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (dataUrl: string, name: string) => void;
}

export function StickerTemplatesModal({ open, onClose, onSelect }: StickerTemplatesModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'bubbles' | 'stamps'>('bubbles');

  if (!open) return null;

  const handleSelectBubble = (type: BubbleType, name: string) => {
    const canvas = generateSpeechBubbleCanvas({
      type,
      width: 440,
      height: 280,
      fillColor: '#FFFFFF',
      strokeColor: '#1A1A1A',
      strokeWidth: 10,
    });
    onSelect(canvas.toDataURL('image/png'), name);
    onClose();
  };

  const handleSelectStamp = (text: string, color: string) => {
    const canvas = generateStampCanvas(text, color, 420, 180);
    onSelect(canvas.toDataURL('image/png'), `Selo_${text}`);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={t('editor.templates.title')}
      onClose={onClose}
      footer={
        <Button variant="ghost" fullWidth onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Tab switch */}
        <div className="flex rounded-[12px] bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setTab('bubbles')}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[13px] font-medium transition-colors',
              tab === 'bubbles'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            <MessageSquare className="size-4" aria-hidden />
            <span>{t('editor.templates.bubblesTab')}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('stamps')}
            className={cx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[13px] font-medium transition-colors',
              tab === 'stamps'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            <Stamp className="size-4" aria-hidden />
            <span>{t('editor.templates.stampsTab')}</span>
          </button>
        </div>

        {/* Tab Content */}
        {tab === 'bubbles' ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleSelectBubble('speech', t('editor.templates.speech'))}
              className="flex flex-col items-center gap-2 rounded-[14px] border border-line bg-surface-2 p-3 transition-all hover:border-focus/50 hover:bg-surface-3 active:scale-95"
            >
              <div className="checkerboard flex h-20 w-full items-center justify-center rounded-[10px] p-2">
                <svg viewBox="0 0 100 65" className="h-full drop-shadow-sm">
                  <path
                    d="M 10 10 Q 10 5 15 5 L 85 5 Q 90 5 90 10 L 90 45 Q 90 50 85 50 L 35 50 L 15 62 L 25 50 L 15 50 Q 10 50 10 45 Z"
                    fill="#FFFFFF"
                    stroke="#1A1A1A"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-[12px] font-medium text-ink">
                {t('editor.templates.speech')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectBubble('thought', t('editor.templates.thought'))}
              className="flex flex-col items-center gap-2 rounded-[14px] border border-line bg-surface-2 p-3 transition-all hover:border-focus/50 hover:bg-surface-3 active:scale-95"
            >
              <div className="checkerboard flex h-20 w-full items-center justify-center rounded-[10px] p-2">
                <svg viewBox="0 0 100 65" className="h-full drop-shadow-sm">
                  <path
                    d="M 20 30 A 12 12 0 0 1 40 18 A 16 16 0 0 1 65 18 A 14 14 0 0 1 85 30 A 12 12 0 0 1 78 46 A 15 15 0 0 1 50 48 A 14 14 0 0 1 25 45 A 12 12 0 0 1 20 30 Z"
                    fill="#FFFFFF"
                    stroke="#1A1A1A"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="32" cy="54" r="3.5" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="2.5" />
                  <circle cx="26" cy="60" r="2" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="2" />
                </svg>
              </div>
              <span className="text-[12px] font-medium text-ink">
                {t('editor.templates.thought')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectBubble('shout', t('editor.templates.shout'))}
              className="flex flex-col items-center gap-2 rounded-[14px] border border-line bg-surface-2 p-3 transition-all hover:border-focus/50 hover:bg-surface-3 active:scale-95"
            >
              <div className="checkerboard flex h-20 w-full items-center justify-center rounded-[10px] p-2">
                <svg viewBox="0 0 100 65" className="h-full drop-shadow-sm">
                  <path
                    d="M 50 6 L 62 18 L 82 12 L 80 30 L 96 38 L 82 48 L 88 60 L 68 54 L 56 64 L 46 52 L 28 62 L 32 46 L 6 42 L 22 30 L 14 14 L 34 20 Z"
                    fill="#FFFFFF"
                    stroke="#1A1A1A"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-[12px] font-medium text-ink">
                {t('editor.templates.shout')}
              </span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STAMP_PRESETS.map((stamp) => (
              <button
                key={stamp.id}
                type="button"
                onClick={() => handleSelectStamp(stamp.text, stamp.color)}
                className="flex flex-col items-center justify-center rounded-[12px] border border-line bg-surface-2 p-3 transition-all hover:border-focus/50 hover:bg-surface-3 active:scale-95"
              >
                <div
                  className="rounded-[6px] border-2 border-dashed px-3 py-1 font-black text-[13px] tracking-wider select-none"
                  style={{
                    color: stamp.color,
                    borderColor: stamp.color,
                    transform: 'rotate(-4deg)',
                  }}
                >
                  {stamp.text}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
