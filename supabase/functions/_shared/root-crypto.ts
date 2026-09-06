type ParsedPasswordHash = {
  iterations: number;
  salt: Uint8Array;
  digest: Uint8Array;
};

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function parsePasswordHash(value: string): ParsedPasswordHash {
  const [algorithm, rawIterations, rawSalt, rawDigest] = value.split('$');
  const iterations = Number(rawIterations);
  if (algorithm !== 'pbkdf2_sha256' || !Number.isSafeInteger(iterations) || iterations < 100_000 || !rawSalt || !rawDigest) {
    throw new Error('ROOT_BACKEND_NOT_CONFIGURED');
  }
  const salt = decodeBase64Url(rawSalt);
  const digest = decodeBase64Url(rawDigest);
  if (salt.length < 16 || digest.length !== 32) throw new Error('ROOT_BACKEND_NOT_CONFIGURED');
  return { iterations, salt, digest };
}

export async function derivePasswordDigest(password: string, iterations: number, salt: Uint8Array): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' }, material, 256);
  return new Uint8Array(result);
}

export function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash);
  const actual = await derivePasswordDigest(password, parsed.iterations, parsed.salt);
  return timingSafeEqual(actual, parsed.digest);
}

export function formatPasswordHash(iterations: number, salt: Uint8Array, digest: Uint8Array): string {
  return `pbkdf2_sha256$${iterations}$${encodeBase64Url(salt)}$${encodeBase64Url(digest)}`;
}
