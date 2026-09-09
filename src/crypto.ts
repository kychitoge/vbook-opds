/**
 * Module mã hóa và giải mã phi trạng thái (Stateless URL Masking)
 * Sử dụng Web Crypto API (AES-256-GCM) native có sẵn trên Cloudflare Workers.
 * Chi phí: $0 Database, $0 External Library.
 */

// Helper: Chuyển Uint8Array sang chuỗi Base64URL
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper: Chuyển chuỗi Base64URL sang Uint8Array
function base64UrlToBytes(base64Url: string): Uint8Array | null {
  try {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

// Dẫn xuất CryptoKey từ chuỗi secret của Admin bằng SHA-256
async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const secretBytes = enc.encode(secret);
  const keyHash = await crypto.subtle.digest('SHA-256', secretBytes);
  return crypto.subtle.importKey(
    'raw',
    keyHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

const MASK_PREFIX = 'm_';

/**
 * Kiểm tra một ID có phải là ID đã được mã hóa hay không
 */
export function isMaskedId(id: string): boolean {
  return id.startsWith(MASK_PREFIX);
}

/**
 * Mã hóa Folder ID thành chuỗi an toàn m_...
 * @param folderId Chuỗi ID gốc từ Google Drive (ví dụ: 1AbC2dE3fG4h...)
 * @param secret Khóa bí mật do Admin cấu hình (MASK_SECRET)
 */
export async function maskFolderId(folderId: string, secret: string): Promise<string> {
  const key = await getCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes IV chuẩn cho AES-GCM
  const data = new TextEncoder().encode(folderId);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Kết hợp: IV (12 bytes) + Ciphertext & Tag
  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv, 0);
  combined.set(encryptedBytes, iv.length);

  return `${MASK_PREFIX}${bytesToBase64Url(combined)}`;
}

/**
 * Giải mã chuỗi m_... trở về Folder ID gốc
 * @param maskedId Chuỗi mã hóa (ví dụ: m_xK9b2L8p...)
 * @param secret Khóa bí mật do Admin cấu hình (MASK_SECRET)
 * @returns Folder ID gốc, hoặc null nếu khóa sai hoặc chuỗi bị can thiệp
 */
export async function unmaskFolderId(maskedId: string, secret: string): Promise<string | null> {
  if (!isMaskedId(maskedId)) {
    return null;
  }

  const payload = maskedId.substring(MASK_PREFIX.length);
  const combined = base64UrlToBytes(payload);
  if (!combined || combined.length < 28) { // 12 bytes IV + 16 bytes Tag tối thiểu
    return null;
  }

  const iv = combined.slice(0, 12);
  const ciphertextWithTag = combined.slice(12);

  try {
    const key = await getCryptoKey(secret);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertextWithTag
    );
    const originalId = new TextDecoder().decode(decrypted).trim();
    // Kiểm tra tính hợp lệ của Folder ID Google Drive đã giải mã
    if (/^[a-zA-Z0-9_-]{10,60}$/.test(originalId)) {
      return originalId;
    }
    return null;
  } catch {
    // Auth Tag không khớp (dữ liệu bị giả mạo hoặc sai Secret Key)
    return null;
  }
}
