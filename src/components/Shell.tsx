'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SKIP_AUTH, useAuth } from '@/lib/client/AuthProvider';

const DASHBOARD_BY_ROLE: Record<'buyer' | 'supplier' | 'admin', string> = {
  buyer: '/buyer/dashboard',
  supplier: '/supplier/rfqs',
  admin: '/admin',
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
    { href: '/admin/categories', label: 'Categories' },
    { href: '/admin/rfqs/review', label: 'RFQ Review' },
    { href: '/admin/offers', label: 'Offers' },
    { href: '/admin/orders', label: 'Orders' },
    { href: '/admin/messages/flags', label: 'Message Flags' },
    { href: '/admin/disputes', label: 'Disputes' },
    { href: '/admin/audit-logs', label: 'Audit Log' },
  ],
};

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout, switchDevRole } = useAuth();
  const links = user ? NAV[user.role] : [];

  async function handleDevRole(role: 'buyer' | 'supplier' | 'admin') {
    if (user?.role === role) {
      router.push(DASHBOARD_BY_ROLE[role]);
      return;
    }
    await switchDevRole(role);
    router.push(DASHBOARD_BY_ROLE[role]);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-lg font-semibold">
            Wardly
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-gray-600 hover:text-gray-900">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {SKIP_AUTH && (
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
            )}
            {user && (
              <button onClick={() => logout()} className="text-sm text-gray-500 hover:text-gray-900">
                Log out ({user.email})
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
