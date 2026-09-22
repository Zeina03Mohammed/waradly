import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/client/AuthProvider';

export const metadata: Metadata = {
  title: 'Wardly',
  description: 'B2B procurement marketplace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
