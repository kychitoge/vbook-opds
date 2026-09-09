import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fetchDriveFolder, extractFolderId } from './drive';
import { buildOpdsFeed } from './opds';
import { verifyBasicAuth, createAuthToken } from './auth';
import { maskFolderId, unmaskFolderId, isMaskedId } from './crypto';
import { renderHtmlPage } from './ui';

export interface Env {
  GOOGLE_API_KEY?: string;
  DEFAULT_PAGE_SIZE?: string;
  AUTH_USER?: string;
  AUTH_PASS?: string;
  AUTH_TOKEN?: string;
  MASK_SECRET?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Kích hoạt CORS cho mọi nguồn
app.use('*', cors());

function getMaskSecret(c: any): string {
  return c.env.MASK_SECRET || 'vbook-opds-default-key-change-me-in-prod';
}

/**
 * Kiểm tra xác thực Basic Auth:
 * - Ưu tiên 1: Token truyền qua URL param ?auth= (tiện lợi, phi trạng thái, người dùng tạo qua Web UI không cần sửa worker env)
 * - Ưu tiên 2: Biến môi trường Worker AUTH_TOKEN / AUTH_USER (tùy chọn cho ai thích cấu hình tập trung)
 * So khớp với Header Authorization: Basic do vBook tự động gửi lên.
 */
function isAuthorized(c: any): boolean {
  const envToken =
    c.env.AUTH_TOKEN ||
    (c.env.AUTH_USER && c.env.AUTH_PASS
      ? createAuthToken(c.env.AUTH_USER, c.env.AUTH_PASS)
      : undefined);

  const expectedToken = c.req.query('auth') || envToken;
  if (!expectedToken) {
    return true; // Không thiết lập mật khẩu -> Danh mục công khai
  }

  const authHeader = c.req.header('Authorization');
  return verifyBasicAuth(authHeader, expectedToken);
}

/**
 * Trang chủ: Giao diện Web tạo link OPDS cho vBook
 */
app.get('/', (c) => {
  const hasServerKey = Boolean(c.env.GOOGLE_API_KEY);
  return c.html(renderHtmlPage(hasServerKey));
});

/**
 * Endpoint API: Mã hóa Folder ID an toàn để trả về cho Web UI
 */
app.post('/api/mask', async (c) => {
  try {
    const body = await c.req.json<{ folderId?: string }>();
    const rawInput = (body?.folderId || '').trim();
    const folderId = extractFolderId(rawInput);

    if (!folderId) {
      return c.json({ error: 'Đường link hoặc mã thư mục Google Drive không hợp lệ' }, 400);
    }

    const secret = getMaskSecret(c);
    const maskedId = await maskFolderId(folderId, secret);
    return c.json({ success: true, maskedId });
  } catch {
    return c.json({ error: 'Lỗi xử lý mã hóa thư mục' }, 500);
  }
});

/**
 * Endpoint OPDS Feed: Trả về XML Atom danh mục sách cho vBook
 */
app.get('/feed/:folderId', async (c) => {
  const rawFolderId = c.req.param('folderId');
  const secret = getMaskSecret(c);

  let realFolderId: string | null = null;
  let isMasked = false;

  if (isMaskedId(rawFolderId)) {
    realFolderId = await unmaskFolderId(rawFolderId, secret);
    isMasked = true;
    if (!realFolderId) {
      return c.text('Đường dẫn danh mục không hợp lệ hoặc đã bị thay đổi', 400);
    }
  } else {
    realFolderId = extractFolderId(rawFolderId);
    if (!realFolderId) {
      return c.text('Thư mục Google Drive không hợp lệ', 400);
    }
  }

  // 1. Kiểm tra xác thực HTTP Basic Auth
  if (!isAuthorized(c)) {
    return c.text('Yêu cầu xác thực tài khoản (HTTP Basic Auth)', 401, {
      'WWW-Authenticate': 'Basic realm="vBook OPDS Gateway"',
    });
  }

  // 2. Xác định Google Drive API Key
  const apiKey = c.req.query('key') || c.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return c.text(
      'Lỗi: Chưa cung cấp Google Drive API Key. Vui lòng cấu hình GOOGLE_API_KEY trên Cloudflare Worker hoặc truyền qua tham số ?key=YOUR_API_KEY',
      400
    );
  }

  const pageToken = c.req.query('page');
  const pageSize = parseInt(c.env.DEFAULT_PAGE_SIZE || '50', 10);
  const authParam = c.req.query('auth');

  try {
    // 3. Lấy dữ liệu thư mục từ Google Drive
    const driveData = await fetchDriveFolder({
      folderId: realFolderId,
      apiKey,
      pageToken,
      pageSize,
    });

    // Nếu đang ở chế độ ẩn ID: Tạo bảng ánh xạ masked ID cho các thư mục con để không làm lộ ID gốc
    let subfolderIdMap: Record<string, string> | undefined = undefined;
    if (isMasked) {
      subfolderIdMap = {};
      for (const item of driveData.items) {
        if (item.isFolder) {
          subfolderIdMap[item.id] = await maskFolderId(item.id, secret);
        }
      }
    }

    // 4. Sinh XML Atom OPDS 1.2
    const origin = new URL(c.req.url).origin;
    const xml = buildOpdsFeed({
      feedTitle: 'Kho Sách VBook',
      folderId: rawFolderId, // Bảo toàn masked ID trên URL gốc
      items: driveData.items,
      origin,
      currentPath: `/feed/${rawFolderId}`,
      nextPageToken: driveData.nextPageToken,
      authParam,
      apiKeyParam: c.req.query('key'),
      subfolderIdMap,
    });

    const hasAuth = Boolean(authParam || c.env.AUTH_TOKEN || c.env.AUTH_USER);
    const cacheHeader = hasAuth
      ? 'private, no-cache, no-store, must-revalidate'
      : 'public, max-age=60, s-maxage=60';

    return c.text(xml, 200, {
      'Content-Type': 'application/atom+xml;profile=opds-catalog;charset=utf-8',
      'Cache-Control': cacheHeader,
    });
  } catch (error: any) {
    console.error('Lỗi lấy dữ liệu Drive:', error);
    const msg = error.message || '';
    if (msg.includes('404') || msg.includes('File not found')) {
      return c.text(
        'Lỗi: Không tìm thấy thư mục hoặc thư mục chưa được chia sẻ công khai!\n\nCách khắc phục:\n1. Mở Google Drive trên web.\n2. Chuột phải vào Thư mục > Chọn Chia sẻ (Share).\n3. Đổi mục Quyền truy cập chung thành "Bất kỳ ai có đường liên kết đều có thể xem".',
        404
      );
    }
    return c.text('Lỗi xử lý thư mục Google Drive. Vui lòng kiểm tra quyền chia sẻ và API Key.', 500);
  }
});

/**
 * OpenSearch Endpoints (Tạm thời vô hiệu hóa do app vBook chưa kích hoạt tính năng tìm kiếm OPDS.
 * Được bảo lưu trong mã nguồn để sẵn sàng mở lại khi vBook cập nhật hỗ trợ tìm kiếm).
 */
/*
app.get('/feed/:folderId/opensearch.xml', (c) => {
  const rawFolderId = c.req.param('folderId');
  const folderId = extractFolderId(rawFolderId);

  if (!folderId) {
    return c.text('Thư mục Google Drive không hợp lệ', 400);
  }

  const origin = new URL(c.req.url).origin;
  const apiKeyParam = c.req.query('key');
  const authParam = c.req.query('auth');
  const xml = buildOpenSearchDescription(origin, folderId, apiKeyParam, authParam);

  return c.text(xml, 200, {
    'Content-Type': 'application/opensearchdescription+xml;charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
});

app.get('/feed/:folderId/search', async (c) => {
  const rawFolderId = c.req.param('folderId');
  const folderId = extractFolderId(rawFolderId);

  if (!folderId) {
    return c.text('Thư mục Google Drive không hợp lệ', 400);
  }

  if (!isAuthorized(c)) {
    return c.text('Yêu cầu xác thực tài khoản (HTTP Basic Auth)', 401, {
      'WWW-Authenticate': 'Basic realm="vBook OPDS Gateway"',
    });
  }

  const apiKey = c.req.query('key') || c.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return c.text('Lỗi: Chưa cung cấp Google Drive API Key', 400);
  }

  const searchTerm = (c.req.query('q') || '').trim();
  const pageToken = c.req.query('page');
  const pageSize = parseInt(c.env.DEFAULT_PAGE_SIZE || '50', 10);
  const authParam = c.req.query('auth');

  try {
    const origin = new URL(c.req.url).origin;

    if (!searchTerm) {
      const extraAuth = authParam ? `?auth=${authParam}` : '';
      return c.redirect(`${origin}/feed/${folderId}${extraAuth}`, 302);
    }

    const driveData = await searchDriveFolder({
      folderId,
      apiKey,
      searchTerm,
      pageToken,
      pageSize,
    });

    const xml = buildOpdsFeed({
      feedTitle: `Tìm kiếm: "${searchTerm}"`,
      folderId,
      items: driveData.items,
      origin,
      currentPath: `/feed/${folderId}/search`,
      nextPageToken: driveData.nextPageToken,
      authParam,
      apiKeyParam: c.req.query('key'),
      searchTerms: searchTerm,
    });

    return c.text(xml, 200, {
      'Content-Type': 'application/atom+xml;profile=opds-catalog;charset=utf-8',
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    });
  } catch (error: any) {
    console.error('Lỗi tìm kiếm Drive:', error);
    return c.text('Lỗi tìm kiếm trong thư mục Google Drive.', 500);
  }
});
*/

/**
 * Endpoint Tải Sách: Redirect 302 sang Google Direct Download
 * Chi phí băng thông = $0, tuyệt đối không lộ Google API Key
 */
app.get('/download/:fileId', (c) => {
  const fileId = c.req.param('fileId');

  // Kiểm tra định dạng mã file chống Injection / Open Redirect
  if (!/^[a-zA-Z0-9_-]{10,60}$/.test(fileId)) {
    return c.text('Mã tệp Google Drive không hợp lệ', 400);
  }

  // Kiểm tra xác thực nếu có cài đặt
  if (!isAuthorized(c)) {
    return c.text('Yêu cầu xác thực tài khoản (HTTP Basic Auth)', 401, {
      'WWW-Authenticate': 'Basic realm="vBook OPDS Gateway"',
    });
  }

  // Link download trực tiếp từ Google Drive (không phơi API key)
  const googleDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  return c.redirect(googleDownloadUrl, 302);
});

export default app;
