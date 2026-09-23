'use client';

import { Shell } from '@/components/Shell';
import { AccountPhotoUsername } from '@/components/AccountPhotoUsername';
import { useRequireRole } from '@/lib/client/useRequireRole';

export default function AdminProfilePage() {
  const { user, loading } = useRequireRole('admin');

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Profile</h1>

      <AccountPhotoUsername />

      <dl className="max-w-md space-y-4 text-sm">
        <div>
          <dt className="font-medium text-gray-700">Email</dt>
          <dd className="text-gray-900">{user.email}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-700">Phone</dt>
          <dd className="text-gray-900">{user.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-700">Role</dt>
          <dd className="capitalize text-gray-900">{user.role}</dd>
        </div>
      </dl>
    </Shell>
  );
}
