/**
 * So sánh chuỗi an toàn chống timing attack
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Kiểm tra và xác thực HTTP Basic Auth header
 */
export function verifyBasicAuth(
  authHeader: string | null | undefined,
  expectedAuthToken: string | null | undefined
): boolean {
  // Nếu feed không cài đặt bảo mật auth token -> Cho phép truy cập tự do
  if (!expectedAuthToken) {
    return true;
  }

  // Nếu feed có yêu cầu auth nhưng request không gửi header Authorization
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const clientToken = authHeader.substring(6).trim();
  return constantTimeEqual(clientToken, expectedAuthToken);
}

/**
 * Giải mã header Authorization: Basic sang username và password
 */
export function parseBasicAuthHeader(
  authHeader: string | null | undefined
): { user: string; pass: string } | null {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }
  try {
    const raw = atob(authHeader.substring(6).trim());
    const idx = raw.indexOf(':');
    if (idx === -1) return null;
    return {
      user: raw.substring(0, idx),
      pass: raw.substring(idx + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Tạo token Base64 từ username và password
 */
export function createAuthToken(username: string, password: string): string {
  return btoa(`${username}:${password}`);
}
