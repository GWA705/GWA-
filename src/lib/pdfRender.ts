import 'server-only';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * PDF → PNG page rasterizer built on pdfjs-dist + @napi-rs/canvas.
 *
 * Why not pdf-to-img? That package pulls in **node-canvas** (`canvas`), a native
 * addon that dlopen()s a stack of system libraries (cairo, pango, pixman, …). In
 * a slim container those libs (or the right versions) can be missing, the addon
 * fails to load, and EVERY PDF render throws — the "Couldn't render a preview"
 * bug. @napi-rs/canvas is a prebuilt, self-contained binding (it bundles its own
 * graphics) that needs no system libs, so it works the same in dev and in the
 * production image. pdfjs-dist + @napi-rs/canvas are both declared as Next
 * server-external packages, so they load from node_modules at runtime and their
 * shipped standard_fonts/ + cmaps/ folders (needed to draw text and encoded
 * glyphs) are resolvable on disk.
 */

// Resolve pdfjs-dist's on-disk directory without relying on import.meta.url
// (which webpack can rewrite). cwd is the app root in the container (/app).
function pdfjsDir(): string {
  try {
    const req = createRequire(path.join(process.cwd(), 'package.json'));
    return path.dirname(req.resolve('pdfjs-dist/package.json'));
  } catch {
    return path.join(process.cwd(), 'node_modules', 'pdfjs-dist');
  }
}

// Canvas factory backed by @napi-rs/canvas, matching the shape pdfjs expects.
function makeCanvasFactory(createCanvas: (w: number, h: number) => any) {
  const dim = (n: number) => Math.max(1, Math.ceil(n));
  return class NapiCanvasFactory {
    create(width: number, height: number, transparent?: boolean) {
      const canvas = createCanvas(dim(width), dim(height));
      const context = canvas.getContext('2d');
      if (transparent) context.clearRect(0, 0, width, height);
      return { canvas, context };
    }
    reset(cc: { canvas: any }, width: number, height: number) {
      cc.canvas.width = dim(width);
      cc.canvas.height = dim(height);
    }
    destroy(cc: { canvas: any; context: any }) {
      if (cc.canvas) {
        cc.canvas.width = 0;
        cc.canvas.height = 0;
      }
      cc.canvas = null;
      cc.context = null;
    }
  };
}

/**
 * Render up to `maxPages` of a PDF to PNG page buffers. Async generator so the
 * caller can stop early (thumbnail = first page) or stack pages as they arrive.
 * Throws on a genuinely unreadable PDF; callers wrap in try/catch and fall back.
 */
export async function* renderPdfPngs(
  pdfBytes: Buffer,
  opts: { scale?: number; maxPages?: number } = {},
): AsyncGenerator<Buffer> {
  const scale = opts.scale ?? 2;
  const maxPages = opts.maxPages ?? 40;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [napi, pdfjs] = (await Promise.all([
    import('@napi-rs/canvas'),
    import('pdfjs-dist/legacy/build/pdf.mjs' as string),
  ])) as [typeof import('@napi-rs/canvas'), any];

  const CanvasFactory = makeCanvasFactory(napi.createCanvas as unknown as (w: number, h: number) => any);
  const canvasFactory = new CanvasFactory();
  const dir = pdfjsDir();

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    standardFontDataUrl: path.join(dir, `standard_fonts${path.sep}`),
    cMapUrl: path.join(dir, `cmaps${path.sep}`),
    cMapPacked: true,
    isEvalSupported: false,
    canvasFactory,
  }).promise;

  try {
    const n = Math.min(doc.numPages, maxPages);
    for (let i = 1; i <= n; i += 1) {
      const page = await doc.getPage(i);
      try {
        const viewport = page.getViewport({ scale });
        const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);
        await page.render({ canvasContext: context, viewport }).promise;
        yield canvas.toBuffer('image/png');
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy().catch(() => {});
  }
}
