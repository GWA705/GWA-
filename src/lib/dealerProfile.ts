import { toTitleCase } from '@/lib/textcase';

/** One additional office contact beyond billing/support. */
export interface OfficeContact {
  name: string;
  role: string;
  phone: string;
  email: string;
}

/** The editable office-profile fields, parsed from a submitted form. */
export interface DealerProfileData {
  businessName: string | null;
  address: string | null;
  shippingAddress: string | null;
  phone: string | null;
  altPhone: string | null;
  billingContactName: string | null;
  billingPhone: string | null;
  billingEmail: string | null;
  supportContactName: string | null;
  supportPhone: string | null;
  supportEmail: string | null;
  extraContacts: OfficeContact[];
  officeHours: string | null;
  website: string | null;
}

const MAX_EXTRA_CONTACTS = 12;

/** Parse + sanitize the "additional contacts" JSON blob from the form. */
export function parseExtraContacts(raw: FormDataEntryValue | null): OfficeContact[] {
  if (!raw) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(String(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  return arr
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        name: toTitleCase(clean(o.name, 120)),
        role: clean(o.role, 60),
        phone: clean(o.phone, 40),
        email: clean(o.email, 160).toLowerCase(),
      };
    })
    // Keep any row that has at least a name or a contact method.
    .filter((c) => c.name || c.phone || c.email)
    .slice(0, MAX_EXTRA_CONTACTS);
}

/** Read stored extraContacts JSON back into a typed array (for display/forms). */
export function readExtraContacts(value: unknown): OfficeContact[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        name: String(o.name ?? ''),
        role: String(o.role ?? ''),
        phone: String(o.phone ?? ''),
        email: String(o.email ?? ''),
      };
    })
    .filter((c) => c.name || c.phone || c.email);
}

const s = (v: FormDataEntryValue | null, max = 200): string | null => {
  const t = String(v ?? '').trim().slice(0, max);
  return t.length ? t : null;
};

/** Build the profile data object from a submitted form (light normalisation). */
export function parseDealerProfileForm(fd: FormData): DealerProfileData {
  const name = (v: FormDataEntryValue | null) => {
    const t = s(v, 120);
    return t ? toTitleCase(t) : null;
  };
  const email = (v: FormDataEntryValue | null) => s(v, 160)?.toLowerCase() ?? null;
  return {
    businessName: s(fd.get('businessName'), 160),
    address: s(fd.get('address'), 400),
    shippingAddress: s(fd.get('shippingAddress'), 400),
    phone: s(fd.get('phone'), 40),
    altPhone: s(fd.get('altPhone'), 40),
    billingContactName: name(fd.get('billingContactName')),
    billingPhone: s(fd.get('billingPhone'), 40),
    billingEmail: email(fd.get('billingEmail')),
    supportContactName: name(fd.get('supportContactName')),
    supportPhone: s(fd.get('supportPhone'), 40),
    supportEmail: email(fd.get('supportEmail')),
    extraContacts: parseExtraContacts(fd.get('extraContacts')),
    officeHours: s(fd.get('officeHours'), 300),
    website: s(fd.get('website'), 200),
  };
}
