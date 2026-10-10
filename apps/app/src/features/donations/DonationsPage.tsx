import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShieldCheck, Zap, UserRound } from 'lucide-react';
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
      <div className="flex flex-col gap-6 pb-12">
        <BlurFade delayMs={0} durationMs={320}>
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-accent">
                <Heart className="size-4" strokeWidth={2.2} aria-hidden />
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[26px]">
              {t('donations.title')}
            </h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              {t('donations.subtitle')}
            </p>
          </header>
        </BlurFade>

        <BlurFade delayMs={80} durationMs={320}>
          <EmptyState
            icon={<UserRound className="size-6 text-ink-muted" aria-hidden />}
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
    <div className="flex flex-col gap-6 pb-12">
      <BlurFade delayMs={0} durationMs={320}>
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-accent">
              <Heart className="size-4" strokeWidth={2.2} aria-hidden />
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[26px]">
            {t('donations.title')}
          </h1>
          <p className="text-sm leading-relaxed text-ink-muted">
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
          <BlurFade delayMs={60} durationMs={320}>
            <Card className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-accent/10">
                  <InitialSupporterIcon size="lg" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="text-base font-semibold text-ink">
                    {t('donations.badgeRewardTitle')}
                  </h2>
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

              <div className="border-t border-line pt-5">
                <h3 className="mb-4 text-[15px] font-semibold text-ink">
                  {t('donations.selectAmountTitle')}
                </h3>
                <DonationAmountSelector
                  onSelectAmount={handleStartDonation}
                  isLoading={isLoading}
                />
              </div>
            </Card>
          </BlurFade>

          <BlurFade delayMs={120} durationMs={320}>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 p-3.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-ink">
                    {t('donations.benefitIndependentTitle')}
                  </span>
                  <span className="text-xs leading-relaxed text-ink-muted">
                    {t('donations.benefitIndependentDesc')}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 p-3.5">
                <Zap className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-ink">
                    {t('donations.benefitDevelopmentTitle')}
                  </span>
                  <span className="text-xs leading-relaxed text-ink-muted">
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
