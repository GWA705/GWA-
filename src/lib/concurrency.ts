import 'server-only';

/**
 * Tiny in-process concurrency limiter (semaphore). Heavy jobs — OCR (tesseract),
 * PDF page rasterization, big image composites — are CPU- and memory-hungry, and
 * the app runs on a small single instance (t3.small, 2 GB). A burst of these run
 * at once can exhaust memory and take the box down. Wrapping each such job in a
 * named pool caps how many run concurrently; the rest queue (they wait, they are
 * never dropped), so a spike degrades to "a little slower" instead of an outage.
 *
 * Per-instance only (in memory). That's the right scope here: the limit protects
 * one instance's RAM/CPU, and the deploy is single-instance; if it ever scales
 * out, each instance simply enforces its own cap.
 */
class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    this.active += 1;
    try {
      return await fn();
    } finally {
      this.active -= 1;
      const next = this.waiters.shift();
      if (next) next();
    }
  }
}

const pools = new Map<string, Semaphore>();

/**
 * Run `fn` in the named pool, allowing at most `max` concurrent runs of that pool
 * across the instance. Extra calls queue until a slot frees. The first call for a
 * key fixes its limit.
 */
export function withConcurrencyLimit<T>(key: string, max: number, fn: () => Promise<T>): Promise<T> {
  let pool = pools.get(key);
  if (!pool) {
    pool = new Semaphore(Math.max(1, max));
    pools.set(key, pool);
  }
  return pool.run(fn);
}
