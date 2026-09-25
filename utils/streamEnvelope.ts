// utils/streamEnvelope.ts — opens the encrypted lecture API response in the browser.
const SALT = "pwm-env-7c1e";

function fromB64u(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

export async function openEnvelope<T = any>(env: any): Promise<T | null> {
  try {
    if (!env?.n || !env?.i || !env?.d) return null;
    const n = fromB64u(env.n);
    const salt = new TextEncoder().encode(SALT);
    const mat = new Uint8Array(n.length + salt.length);
    mat.set(n, 0);
    mat.set(salt, n.length);
    const keyRaw = await crypto.subtle.digest("SHA-256", mat);
    const key = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64u(env.i) as BufferSource },
      key,
      fromB64u(env.d) as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}
