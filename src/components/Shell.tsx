'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/client/AuthProvider';

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
  const { user, logout } = useAuth();
  const links = user ? NAV[user.role] : [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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
          {user && (
            <button onClick={() => logout()} className="text-sm text-gray-500 hover:text-gray-900">
              Log out ({user.email})
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
