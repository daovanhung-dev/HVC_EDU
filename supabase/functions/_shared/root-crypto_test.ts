import { derivePasswordDigest, formatPasswordHash, verifyPassword } from './root-crypto.ts';

Deno.test('root password hash verifies without storing plaintext', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(24));
  const digest = await derivePasswordDigest('test-password', 100_000, salt);
  const encoded = formatPasswordHash(100_000, salt, digest);

  if (!await verifyPassword('test-password', encoded)) throw new Error('Expected password to verify');
  if (await verifyPassword('wrong-password', encoded)) throw new Error('Expected wrong password to fail');
  if (encoded.includes('test-password')) throw new Error('Password leaked into encoded hash');
});
