
import { randomInt } from 'crypto';

export function generateSecureOtp(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return randomInt(min, max).toString();
}
