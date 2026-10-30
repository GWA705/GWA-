import archiver from 'archiver';
import { Readable } from 'node:stream';
import { getDocument } from './storage';

/**
 * Memory-bounded, streaming ZIP of stored (encrypted) documents.
 *
 * The old approach loaded EVERY document into memory, decrypted each, and built
 * the whole archive as one in-memory buffer before sending. On a deal with many
 * large files that doubled memory (all source bytes + the whole generated ZIP)
 * and blew past the single instance's RAM — OOM, instance restart, 504s on the
 * download AND on the rest of the app (and the crons that call it).
 *
 * This streams instead: files are fetched + decrypted ONE AT A TIME and appended
 * as the archive drains to the client, so peak memory is roughly a single file
 * regardless of how many (or how big) the documents are. Content is already
 * compressed (JPEG/PDF), so we STORE (no deflate) — fast, low-CPU, and the ZIP
 * is just a container. Bytes start flowing immediately, so the gateway never
 * times the request out waiting for a giant buffer to be built.
 */

export interface ZipEntry {
  storageKey: string;
  /** Path (incl. any folder) for this file inside the archive. */
  name: string;
}

export interface ZipStreamResult {
  stream: ReadableStream<Uint8Array>;
  /** Resolves (after the stream is consumed) with how many files were written. */
  done: Promise<{ added: number; skipped: number }>;
}

export function streamDocumentsZip(entries: ZipEntry[]): ZipStreamResult {
  // store:true → no compression (already-compressed content), minimal CPU/memory.
  const archive = archiver('zip', { store: true });
  archive.on('warning', (err) => console.error('[zip] warning', err));
  archive.on('error', (err) => console.error('[zip] archive error', err));

  let added = 0;
  let skipped = 0;

  const done = (async () => {
    for (const entry of entries) {
      let bytes: Buffer;
      try {
        bytes = await getDocument(entry.storageKey); // one file in memory
      } catch (err) {
        // An orphaned / missing file must never fail the whole archive.
        console.error('[zip] skipping unreadable document', entry.storageKey, err);
        skipped += 1;
        continue;
      }
      archive.append(bytes, { name: entry.name });
      added += 1;
      // Backpressure: wait until this entry has been written out before fetching
      // the next, so we never hold more than ~one decrypted file at a time.
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => archive.once('entry', () => resolve()));
    }
    await archive.finalize();
    return { added, skipped };
  })().catch((err) => {
    console.error('[zip] feeder failed', err);
    archive.destroy(err as Error);
    return { added, skipped };
  });

  const stream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;
  return { stream, done };
}
