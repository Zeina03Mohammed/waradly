'use client';

import { useRef, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Avatar } from '@/components/Avatar';
import { useRequireRole } from '@/lib/client/useRequireRole';
import { api, ApiError } from '@/lib/client/apiClient';
import { useAuth } from '@/lib/client/AuthProvider';

export default function AdminProfilePage() {
  const { user, loading } = useRequireRole('admin');
  const { refreshUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading || !user) return null;

  async function handleSaveUsername(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api('/api/users/me', { method: 'PATCH', body: { username } });
      await refreshUser();
      setMessage('Username updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save, try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api('/api/users/me/avatar', { method: 'POST', body: formData, isFormData: true });
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload image.');
    } finally {
      setUploading(false);
      setEditingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemovePhoto() {
    setRemoving(true);
    setError(null);
    try {
      await api('/api/users/me/avatar', { method: 'DELETE' });
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove photo.');
    } finally {
      setRemoving(false);
      setEditingPhoto(false);
    }
  }

  return (
    <Shell>
      <h1 className="mb-6 text-xl font-semibold">Profile</h1>

      <div className="mb-6 flex items-center gap-4">
        <Avatar userId={user.id} hasAvatar={user.has_avatar} label={user.username ?? user.email} size={64} />
        <div>
          {!editingPhoto ? (
            <button
              type="button"
              onClick={() => setEditingPhoto(true)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-500"
            >
              Edit photo
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || removing}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-500"
              >
                {uploading ? 'Uploading…' : 'Upload new'}
              </button>
              {user.has_avatar && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploading || removing}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-red-600 hover:border-red-400"
                >
                  {removing ? 'Removing…' : 'Remove photo'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingPhoto(false)}
                disabled={uploading || removing}
                className="rounded px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarChange} />
        </div>
      </div>

      {message && <p className="mb-4 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSaveUsername} className="mb-8 max-w-md space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Username</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save username'}
        </button>
      </form>

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
