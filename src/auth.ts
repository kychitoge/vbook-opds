/**
 * Kiểm tra và giải mã HTTP Basic Auth header
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

  // So sánh chuỗi base64(username:password)
  return clientToken === expectedAuthToken;
}

/**
 * Tạo token Base64 từ username và password
 */
export function createAuthToken(username: string, password: string): string {
  return btoa(`${username}:${password}`);
}
