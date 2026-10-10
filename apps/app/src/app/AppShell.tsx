import { NavLink, Outlet } from 'react-router-dom';
import { House, Package, UserRound, Wrench, UsersRound } from 'lucide-react';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';

const MAIN_NAV = [
  { to: '/', labelKey: 'nav.home' as const, icon: House, end: true },
  { to: '/pacotes', labelKey: 'nav.packs' as const, icon: Package, end: false },
  { to: '/comunidade', labelKey: 'nav.community' as const, icon: UsersRound, end: false },
  { to: '/tools', labelKey: 'nav.tools' as const, icon: Wrench, end: false },
  { to: '/perfil', labelKey: 'nav.profile' as const, icon: UserRound, end: false },
] as const;

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-app">
      <main
        className="flex min-h-0 flex-1 w-full pb-[calc(var(--shell-nav-height)+env(safe-area-inset-bottom,0px))]"
      >
        <div className="mx-auto w-full max-w-[768px] lg:max-w-[840px] px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)] sm:px-6">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label={t('common.mainNavigation')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md safe-bottom"
        style={{ height: 'calc(var(--shell-nav-height) + env(safe-area-inset-bottom, 0px))' }}
      >
        <ul
          className="mx-auto flex h-[var(--shell-nav-height)] w-full max-w-[768px] lg:max-w-[840px] items-stretch justify-between gap-0 px-1"
        >
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to} className="min-w-0 flex-1">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 py-1 transition-colors duration-150 active:scale-[0.98] select-none touch-manipulation',
                      isActive ? 'text-accent' : 'text-ink-muted hover:text-ink-soft',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cx(
                          'flex h-8 w-14 max-w-full items-center justify-center rounded-full transition-colors duration-150',
                          isActive ? 'bg-accent/15 text-accent' : 'bg-transparent',
                        )}
                      >
                        <Icon className="size-5" aria-hidden strokeWidth={isActive ? 2.25 : 1.85} />
                      </span>
                      <span
                        className={cx(
                          'max-w-full truncate text-center text-[11px] font-medium leading-none',
                          isActive ? 'text-ink' : '',
                        )}
                      >
                        {t(item.labelKey)}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
