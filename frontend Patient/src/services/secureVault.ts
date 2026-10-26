// Encrypted storage on the phone (SETU-Shield, device side).
//
// Anything sensitive the app keeps offline (an ASHA worker's unsent visit readings) is stored encrypted with
// AES-256-GCM. The key never sits next to the data:
//   - Android / iOS: a random 256-bit key in the Android Keystore / iOS Keychain (expo-secure-store), readable
//     only by this app, only on this device, only while it is unlocked. Copying the app's files gives ciphertext.
//   - Web: a non-extractable WebCrypto key kept in IndexedDB (script code can use it, nobody can read it out).
// GCM also detects tampering: an edited record fails to decrypt and is ignored instead of being trusted.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils';

const PREFIX = 'v1:';
// WebCrypto wants a plain ArrayBuffer-backed view.
const ab = (b: Uint8Array) => new Uint8Array(b);
const KEY_NAME = 'carebridge_vault_key_v1';

// ------------------------------------------------------------------------------------------------- native
let nativeKey: Promise<Uint8Array> | null = null;

function getNativeKey(): Promise<Uint8Array> {
  nativeKey ??= (async () => {
    const stored = await SecureStore.getItemAsync(KEY_NAME);
    if (stored) return hexToBytes(stored);
    const key = Crypto.getRandomBytes(32);
    await SecureStore.setItemAsync(KEY_NAME, bytesToHex(key), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return key;
  })();
  return nativeKey;
}

// ------------------------------------------------------------------------------------------------- web
let webKey: Promise<CryptoKey> | null = null;

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getWebKey(): Promise<CryptoKey> {
  webKey ??= (async () => {
    const open = indexedDB.open('carebridge-vault', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('keys');
    const db = await idbRequest(open);
    const existing = await idbRequest(db.transaction('keys').objectStore('keys').get(KEY_NAME)) as CryptoKey | undefined;
    if (existing) return existing;
    // extractable = false: the browser will use this key but never hand out its bytes.
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await idbRequest(db.transaction('keys', 'readwrite').objectStore('keys').put(key, KEY_NAME));
    return key;
  })();
  return webKey;
}

// ------------------------------------------------------------------------------------------------- seal / open
export async function seal(plain: string): Promise<string> {
  const nonce = Crypto.getRandomBytes(12);
  if (Platform.OS === 'web') {
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ab(nonce) }, await getWebKey(), ab(utf8ToBytes(plain)));
    return `${PREFIX}${bytesToHex(nonce)}:${bytesToHex(new Uint8Array(ct))}`;
  }
  const ct = gcm(await getNativeKey(), nonce).encrypt(utf8ToBytes(plain));
  return `${PREFIX}${bytesToHex(nonce)}:${bytesToHex(ct)}`;
}

/** The plain text, or null if the value was tampered with or sealed by another device / install. */
export async function unseal(stored: string): Promise<string | null> {
  const [, nonceHex, ctHex] = stored.split(':');
  try {
    const nonce = hexToBytes(nonceHex);
    const ct = hexToBytes(ctHex);
    if (Platform.OS === 'web') {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ab(nonce) }, await getWebKey(), ab(ct));
      return new TextDecoder().decode(plain);
    }
    return new TextDecoder().decode(gcm(await getNativeKey(), nonce).decrypt(ct));
  } catch {
    return null;
  }
}

/** Drop-in for AsyncStorage get/set, for sensitive values. */
export const vault = {
  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, await seal(value));
  },
  async getItem(key: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(key);
    if (stored == null) return null;
    if (!stored.startsWith(PREFIX)) return stored;      // written before encryption: re-sealed on the next write
    return unseal(stored);
  },
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};
