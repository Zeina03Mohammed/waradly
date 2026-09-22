'use client';

import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api } from '@/lib/client/apiClient';
import { RfqForm, useRfqFormState } from '@/components/RfqForm';

interface Category {
  id: string;
  name: string;
  status: string;
}

export default function NewRfqPage() {
  const { user, loading } = useRequireRole('buyer');
  const [categories, setCategories] = useState<Category[]>([]);
  const form = useRfqFormState();

  useEffect(() => {
    api<{ categories: Category[] }>('/api/categories').then((d) => setCategories(d.categories.filter((c) => c.status === 'active')));
  }, []);

  if (loading || !user) return null;

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Create RFQ</h1>
      <RfqForm
        categories={categories}
        values={form.values}
        setValues={form.setValues}
        attachments={form.attachments}
        setAttachments={form.setAttachments}
      />
    </Shell>
  );
}
