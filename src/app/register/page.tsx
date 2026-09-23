'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/client/apiClient';
import { useAuth } from '@/lib/client/AuthProvider';
import { CountrySelect, RegionSelect } from '@/components/CountryRegionSelect';

interface Category {
  id: string;
  name: string;
  status: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [role, setRole] = useState<'buyer' | 'supplier'>('buyer');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('');
  const [generalRegion, setGeneralRegion] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) router.replace(`/${user.role}/dashboard`.replace('/admin/dashboard', '/admin'));
  }, [user, router]);

  useEffect(() => {
    if (role === 'supplier') {
      api<{ categories: Category[] }>('/api/categories').then((d) => setCategories(d.categories));
    }
  }, [role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (password !== confirmPassword) {
      setErrors({ confirm_password: 'Passwords do not match.' });
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: {
          email,
          username,
          phone,
          password,
          role,
          legal_name: legalName,
          country,
          general_region: generalRegion,
          terms_accepted: termsAccepted,
          ...(role === 'supplier' ? { category_ids: categoryIds } : {}),
        },
      });
      setSuccess(true);
      await refreshUser();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? { _: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="mb-4 text-xl font-semibold">Check your email</h1>
        <p className="text-gray-600">
          Your account was created. We sent a verification link to <strong>{email}</strong> (check the server console
          in dev). Once verified you can log in.
        </p>
        <a href="/login" className="mt-4 inline-block text-blue-600 underline">
          Go to login
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-xl font-semibold">Create an account</h1>

      <div className="mb-6 flex rounded border border-gray-300">
        {(['buyer', 'supplier'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex-1 py-2 text-sm capitalize ${role === r ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
          >
            {r}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errors._ && <p className="text-sm text-red-600">{errors._}</p>}

        <Field label="Email" error={errors.email}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
        <Field label="Username" error={errors.username}>
          <input required value={username} onChange={(e) => setUsername(e.target.value)} className="input" />
        </Field>
        <Field label="Phone number" error={errors.phone}>
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </Field>
        <Field label="Password" error={errors.password}>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </Field>
        <Field label="Confirm password" error={errors.confirm_password}>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Company legal name" error={errors.legal_name}>
          <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} className="input" />
        </Field>
        <Field label="Country" error={errors.country}>
          <CountrySelect
            value={country}
            onChange={(v) => {
              setCountry(v);
              setGeneralRegion('');
            }}
            required
          />
        </Field>
        <Field label="General region" error={errors.general_region}>
          <RegionSelect country={country} value={generalRegion} onChange={setGeneralRegion} required />
        </Field>

        {role === 'supplier' && (
          <Field label="Categories" error={errors.category_ids}>
            <div className="space-y-1">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(c.id)}
                    onChange={(e) =>
                      setCategoryIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                    }
                  />
                  {c.name}
                </label>
              ))}
              {categories.length === 0 && <p className="text-sm text-gray-500">No categories yet.</p>}
            </div>
          </Field>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1" />
          <span>
            I agree to the Terms, Anti-Circumvention Policy, and Privacy Policy. (Placeholder text — final legal
            copy pending, per OD-P-02.)
          </span>
        </label>
        {errors.terms_accepted && <p className="text-sm text-red-600">{errors.terms_accepted}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        Already have an account?{' '}
        <a href="/login" className="text-blue-600 underline">
          Log in
        </a>
      </p>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-red-600">{error}</span>}
    </label>
  );
}
