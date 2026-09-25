import 'server-only';
import { Errors } from '../errors';
import type { User } from '@/types';
import { isPhoneTaken, updatePhone } from './services/userService';

/** Phone is the only student-editable field. Name/email come from Google and role is never writable. */
export async function updateProfile(user: User, input: { phone: string }) {
  if (await isPhoneTaken(input.phone, user.id)) {
    throw Errors.conflict('This phone number is already linked to another account');
  }
  const updated = await updatePhone(user.id, input.phone);
  return { id: updated!.id, name: updated!.name, email: updated!.email, phone: updated!.phone, role: updated!.role };
}
