import { cookies } from 'next/headers';

export const AUTH_COOKIE = 'stockkeep_auth';
export const ADMIN_COOKIE = 'stockkeep_admin';
export const DEFAULT_PASSCODE = process.env.APP_PASSCODE || '557575';
export const DEFAULT_ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '774819';

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const auth = cookieStore.get(AUTH_COOKIE);
  return auth?.value === 'authenticated';
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const admin = cookieStore.get(ADMIN_COOKIE);
  return admin?.value === 'admin';
}

export async function setAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });
}

export async function setAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, 'admin', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
