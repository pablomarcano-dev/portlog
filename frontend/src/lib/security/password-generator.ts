// 64 symbols allow each uniformly random byte to select a symbol without bias.
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const PASSWORD_LENGTH = 20;

/** Generate 120 random bits without sending or saving the resulting password. */
export function generateSecurePassword(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH));
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join('');
}
