import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Sparkles, ShieldCheck, Zap, UserRound } from 'lucide-react';
import { Button, Card, EmptyState } from '@/shared/components/primitives';
import { BlurFade } from '@/shared/components/motion';
import { showToast } from '@/state/toastStore';
import { useAuthStore } from '@/state/authStore';
import { useProfileStore } from '@/state/profileStore';
import { createDonation } from '@/services/api/donationApi';
import { InitialSupporterBadge, InitialSupporterIcon } from '@/features/profile/components/InitialSupporterBadge';
import { DonationAmountSelector } from './DonationAmountSelector';
import { PixCheckoutView } from './PixCheckoutView';
import { INITIAL_SUPPORTER_BADGE, type DonationCreateResponse } from '@shappire/contracts';
import { useTranslation } from '@/i18n';

export function DonationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isSigningIn = useAuthStore((state) => state.isSigningIn);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);

  const storeProfile = useProfileStore((state) => state.profile);
  const authProfile = useAuthStore((state) => state.profile);
  const profile = storeProfile ?? authProfile;
  const isAlreadySupporter = Boolean(profile?.badges?.includes(INITIAL_SUPPORTER_BADGE));

  const [activeDonation, setActiveDonation] = useState<DonationCreateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartDonation = async (amount: number) => {
    try {
      setIsLoading(true);
      const donation = await createDonation(amount);
      setActiveDonation(donation);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('donations.createError');
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-6 pb-6">
        <BlurFade delayMs={0} durationMs={320}>
          <header className="flex flex-col gap-1">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {t('donations.title')}
            </h1>
            <p className="text-[14px] leading-relaxed text-ink-muted">
              {t('donations.subtitle')}
            </p>
          </header>
        </BlurFade>

        <BlurFade delayMs={80} durationMs={320}>
          <EmptyState
            icon={<UserRound className="size-6 text-indigo-400" aria-hidden />}
            title={t('donations.signInRequiredTitle')}
            description={t('donations.signInRequiredDesc')}
            action={
              <Button
                variant="primary"
                fullWidth
                loading={isSigningIn}
                onClick={() => void signInWithGoogle()}
              >
                {t('profile.signedOut.signIn')}
              </Button>
            }
          />
        </BlurFade>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <BlurFade delayMs={0} durationMs={320}>
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Heart className="size-6 fill-rose-500 text-rose-500" />
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {t('donations.title')}
            </h1>
          </div>
          <p className="text-[14px] leading-relaxed text-ink-muted">
            {t('donations.subtitle')}
          </p>
        </header>
      </BlurFade>

      {activeDonation ? (
        <BlurFade delayMs={60} durationMs={300}>
          <PixCheckoutView
            donation={activeDonation}
            onCancel={() => setActiveDonation(null)}
            onSuccess={() => {
              setActiveDonation(null);
              navigate('/perfil');
            }}
          />
        </BlurFade>
      ) : (
        <>
          {/* Card de apresentação da insígnia de Apoiador */}
          <BlurFade delayMs={60} durationMs={320}>
            <Card className="relative overflow-hidden border-indigo-500/20 bg-gradient-to-br from-surface via-surface-2 to-indigo-500/5 p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                  <InitialSupporterIcon size="lg" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-bold text-ink">
                      {t('donations.badgeRewardTitle')}
                    </h2>
                    <Sparkles className="size-4 text-amber-400" />
                  </div>
                  <p className="text-[13px] leading-relaxed text-ink-muted">
                    {t('donations.badgeRewardDesc')}
                  </p>
                  {isAlreadySupporter && (
                    <div className="mt-2 flex items-center">
                      <InitialSupporterBadge showLabel size="sm" />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </BlurFade>

          {/* Seletor de Valores */}
          <BlurFade delayMs={120} durationMs={320}>
            <Card className="p-5">
              <h3 className="text-[15px] font-semibold text-ink mb-4">
                {t('donations.selectAmountTitle')}
              </h3>
              <DonationAmountSelector
                onSelectAmount={handleStartDonation}
                isLoading={isLoading}
              />
            </Card>
          </BlurFade>

          {/* Por que apoiar */}
          <BlurFade delayMs={160} durationMs={320}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-[16px] border border-line bg-surface p-4">
                <ShieldCheck className="size-5 shrink-0 text-indigo-400 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-ink">
                    {t('donations.benefitIndependentTitle')}
                  </span>
                  <span className="text-[12px] leading-relaxed text-ink-muted">
                    {t('donations.benefitIndependentDesc')}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-[16px] border border-line bg-surface p-4">
                <Zap className="size-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-ink">
                    {t('donations.benefitDevelopmentTitle')}
                  </span>
                  <span className="text-[12px] leading-relaxed text-ink-muted">
                    {t('donations.benefitDevelopmentDesc')}
                  </span>
                </div>
              </div>
            </div>
          </BlurFade>
        </>
      )}
    </div>
  );
}
