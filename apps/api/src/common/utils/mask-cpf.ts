/**
 * Masks a CPF for safe display in API responses.
 * Input:  "184.299.888-90" or "18429988890"
 * Output: "***.***.888-90"  (shows only last 6 chars)
 *
 * VULN-011 fix: CPFs must NEVER be returned unmasked in API responses
 * outside of the JWT payload (which is signed and not publicly visible).
 */
export function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return '***.***.***-**';

  // Strip non-digits
  const digits = cpf.replace(/\D/g, '');

  if (digits.length !== 11) return '***.***.***-**';

  // Show only last 6 digits: ***.***. X X X - X X
  return `***.***.${ digits.slice(6, 9) }-${ digits.slice(9) }`;
}
