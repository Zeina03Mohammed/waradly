import fs from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider } from '@/lib/storage/provider';

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? './storage');

/** Local-filesystem StorageProvider for dev. Files live under ./storage (gitignored) and are
 * never served directly by a static route — every read goes through the signed-URL flow. */
export class LocalStorageProvider implements StorageProvider {
  private resolvePath(key: string): string {
    const resolved = path.resolve(ROOT, key);
    if (!resolved.startsWith(ROOT)) {
      throw new Error('Invalid storage key.');
    }
    return resolved;
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolvePath(key), { force: true });
  }
}

export const storageProvider: StorageProvider = new LocalStorageProvider();
