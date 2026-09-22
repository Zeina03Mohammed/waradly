import type { StorageProvider } from '@/lib/storage/provider';
import { LocalStorageProvider } from '@/lib/storage/local';
import { R2StorageProvider } from '@/lib/storage/r2';

/**
 * Picks the storage backend at startup: Cloudflare R2 when its credentials are configured
 * (production), otherwise the local-filesystem provider (dev). Every call site imports
 * `storageProvider` from here — never from `./local` or `./r2` directly — so this is the only
 * place that decides.
 */
function createStorageProvider(): StorageProvider {
  const hasR2Config =
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME;

  if (hasR2Config) return new R2StorageProvider();
  return new LocalStorageProvider();
}

export const storageProvider: StorageProvider = createStorageProvider();
