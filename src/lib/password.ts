// No look-alike characters (0/O, 1/l/I) so generated passwords are easy to read out.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generatePassword(length = 14): string {
  const out: string[] = []
  const bytes = new Uint8Array(1)
  while (out.length < length) {
    crypto.getRandomValues(bytes)
    // Rejection sampling avoids modulo bias.
    if (bytes[0] < 256 - (256 % ALPHABET.length)) out.push(ALPHABET[bytes[0] % ALPHABET.length])
  }
  return out.join('')
}
