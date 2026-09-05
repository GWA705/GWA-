'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, isLocale } from './config';

/**
 * Persist the viewer's chosen language in a cookie and refresh the page so
 * server-rendered copy re-renders in the new locale. Called by LanguageToggle.
 */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  cookies().set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // one year
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}
