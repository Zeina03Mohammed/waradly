'use client';

import { Shell } from '@/components/Shell';
import { AccountPhotoUsername } from '@/components/AccountPhotoUsername';
import { useRequireRole } from '@/lib/client/useRequireRole';

export default function AdminProfilePage() {
  const { user, loading } = useRequireRole('admin');

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="page-title mb-8">Profile</h1>

      <AccountPhotoUsername />

      <dl className="max-w-md space-y-4 text-sm">
        <div>
          <dt className="font-medium text-navy-400">Email</dt>
          <dd className="text-navy-950">{user.email}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy-400">Phone</dt>
          <dd className="text-navy-950">{user.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-navy-400">Role</dt>
          <dd className="capitalize text-navy-950">{user.role}</dd>
        </div>
      </dl>
    </Shell>
  );
}
