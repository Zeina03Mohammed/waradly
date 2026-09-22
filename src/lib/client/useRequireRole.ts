'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/client/AuthProvider';

/** Client-side route guard. The API layer is the real enforcement boundary (every route
 * checks role/ownership server-side); this just avoids flashing a page the user can't use. */
export function useRequireRole(...roles: Array<'buyer' | 'supplier' | 'admin'>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      router.replace('/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  return { user, loading };
}
