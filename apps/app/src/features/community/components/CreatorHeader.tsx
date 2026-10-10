import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import type { PublicAuthor } from '@shappire/contracts';
import { useTranslation } from '@/i18n';
import { formatRelative } from '@/shared/utils/format';

export function CreatorHeader({
  author,
  publishedAt,
}: {
  author?: PublicAuthor | null;
  ownerUid?: string;
  publishedAt?: string | null;
}) {
  const { t } = useTranslation();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const profilePath = author?.username ? `/comunidade/criador/${author.username}` : null;
  const avatarUrl = author?.avatar?.url;
  const showAvatar = avatarUrl && !avatarFailed;
  const publishedLabel = publishedAt ? formatRelative(publishedAt) : null;

  const avatarNode = showAvatar ? (
    <img
      src={avatarUrl}
      alt=""
      className="size-11 rounded-full border border-line object-cover"
      onError={() => setAvatarFailed(true)}
    />
  ) : (
    <div className="flex size-11 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-muted">
      <UserRound className="size-5" aria-hidden />
    </div>
  );

  const identity = (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] font-semibold text-ink">
        {author?.displayName ?? t('community.unknownCreator')}
      </p>
      <div className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-muted">
        {author?.username ? <span className="font-medium">@{author.username}</span> : null}
        {publishedLabel ? (
          <>
            {author?.username ? <span aria-hidden>·</span> : null}
            <time dateTime={publishedAt ?? undefined}>{publishedLabel}</time>
          </>
        ) : null}
      </div>
    </div>
  );

  if (!profilePath) {
    return (
      <div className="flex items-center gap-2.5">
        {avatarNode}
        {identity}
      </div>
    );
  }

  return (
    <Link
      to={profilePath}
      className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-control)] pr-2 -ml-1 pl-1 hover:bg-surface-2/80"
    >
      {avatarNode}
      {identity}
    </Link>
  );
}
