import { NavLink, Outlet } from 'react-router-dom';
import { House, Package, Settings } from 'lucide-react';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';

export function AppShell() {
  const { t } = useTranslation();

  const navItems = [
    { to: '/', label: t('nav.home'), icon: House, end: true },
    { to: '/pacotes', label: t('nav.packs'), icon: Package, end: false },
    { to: '/configuracoes', label: t('nav.settings'), icon: Settings, end: false },
  ] as const;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-app">
      <main className="flex-1 w-full pb-[calc(env(safe-area-inset-bottom,0px)+92px)]">
        <div className="mx-auto w-full max-w-[640px] px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)] sm:px-6">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md safe-bottom"
      >
        <ul className="mx-auto flex w-full max-w-[640px] items-stretch justify-around px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex-1">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'flex flex-col items-center gap-1 py-2 transition-[color,transform] duration-150 active:scale-95 select-none',
                      isActive ? 'text-ink' : 'text-ink-muted hover:text-ink-soft',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cx(
                          'flex h-7 w-13 items-center justify-center rounded-full transition-colors duration-150',
                          isActive ? 'bg-surface-3 text-ink' : 'bg-transparent text-ink-muted',
                        )}
                      >
                        <Icon
                          className="size-[19px]"
                          aria-hidden
                          strokeWidth={isActive ? 2.2 : 1.8}
                        />
                      </span>
                      <span className="text-[11px] font-medium leading-none">{item.label}</span>
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
