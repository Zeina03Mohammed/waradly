'use client';

import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/client/apiClient';

function initials(label: string): string {
  return label.trim().slice(0, 2).toUpperCase();
}

/** The avatar endpoint requires auth (see api/users/[id]/avatar) — a plain <img src> can't
 * carry an Authorization header, so this fetches the bytes itself and renders them as a blob
 * URL instead. */
export function Avatar({
  userId,
  hasAvatar,
  label,
  size = 32,
}: {
  userId: string;
  hasAvatar: boolean;
  label: string;
  size?: number;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAvatar) {
      setBlobUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      const token = getAccessToken();
      const res = await fetch(`/api/users/${userId}/avatar`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => null);
      if (!res || !res.ok || cancelled) return;
      const blob = await res.blob();
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setBlobUrl(objectUrl);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [userId, hasAvatar]);

  if (blobUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob: URL, not optimizable by next/image
      <img
        src={blobUrl}
        alt={label}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="flex items-center justify-center rounded-full bg-gray-300 font-medium text-gray-700"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(label)}
    </span>
  );
}
