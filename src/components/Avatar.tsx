'use client';

function initials(label: string): string {
  return label.trim().slice(0, 2).toUpperCase();
}

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
  if (hasAvatar) {
    // eslint-disable-next-line @next/next/no-img-element -- served from our own dynamic route, not optimizable by next/image
    return (
      <img
        src={`/api/users/${userId}/avatar`}
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
