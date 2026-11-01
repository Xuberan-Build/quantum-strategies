/** Phone number as typed (free text, no formatting rules). Shared by the user and admin settings routes. */
export const PHONE_MAX_LENGTH = 32;

export type PhoneInput = { ok: true; value: string | null } | { ok: false; error: string };

export function parsePhoneInput(raw: unknown): PhoneInput {
  if (raw === null || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: 'Phone must be text' };
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (value.length > PHONE_MAX_LENGTH) return { ok: false, error: 'Phone number is too long' };
  if (!/^[0-9+().\-\s]+$/.test(value) || !/\d/.test(value)) return { ok: false, error: 'Phone can only contain digits, spaces and + ( ) - .' };
  return { ok: true, value };
}
