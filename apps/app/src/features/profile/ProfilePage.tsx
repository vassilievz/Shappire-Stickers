import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Heart, ImageOff, Layers, Pencil, Settings, Sparkles, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, Spinner } from '@/shared/components/primitives';
import { BlurFade } from '@/shared/components/motion';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/state/authStore';
import { useProfileStats, useProfileStore } from '@/state/profileStore';
import { EditProfileSheet } from './EditProfileSheet';
import { InitialSupporterBadge } from './components/InitialSupporterBadge';
import { INITIAL_SUPPORTER_BADGE } from '@shappire/contracts';
import { formatDate } from '@/shared/utils/format';
import { DecoratedAvatar } from '@/shared/components/DecoratedAvatar';

function BannerMedia({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-surface-3 via-surface-2 to-surface-3">
        <div className="flex size-full items-center justify-center text-ink-muted/40">
          <ImageOff className="size-5" aria-hidden />
        </div>
      </div>
    );
  }
  return (
    <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
  );
}

function ProfileShortcuts({ showMyPublications = false }: { showMyPublications?: boolean }) {
  const { t } = useTranslation();
  const links = [
    ...(showMyPublications
      ? [
          {
            to: '/comunidade/minhas-publicacoes',
            icon: Layers,
            title: t('profile.quickMyPublications'),
            description: t('profile.quickMyPublicationsDesc'),
          },
        ]
      : []),
    {
      to: '/doador-mensal',
      icon: Sparkles,
      title: t('profile.quickMonthlyDonor'),
      description: t('profile.quickMonthlyDonorDesc'),
    },
    {
      to: '/apoiar',
      icon: Heart,
      title: t('profile.quickSupport'),
      description: t('profile.quickSupportDesc'),
    },
    {
      to: '/configuracoes',
      icon: Settings,
      title: t('profile.quickSettings'),
      description: t('profile.quickSettingsDesc'),
    },
  ] as const;

  return (
    <nav aria-label={t('common.actions')} className="flex flex-col gap-2">
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className="flex min-h-[52px] items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{item.title}</span>
              <span className="block text-[12px] leading-snug text-ink-muted">{item.description}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 px-2 py-3 text-center">
      <span className="text-[17px] font-semibold tabular-nums leading-none text-ink">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="h-36 animate-pulse rounded-[var(--radius-card)] border border-line bg-surface" />
      <div className="flex items-center gap-4">
        <div className="-mt-12 size-24 animate-pulse rounded-full border-4 border-app bg-surface" />
        <div className="flex flex-col gap-2">
          <div className="h-5 w-40 animate-pulse rounded-full bg-surface" />
          <div className="h-3.5 w-24 animate-pulse rounded-full bg-surface" />
        </div>
      </div>
      <div className="h-16 animate-pulse rounded-[var(--radius-card)] border border-line bg-surface" />
    </div>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authUser = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isSigningIn = useAuthStore((state) => state.isSigningIn);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);

  const storeProfile = useProfileStore((state) => state.profile);
  const authProfile = useAuthStore((state) => state.profile);
  // Usa o perfil persistido no MongoDB ou fallback para a conta autenticada do Firebase
  const profile = storeProfile ?? authProfile;
  const status = useProfileStore((state) => state.status);
  const error = useProfileStore((state) => state.error);
  const hydrate = useProfileStore((state) => state.hydrate);
  const stats = useProfileStats();

  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Spinner className="size-6 text-ink-muted" />
      </div>
    );
  }

  // Apenas exibe "You are not signed in" se o Firebase Auth realmente não possuir usuário autenticado
  if (!isAuthenticated && !authUser) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <EmptyState
          icon={<UserRound className="size-6" aria-hidden />}
          title={t('profile.signedOut.title')}
          description={t('profile.signedOut.description')}
          action={
            <div className="flex w-full max-w-sm flex-col gap-4">
              <Button
                variant="primary"
                fullWidth
                loading={isSigningIn}
                onClick={() => void signInWithGoogle()}
              >
                {t('profile.signedOut.signIn')}
              </Button>
              <ProfileShortcuts showMyPublications={false} />
            </div>
          }
        />
      </div>
    );
  }

  if (!profile) {
    if (status === 'error') {
      const errorDescription =
        error === 'UNAUTHORIZED'
          ? t('errors.UNAUTHORIZED')
          : error === 'OFFLINE'
          ? t('errors.OFFLINE')
          : error === 'NETWORK_ERROR'
          ? t('errors.NETWORK_ERROR')
          : t('errors.UNKNOWN');

      return (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <EmptyState
            icon={<UserRound className="size-6" aria-hidden />}
            title={t('profile.title')}
            description={errorDescription}
            action={
              <Button variant="secondary" fullWidth onClick={() => void hydrate()}>
                {t('common.retry')}
              </Button>
            }
          />
        </div>
      );
    }
    return <ProfileSkeleton />;
  }

  const isIncomplete = !profile.username && !profile.bio && !profile.avatar;
  const avatarSrc = profile.avatar?.url ?? profile.photoURL;

  const actions: ReactNode = (
    <Button
      variant={isIncomplete ? 'primary' : 'secondary'}
      size="sm"
      onClick={() => setEditOpen(true)}
      icon={<Pencil className="size-3.5" aria-hidden />}
    >
      {t('profile.editProfile')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      <BlurFade delayMs={0} durationMs={320}>
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {t('profile.title')}
            </h1>
            <p className="mt-1 max-w-[36ch] text-[14px] leading-relaxed text-ink-muted">
              {t('profile.subtitle')}
            </p>
          </div>
          <div className="shrink-0">{actions}</div>
        </header>
      </BlurFade>

      {isIncomplete ? (
        <BlurFade delayMs={80} durationMs={320}>
          <EmptyState
            icon={<UserRound className="size-6" aria-hidden />}
            title={t('profile.completeProfile')}
            description={t('profile.completeProfileDesc')}
            className="py-4"
          />
        </BlurFade>
      ) : null}

      <BlurFade delayMs={isIncomplete ? 140 : 80} durationMs={320}>
        <Card className="overflow-hidden">
          <div className="h-36 w-full border-b border-line">
            <BannerMedia src={profile.banner?.url ?? null} />
          </div>

          <div className="relative px-5 pb-5">
            <div className="-mt-12 mb-3">
              <DecoratedAvatar
                src={avatarSrc}
                size="xl"
                decoration={profile.avatarDecoration}
                decorationPriority
                avatarClassName="ring-4 ring-app"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[19px] font-semibold tracking-[-0.01em] text-ink">
                  {profile.displayName}
                </h2>
                {profile.badges?.includes(INITIAL_SUPPORTER_BADGE) ? (
                  <InitialSupporterBadge size="md" />
                ) : null}
              </div>
              {profile.badges?.includes(INITIAL_SUPPORTER_BADGE) ? (
                <div className="mt-0.5">
                  <InitialSupporterBadge showLabel size="sm" />
                </div>
              ) : null}
              {profile.username ? (
                <p className="text-[13px] font-medium text-ink-muted">@{profile.username}</p>
              ) : null}
              {profile.bio ? (
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{profile.bio}</p>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 divide-x divide-line rounded-[14px] border border-line bg-surface-2/60">
              <StatCell value={String(stats.packs)} label={t('profile.stats.packs')} />
              <StatCell value={String(stats.stickers)} label={t('profile.stats.stickers')} />
            </div>
            {profile.createdAt ? (
              <p className="mt-2.5 text-center text-[12px] font-medium text-ink-muted">
                {t('profile.stats.memberSince', { date: formatDate(profile.createdAt) })}
              </p>
            ) : null}
          </div>
        </Card>
      </BlurFade>

      <BlurFade delayMs={200} durationMs={320}>
        <ProfileShortcuts showMyPublications />
      </BlurFade>

      <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
