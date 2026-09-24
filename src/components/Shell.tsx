'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { SKIP_AUTH, useAuth } from '@/lib/client/AuthProvider';
import { Avatar } from '@/components/Avatar';

function Logo() {
  return <Image src="/logo-icon.png" alt="Waradly" width={72} height={72} className="rounded-lg" />;
}

function displayName(user: { username: string | null; email: string }): string {
  return user.username ?? user.email;
}

const DASHBOARD_BY_ROLE: Record<'buyer' | 'supplier' | 'admin', string> = {
  buyer: '/buyer/dashboard',
  supplier: '/supplier/rfqs',
  admin: '/admin',
};

const PROFILE_BY_ROLE: Record<'buyer' | 'supplier' | 'admin', string> = {
  buyer: '/buyer/profile',
  supplier: '/supplier/profile',
  admin: '/admin/profile',
};

type NavIcon = 'dashboard' | 'rfq' | 'offer' | 'order' | 'shield' | 'grid' | 'chart' | 'log' | 'user';

const NAV: Record<'buyer' | 'supplier' | 'admin', { href: string; label: string; icon: NavIcon }[]> = {
  buyer: [
    { href: '/buyer/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { href: '/buyer/rfqs', label: 'My RFQs', icon: 'rfq' },
    { href: '/buyer/profile', label: 'Profile', icon: 'user' },
  ],
  supplier: [
    { href: '/supplier/rfqs', label: 'Available RFQs', icon: 'rfq' },
    { href: '/supplier/offers', label: 'My Offers', icon: 'offer' },
    { href: '/supplier/orders', label: 'Won Orders', icon: 'order' },
    { href: '/supplier/verification', label: 'Verification', icon: 'shield' },
    { href: '/supplier/categories', label: 'Capabilities', icon: 'grid' },
    { href: '/supplier/performance', label: 'Performance', icon: 'chart' },
    { href: '/supplier/profile', label: 'Profile', icon: 'user' },
  ],
  admin: [
    { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
    { href: '/admin/users', label: 'Users', icon: 'user' },
    { href: '/admin/suppliers/verification', label: 'Supplier Verification', icon: 'shield' },
    { href: '/admin/audit-logs', label: 'Audit Log', icon: 'log' },
    { href: '/admin/profile', label: 'Profile', icon: 'user' },
  ],
};

function NavIconGlyph({ icon, active }: { icon: NavIcon; active: boolean }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: active ? '#d9ab5f' : 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (icon) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
          <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
          <rect x="3.5" y="13" width="7" height="7.5" rx="1.5" />
        </svg>
      );
    case 'rfq':
      return (
        <svg {...common}>
          <path d="M6 3.5h9L19 7.5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
          <path d="M14.5 3.5V8h4.5" />
          <path d="M8 12.5h8M8 16h5" />
        </svg>
      );
    case 'offer':
      return (
        <svg {...common}>
          <path d="M3.5 12 12 3.5l8.5 8.5-8.5 8.5-8.5-8.5Z" />
          <circle cx="12" cy="12" r="2.25" />
        </svg>
      );
    case 'order':
      return (
        <svg {...common}>
          <path d="M4 7.5 12 3.5l8 4v9l-8 4-8-4v-9Z" />
          <path d="M4 7.5 12 11.5l8-4M12 11.5V20.5" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3.5 19 6.5v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6.5L12 3.5Z" />
          <path d="M9 12l2 2 4-4.5" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
          <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 20V4M4 20h16" />
          <path d="M8 16v-4M12.5 16V8M17 16v-7" />
        </svg>
      );
    case 'log':
      return (
        <svg {...common}>
          <path d="M5 4.5h11l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" />
          <path d="M8 10.5h8M8 14h8M8 17h5" />
        </svg>
      );
    case 'user':
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" />
        </svg>
      );
  }
}

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, switchDevRole } = useAuth();

  async function handleDevRole(role: 'buyer' | 'supplier' | 'admin') {
    if (user?.role === role) {
      router.push(DASHBOARD_BY_ROLE[role]);
      return;
    }
    await switchDevRole(role);
    router.push(DASHBOARD_BY_ROLE[role]);
  }

  const devRoleSwitcher = SKIP_AUTH && (
    <div className="flex gap-1 text-xs">
      {(['buyer', 'supplier', 'admin'] as const).map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => handleDevRole(role)}
          className={
            user?.role === role
              ? 'rounded bg-navy-900 px-2 py-1 text-white'
              : 'rounded border border-navy-100 px-2 py-1 text-navy-400 hover:border-navy-400'
          }
        >
          {role}
        </button>
      ))}
    </div>
  );

  if (!user) {
    return <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>;
  }

  const links = NAV[user.role];

  return (
    <div className="flex min-h-screen bg-[#f6f5f2]">
      <aside className="flex w-60 shrink-0 flex-col bg-navy-950">
        <Link href={DASHBOARD_BY_ROLE[user.role]} className="flex items-center gap-2 px-5 py-6">
          <Logo />
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 text-sm">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? 'flex items-center gap-3 rounded-md bg-white/[0.06] px-3 py-2.5 font-medium text-white ring-1 ring-inset ring-white/[0.06]'
                    : 'flex items-center gap-3 rounded-md px-3 py-2.5 text-navy-100/70 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white'
                }
              >
                <NavIconGlyph icon={link.icon} active={active} />
                <span className={active ? 'border-l-2 border-gold-500 pl-3 -ml-3' : 'pl-3 -ml-3'}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-white/[0.06] px-3 py-4">
          {devRoleSwitcher}
          <button
            onClick={() => logout()}
            className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-navy-100/60 transition-colors duration-150 hover:bg-white/[0.04] hover:text-red-300"
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-end gap-3 border-b border-navy-100 bg-white/70 px-8 py-3 backdrop-blur-sm">
          <Link
            href={PROFILE_BY_ROLE[user.role]}
            className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors duration-150 hover:bg-navy-50"
          >
            <Avatar userId={user.id} hasAvatar={user.has_avatar} label={displayName(user)} size={32} />
            <span className="text-sm font-medium text-navy-900">{displayName(user)}</span>
          </Link>
        </div>
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
