/**
 * StorageProvider — an interface so a real S3-compatible implementation can be swapped in
 * later without touching call sites. `local.ts` is the dev implementation used in P0.
 */
export interface StorageProvider {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
