'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { SKIP_AUTH, useAuth } from '@/lib/client/AuthProvider';
import { Avatar } from '@/components/Avatar';

function Logo() {
  return <Image src="/logo-icon.png" alt="Waradly" width={80} height={80} className="rounded" />;
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

const NAV: Record<'buyer' | 'supplier' | 'admin', { href: string; label: string }[]> = {
  buyer: [
    { href: '/buyer/dashboard', label: 'Dashboard' },
    { href: '/buyer/rfqs', label: 'My RFQs' },
    { href: '/buyer/profile', label: 'Profile' },
  ],
  supplier: [
    { href: '/supplier/rfqs', label: 'Available RFQs' },
    { href: '/supplier/offers', label: 'My Offers' },
    { href: '/supplier/orders', label: 'Won Orders' },
    { href: '/supplier/verification', label: 'Verification' },
    { href: '/supplier/categories', label: 'Capabilities' },
    { href: '/supplier/performance', label: 'Performance' },
    { href: '/supplier/profile', label: 'Profile' },
  ],
  admin: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/suppliers/verification', label: 'Supplier Verification' },
    { href: '/admin/audit-logs', label: 'Audit Log' },
    { href: '/admin/profile', label: 'Profile' },
  ],
};

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
              ? 'rounded bg-gray-900 px-2 py-1 text-white'
              : 'rounded border border-gray-300 px-2 py-1 text-gray-600 hover:border-gray-500'
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
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        <Link href={DASHBOARD_BY_ROLE[user.role]} className="flex justify-center border-b border-gray-200 px-4 py-4">
          <Logo />
        </Link>
        <nav className="flex flex-1 flex-col gap-1 p-3 text-sm">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? 'rounded bg-gray-900 px-3 py-2 text-white'
                    : 'rounded px-3 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-gray-200 p-3">
          {devRoleSwitcher}
          <button
            onClick={() => logout()}
            className="block w-full text-center text-base font-medium text-gray-500 transition-colors hover:text-red-600"
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex justify-end border-b border-gray-200 bg-white px-6 py-3">
          <Link href={PROFILE_BY_ROLE[user.role]} className="flex items-center gap-2">
            <Avatar userId={user.id} hasAvatar={user.has_avatar} label={displayName(user)} size={32} />
            <span className="text-sm font-medium text-gray-700">{displayName(user)}</span>
          </Link>
        </div>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
