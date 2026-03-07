#!/usr/bin/env node
/**
 * Generates a VAPID key pair for Web Push notifications.
 * Run once: node scripts/gen-vapid-keys.mjs
 * Then add the output to your .env and Cloudflare Worker environment variables.
 */

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

const keyPair = await crypto.subtle.generateKey(
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveKey']
);

const [publicKeyRaw, privateKeyPkcs8] = await Promise.all([
  crypto.subtle.exportKey('raw', keyPair.publicKey),
  crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
]);

const publicKey  = toBase64Url(publicKeyRaw);
const privateKey = toBase64Url(privateKeyPkcs8);

console.log('\n── VAPID Keys ───────────────────────────────────────');
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`\nCloudflare Worker env var (VAPID_PRIVATE_KEY):\n${privateKey}`);
console.log('\nAdd VITE_VAPID_PUBLIC_KEY to your .env file.');
console.log('Add VAPID_PRIVATE_KEY to your Cloudflare Worker environment variables.');
console.log('────────────────────────────────────────────────────\n');
