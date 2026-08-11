import { toTitleCase } from '@/lib/textcase';

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
  officeHours: string | null;
  website: string | null;
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
    officeHours: s(fd.get('officeHours'), 300),
    website: s(fd.get('website'), 200),
  };
}
