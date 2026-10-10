import { useState } from 'react';
import { DONATION_AMOUNTS, DONATION_MIN_AMOUNT, DONATION_MAX_AMOUNT } from '@shappire/contracts';
import { Button } from '@/shared/components/primitives';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';
import { Heart } from 'lucide-react';

interface DonationAmountSelectorProps {
  onSelectAmount: (amount: number) => void;
  isLoading?: boolean;
}

export function DonationAmountSelector({
  onSelectAmount,
  isLoading = false,
}: DonationAmountSelectorProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number>(20); // Padrão: R$ 20
  const [customValue, setCustomValue] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePresetSelect = (amount: number) => {
    setIsCustom(false);
    setSelected(amount);
    setError(null);
  };

  const handleCustomChange = (val: string) => {
    // Permite apenas dígitos
    const clean = val.replace(/\D/g, '');
    setCustomValue(clean);
    setIsCustom(true);

    if (!clean) {
      setError(null);
      return;
    }

    const num = Number(clean);
    if (num < DONATION_MIN_AMOUNT) {
      setError(t('donations.minAmountError', { min: DONATION_MIN_AMOUNT }));
    } else if (num > DONATION_MAX_AMOUNT) {
      setError(t('donations.maxAmountError', { max: DONATION_MAX_AMOUNT }));
    } else {
      setError(null);
    }
  };

  const currentAmount = isCustom ? Number(customValue) : selected;
  const isValid =
    Number.isFinite(currentAmount) &&
    currentAmount >= DONATION_MIN_AMOUNT &&
    currentAmount <= DONATION_MAX_AMOUNT &&
    !error;

  const handleSubmit = () => {
    if (isValid) {
      onSelectAmount(currentAmount);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {DONATION_AMOUNTS.map((val) => {
          const isSelected = !isCustom && selected === val;
          return (
            <button
              key={val}
              type="button"
              disabled={isLoading}
              onClick={() => handlePresetSelect(val)}
              className={cx(
                'relative flex flex-col items-center justify-center rounded-[16px] border p-3.5 transition-all select-none',
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 font-bold shadow-sm shadow-indigo-500/20'
                  : 'border-line bg-surface hover:bg-surface-2 text-ink',
              )}
            >
              <span className="text-[12px] font-medium text-ink-muted">R$</span>
              <span className="text-[20px] font-bold leading-tight">{val}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="custom-donation" className="text-[13px] font-medium text-ink-muted">
          {t('donations.customAmountLabel')}
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-[15px] font-semibold text-ink-muted">R$</span>
          <input
            id="custom-donation"
            type="text"
            inputMode="numeric"
            placeholder={t('donations.customAmountPlaceholder')}
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            disabled={isLoading}
            className={cx(
              'h-12 w-full rounded-[14px] border bg-surface pl-10 pr-4 text-[16px] font-medium text-ink transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
              isCustom && !error ? 'border-indigo-500' : 'border-line',
              error ? 'border-rose-500 text-rose-500' : '',
            )}
          />
        </div>
        {error && <span className="text-[12px] font-medium text-rose-400">{error}</span>}
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={isLoading}
        disabled={!isValid || isLoading}
        onClick={handleSubmit}
        icon={<Heart className="size-4 fill-current text-rose-400" aria-hidden />}
      >
        {t('donations.continueToPix', { amount: currentAmount || 0 })}
      </Button>
    </div>
  );
}
