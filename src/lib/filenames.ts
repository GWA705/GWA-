// A human-friendly label for an uploaded file whose name may be an opaque,
// device-generated string. iOS in particular names photos and shared PDFs with
// a bare UUID (e.g. "632D9D1F-C6D6-4C96-87AE-…D5C.pdf"), which looks broken to
// recipients. When the base name is clearly opaque we substitute a clean label
// but keep the real extension; descriptive names (e.g. "Promo_Sheet.pdf") are
// left untouched.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX_RE = /^[0-9a-f]{16,}$/i;

export function friendlyFileName(name: string, index = 0): string {
  const trimmed = (name || '').trim();
  const dot = trimmed.lastIndexOf('.');
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const ext = dot > 0 ? trimmed.slice(dot + 1).toLowerCase() : '';

  const opaque = UUID_RE.test(base) || LONG_HEX_RE.test(base.replace(/[-_]/g, ''));
  if (!opaque) return trimmed;

  const label = index > 0 ? `Attachment ${index + 1}` : 'Attachment';
  return ext ? `${label}.${ext}` : label;
}
