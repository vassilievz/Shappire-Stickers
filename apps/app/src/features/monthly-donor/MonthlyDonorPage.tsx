import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Gift, Users, Copy, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, Spinner } from '@/shared/components/primitives';
import { BlurFade } from '@/shared/components/motion';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/state/authStore';
import { useProfileStore } from '@/state/profileStore';
import {
  createMonthlyDonorCharge,
  fetchMonthlyDonorStatus,
} from '@/services/api/monthlyDonorApi';
import {
  applyInviteCode,
  fetchInviteProgress,
  redeemInviteReward,
} from '@/services/api/inviteApi';
import { TextInput } from '@/shared/components/inputs';
import type { InviteProgressResponse, MonthlyDonorChargeCreateResponse, MonthlyDonorStatus } from '@shappire/contracts';
import { MONTHLY_DONOR_AMOUNT_BRL, MONTHLY_DONOR_PERIOD_DAYS } from '@shappire/contracts';
import { MonthlyDonorPixCheckout } from './MonthlyDonorPixCheckout';
import { showToast } from '@/state/toastStore';
import { writeClipboardText } from '@/services/native/clipboard';
import { shareText } from '@/services/native/shareService';
import { AvatarDecorationSheet } from '@/features/profile/AvatarDecorationSheet';
import { AppError, friendlyMessage } from '@/shared/errors';

export function MonthlyDonorPage() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);
  const profile = useProfileStore((s) => s.profile);
  const authUser = useAuthStore((s) => s.user);

  const [status, setStatus] = useState<MonthlyDonorStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteProgress, setInviteProgress] = useState<InviteProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCharge, setActiveCharge] = useState<MonthlyDonorChargeCreateResponse | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [applyingInvite, setApplyingInvite] = useState(false);

  const loadToastShown = useRef(false);
  const loadInFlight = useRef(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true);
    setLoadError(null);
    const [donorResult, inviteResult] = await Promise.allSettled([
      fetchMonthlyDonorStatus(),
      fetchInviteProgress(),
    ]);

    if (donorResult.status === 'fulfilled') {
      setStatus(donorResult.value.monthlyDonor);
    } else {
      const appErr = AppError.is(donorResult.reason) ? donorResult.reason : null;
      const message = friendlyMessage(donorResult.reason);
      setLoadError(message);
      if (!loadToastShown.current) {
        loadToastShown.current = true;
        showToast(message || t('monthlyDonor.loadError'), 'error');
      }
      if (appErr?.code === 'UNAUTHORIZED') {
        setStatus({ active: false, expiresAt: null, daysRemaining: 0 });
      }
    }

    if (inviteResult.status === 'fulfilled') {
      setInviteProgress(inviteResult.value);
    } else {
      setInviteProgress(null);
    }

    if (donorResult.status === 'fulfilled' || inviteResult.status === 'fulfilled') {
      void useProfileStore.getState().hydrate();
    }

    setLoading(false);
    loadInFlight.current = false;
  }, [authLoading, isAuthenticated, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const startPurchase = async () => {
    try {
      const charge = await createMonthlyDonorCharge();
      setActiveCharge(charge);
    } catch (error) {
      showToast(friendlyMessage(error) || t('monthlyDonor.createError'), 'error');
    }
  };

  const supportAccountId = profile?.publicId ?? authUser?.uid ?? '';

  const handleShareInvite = async () => {
    if (!inviteProgress?.inviteCode) return;
    const message = t('invites.shareMessage', { code: inviteProgress.inviteCode });
    try {
      await shareText({ title: t('invites.shareTitle'), text: message });
    } catch {
      await writeClipboardText(message);
      showToast(t('invites.copied'), 'success');
    }
  };

  const handleRedeem = async () => {
    setRedeeming(true);
    try {
      const res = await redeemInviteReward();
      setStatus(res.monthlyDonor);
      await load();
      showToast(t('invites.redeemSuccess'), 'success');
    } catch {
      showToast(t('invites.redeemError'), 'error');
    } finally {
      setRedeeming(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={<Sparkles className="size-6" aria-hidden />}
        title={t('monthlyDonor.signInTitle')}
        description={t('monthlyDonor.signInDesc')}
        action={
          <Button variant="primary" fullWidth loading={isSigningIn} onClick={() => void signInWithGoogle()}>
            {t('profile.signedOut.signIn')}
          </Button>
        }
      />
    );
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40dvh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (activeCharge) {
    return (
      <MonthlyDonorPixCheckout
        charge={activeCharge}
        onCancel={() => setActiveCharge(null)}
        onSuccess={() => {
          setActiveCharge(null);
          void load();
          void useProfileStore.getState().hydrate();
        }}
      />
    );
  }

  const active = status?.active ?? profile?.monthlyDonor?.active ?? false;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <BlurFade delayMs={0}>
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-accent">
              <Sparkles className="size-4" aria-hidden />
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t('monthlyDonor.title')}</h1>
          <p className="text-sm leading-relaxed text-ink-muted">{t('monthlyDonor.subtitle')}</p>
          <p className="text-[13px] font-medium text-ink-soft">
            {t('monthlyDonor.priceLine', { amount: MONTHLY_DONOR_AMOUNT_BRL, days: MONTHLY_DONOR_PERIOD_DAYS })}
          </p>
          <p className="text-[12px] text-ink-muted">{t('monthlyDonor.noAutoRenew')}</p>
        </header>
      </BlurFade>

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-semibold text-ink">{t('monthlyDonor.statusTitle')}</h2>
        {active ? (
          <>
            <p className="text-sm text-accent">{t('monthlyDonor.active')}</p>
            {status?.expiresAt ? (
              <p className="text-[13px] text-ink-muted">
                {t('monthlyDonor.expiresAt', { date: new Date(status.expiresAt).toLocaleDateString() })}
              </p>
            ) : null}
            {status?.daysRemaining ? (
              <p className="text-[13px] text-ink-muted">{t('monthlyDonor.daysLeft', { count: status.daysRemaining })}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-ink-muted">{t('monthlyDonor.expired')}</p>
        )}
        {loadError ? (
          <p className="text-[13px] text-red-500/90" role="alert">{loadError}</p>
        ) : null}
        <p className="text-[13px] leading-relaxed text-ink-muted">{t('monthlyDonor.supportReason')}</p>
        <Button variant="primary" fullWidth onClick={() => void startPurchase()}>
          {active ? t('monthlyDonor.renewCta', { amount: MONTHLY_DONOR_AMOUNT_BRL }) : t('monthlyDonor.unlockCta', { amount: MONTHLY_DONOR_AMOUNT_BRL })}
        </Button>
        <Button variant="secondary" fullWidth onClick={() => setGalleryOpen(true)}>
          {t('avatarDecorations.openGallery')}
        </Button>
      </Card>

      {inviteProgress ? (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-accent" aria-hidden />
            <h2 className="text-[15px] font-semibold text-ink">{t('invites.title')}</h2>
          </div>
          <p className="text-[13px] text-ink-muted">{t('invites.description')}</p>
          <p className="font-mono text-lg font-bold tracking-widest text-ink">{inviteProgress.inviteCode}</p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              icon={<Copy className="size-4" />}
              onClick={() => void writeClipboardText(inviteProgress.inviteCode).then(() => showToast(t('invites.copied'), 'success'))}
            >
              {t('invites.copy')}
            </Button>
            <Button variant="secondary" className="flex-1" icon={<Share2 className="size-4" />} onClick={() => void handleShareInvite()}>
              {t('invites.share')}
            </Button>
          </div>
          <p className="text-sm font-medium text-ink">
            {t('invites.progress', {
              current: inviteProgress.qualifiedInvites,
              total: inviteProgress.invitesPerReward,
            })}
          </p>
          {inviteProgress.rewardsAvailable > 0 ? (
            <Button variant="primary" fullWidth loading={redeeming} icon={<Gift className="size-4" />} onClick={() => void handleRedeem()}>
              {t('invites.redeemCta')}
            </Button>
          ) : null}
          {!inviteProgress.hasAppliedInvite ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-[12px] text-ink-muted">{t('invites.applyHint')}</p>
              <TextInput
                name="invite-code"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                label={t('invites.applyLabel')}
              />
              <Button
                variant="secondary"
                fullWidth
                loading={applyingInvite}
                disabled={!inviteInput.trim()}
                onClick={() => {
                  setApplyingInvite(true);
                  void applyInviteCode(inviteInput)
                    .then(() => {
                      showToast(t('invites.applySuccess'), 'success');
                      setInviteInput('');
                      return load();
                    })
                    .catch(() => showToast(t('invites.applyError'), 'error'))
                    .finally(() => setApplyingInvite(false));
                }}
              >
                {t('invites.applyButton')}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {supportAccountId ? (
        <button
          type="button"
          className="flex min-h-[44px] w-full flex-col items-center gap-1 rounded-[var(--radius-card)] border border-line bg-surface-2/50 px-4 py-3 text-center"
          onClick={() =>
            void writeClipboardText(supportAccountId).then(() => showToast(t('settings.accountIdCopied'), 'success'))
          }
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t('settings.accountIdLabel')}
          </span>
          <span className="max-w-full truncate font-mono text-[12px] text-ink">{supportAccountId}</span>
          <span className="text-[11px] text-ink-muted">{t('settings.accountIdHint')}</span>
        </button>
      ) : null}

      <p className="text-center text-[12px] text-ink-muted">
        <Link to="/apoiar" className="underline">{t('monthlyDonor.voluntaryDonationLink')}</Link>
      </p>

      <AvatarDecorationSheet open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
}
