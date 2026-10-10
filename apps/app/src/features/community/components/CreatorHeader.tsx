import { Link } from 'react-router-dom';
import type { PublicAuthor } from '@shappire/contracts';
import { DecoratedAvatar } from '@/shared/components/DecoratedAvatar';
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
  const profilePath = author?.username ? `/comunidade/criador/${author.username}` : null;
  const avatarUrl = author?.avatar?.url ?? null;
  const publishedLabel = publishedAt ? formatRelative(publishedAt) : null;

  const avatarNode = (
    <DecoratedAvatar
      src={avatarUrl}
      size="md"
      decoration={author?.avatarDecoration}
      borderClassName="border-line"
    />
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
