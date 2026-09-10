import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fetchDriveFolder, extractFolderId, searchDriveFolder } from './drive';
import { buildOpdsFeed, buildOpenSearchDescription } from './opds';
import { buildOpds2Feed } from './opds2';
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

function getMaskSecret(c: any): string | null {
  return c.env?.MASK_SECRET || null;
}

function isOpds2Requested(c: any): boolean {
  const accept = c.req.header('Accept') || '';
  return accept.includes('application/opds+json');
}

/**
 * Đọc phản hồi từ Cloudflare Edge Cache (caches.default)
 * Tự động phân tách cache giữa XML và JSON thông qua query _fmt nội bộ
 */
async function getFromEdgeCache(c: any, isOpds2: boolean): Promise<Response | null> {
  try {
    if (typeof caches === 'undefined' || !caches?.default) return null;
    const url = new URL(c.req.url);
    url.searchParams.set('_fmt', isOpds2 ? 'json' : 'xml');
    const cacheKey = new Request(url.toString(), {
      method: 'GET',
      headers: c.req.raw?.headers,
    });
    const match = await caches.default.match(cacheKey);
    if (match) {
      const res = new Response(match.body, match);
      res.headers.set('X-Gateway-Cache', 'HIT');
      return res;
    }
  } catch (err) {
    console.warn('Lỗi đọc Edge Cache:', err);
  }
  return null;
}

/**
 * Lưu phản hồi vào Cloudflare Edge Cache (caches.default)
 */
async function putToEdgeCache(c: any, isOpds2: boolean, res: Response): Promise<void> {
  try {
    if (typeof caches === 'undefined' || !caches?.default) return;
    const url = new URL(c.req.url);
    url.searchParams.set('_fmt', isOpds2 ? 'json' : 'xml');
    const cacheKey = new Request(url.toString(), {
      method: 'GET',
      headers: c.req.raw?.headers,
    });
    const cloned = res.clone();
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(caches.default.put(cacheKey, cloned));
    } else {
      await caches.default.put(cacheKey, cloned);
    }
  } catch (err) {
    console.warn('Lỗi ghi Edge Cache:', err);
  }
}

/**
 * Kiểm tra xác thực Basic Auth:
 * - Ưu tiên 1: Token truyền qua URL param ?auth= (tiện lợi, phi trạng thái, người dùng tạo qua Web UI không cần sửa worker env)
 * - Ưu tiên 2: Biến môi trường Worker AUTH_TOKEN / AUTH_USER (tùy chọn cho ai thích cấu hình tập trung)
 * So khớp với Header Authorization: Basic do vBook tự động gửi lên.
 */
function isAuthorized(c: any): boolean {
  const envToken =
    c.env?.AUTH_TOKEN ||
    (c.env?.AUTH_USER && c.env?.AUTH_PASS
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
  const hasServerKey = Boolean(c.env?.GOOGLE_API_KEY);
  return c.html(renderHtmlPage(hasServerKey));
});

/**
 * Endpoint API: Mã hóa Folder ID an toàn để trả về cho Web UI
 */
app.post('/api/mask', async (c) => {
  try {
    const secret = getMaskSecret(c);
    if (!secret) {
      return c.json(
        { error: 'Lỗi cấu hình máy chủ: Chưa thiết lập bí mật MASK_SECRET trên Cloudflare Worker' },
        500
      );
    }

    const body = await c.req.json<{ folderId?: string }>();
    const rawInput = (body?.folderId || '').trim();
    const folderId = extractFolderId(rawInput);

    if (!folderId) {
      return c.json({ error: 'Đường link hoặc mã thư mục Google Drive không hợp lệ' }, 400);
    }

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
    if (!secret) {
      return c.text('Lỗi cấu hình máy chủ: Thiếu MASK_SECRET để giải mã danh mục sách', 500);
    }
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

  const authParam = c.req.query('auth');
  const hasAuth = Boolean(authParam || c.env?.AUTH_TOKEN || c.env?.AUTH_USER);
  const isOpds2 = isOpds2Requested(c);

  // 1.5. Kiểm tra Edge Cache (chỉ cache feed công khai, không cache feed có bảo mật auth)
  if (!hasAuth) {
    const cached = await getFromEdgeCache(c, isOpds2);
    if (cached) return cached;
  }

  // 2. Xác định Google Drive API Key
  const apiKey = c.req.query('key') || c.env?.GOOGLE_API_KEY;
  if (!apiKey) {
    return c.text(
      'Lỗi: Chưa cung cấp Google Drive API Key. Vui lòng cấu hình GOOGLE_API_KEY trên Cloudflare Worker hoặc truyền qua tham số ?key=YOUR_API_KEY',
      400
    );
  }

  const pageToken = c.req.query('page');
  const pageSize = parseInt(c.env?.DEFAULT_PAGE_SIZE || '50', 10);

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
    if (isMasked && secret) {
      subfolderIdMap = {};
      for (const item of driveData.items) {
        if (item.isFolder) {
          subfolderIdMap[item.id] = await maskFolderId(item.id, secret);
        }
      }
    }

    const origin = new URL(c.req.url).origin;
    const cacheHeader = hasAuth
      ? 'private, no-cache, no-store, must-revalidate'
      : 'public, max-age=60, s-maxage=60';
    const commonHeaders: Record<string, string> = {
      'Cache-Control': cacheHeader,
      'Vary': 'Accept',
      'X-Gateway-Cache': 'MISS',
    };

    // 4. Content Negotiation: Trả về OPDS 2.0 JSON nếu client gửi Accept: application/opds+json
    if (isOpds2) {
      const json = buildOpds2Feed({
        feedTitle: 'Kho Sách VBook',
        folderId: rawFolderId,
        items: driveData.items,
        origin,
        currentPath: `/feed/${rawFolderId}`,
        nextPageToken: driveData.nextPageToken,
        authParam,
        apiKeyParam: c.req.query('key'),
        subfolderIdMap,
      });

      const res = c.text(json, 200, {
        'Content-Type': 'application/opds+json;charset=utf-8',
        ...commonHeaders,
      });
      if (!hasAuth) {
        await putToEdgeCache(c, isOpds2, res);
      }
      return res;
    }

    // Mặc định: Sinh XML Atom OPDS 1.2
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

    const res = c.text(xml, 200, {
      'Content-Type': 'application/atom+xml;profile=opds-catalog;charset=utf-8',
      ...commonHeaders,
    });
    if (!hasAuth) {
      await putToEdgeCache(c, isOpds2, res);
    }
    return res;
  } catch (error: any) {
    console.error('Lỗi lấy dữ liệu Drive:', error);
    const msg = error.message || '';
    if (msg.includes('404') || msg.includes('File not found')) {
      return c.text(
        'Lỗi: Không tìm thấy thư mục hoặc thư mục chưa được chia sẻ công khai!\n\nCách khắc phục:\n1. Mở Google Drive trên web.\n2. Chuột phải vào Thư mục > Chọn Chia sẻ (Share).\n3. Đổi mục Quyền truy cập chung thành "Bất kỳ ai có đường liên kết đều có thể xem".',
        404
      );
    }
    if (
      msg.includes('429') ||
      msg.includes('rateLimitExceeded') ||
      msg.includes('userRateLimitExceeded') ||
      msg.includes('quotaExceeded')
    ) {
      return c.text(
        'Lỗi: Đã vượt quá hạn mức truy vấn Google Drive API (429 Too Many Requests).\n\nVui lòng chờ 1-2 phút rồi thử lại, hoặc cấu hình Google Drive API Key riêng trên ứng dụng vBook.',
        429,
        {
          'Retry-After': '60',
        }
      );
    }
    return c.text('Lỗi xử lý thư mục Google Drive. Vui lòng kiểm tra quyền chia sẻ và API Key.', 500);
  }
});

/**
 * OpenSearch Endpoints (Chuẩn vBook & OPDS 1.1)
 * Hỗ trợ tìm kiếm cho cả Folder ID thô lẫn Folder ID ẩn danh m_... (AES-256-GCM)
 */
app.get('/feed/:folderId/opensearch.xml', async (c) => {
  const rawFolderId = c.req.param('folderId');
  const secret = getMaskSecret(c);
  let realFolderId: string | null = null;

  if (isMaskedId(rawFolderId)) {
    if (!secret) {
      return c.text('Lỗi cấu hình máy chủ: Thiếu MASK_SECRET để giải mã danh mục sách', 500);
    }
    realFolderId = await unmaskFolderId(rawFolderId, secret);
    if (!realFolderId) {
      return c.text('Đường dẫn danh mục không hợp lệ hoặc đã bị thay đổi', 400);
    }
  } else {
    realFolderId = extractFolderId(rawFolderId);
    if (!realFolderId) {
      return c.text('Thư mục Google Drive không hợp lệ', 400);
    }
  }

  const origin = new URL(c.req.url).origin;
  const apiKeyParam = c.req.query('key');
  const authParam = c.req.query('auth');
  const xml = buildOpenSearchDescription(origin, rawFolderId, apiKeyParam, authParam);

  return c.text(xml, 200, {
    'Content-Type': 'application/opensearchdescription+xml;charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
});

app.get('/feed/:folderId/search', async (c) => {
  const rawFolderId = c.req.param('folderId');
  const secret = getMaskSecret(c);
  let realFolderId: string | null = null;
  let isMasked = false;

  if (isMaskedId(rawFolderId)) {
    if (!secret) {
      return c.text('Lỗi cấu hình máy chủ: Thiếu MASK_SECRET để giải mã danh mục sách', 500);
    }
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

  if (!isAuthorized(c)) {
    return c.text('Yêu cầu xác thực tài khoản (HTTP Basic Auth)', 401, {
      'WWW-Authenticate': 'Basic realm="vBook OPDS Gateway"',
    });
  }

  const authParam = c.req.query('auth');
  const hasAuth = Boolean(authParam || c.env?.AUTH_TOKEN || c.env?.AUTH_USER);
  const isOpds2 = isOpds2Requested(c);

  // Kiểm tra Edge Cache cho tìm kiếm (300s - chỉ cache khi không có auth)
  if (!hasAuth) {
    const cached = await getFromEdgeCache(c, isOpds2);
    if (cached) return cached;
  }

  const searchTerm = (c.req.query('q') || '').trim();
  const origin = new URL(c.req.url).origin;

  if (!searchTerm) {
    const extraAuth = authParam ? `?auth=${authParam}` : '';
    const keyParam = c.req.query('key');
    const extraKey = keyParam ? (extraAuth ? `&key=${keyParam}` : `?key=${keyParam}`) : '';
    return c.redirect(`${origin}/feed/${rawFolderId}${extraAuth}${extraKey}`, 302);
  }

  const apiKey = c.req.query('key') || c.env?.GOOGLE_API_KEY;
  if (!apiKey) {
    return c.text('Lỗi: Chưa cung cấp Google Drive API Key', 400);
  }

  const pageToken = c.req.query('page');
  const pageSize = parseInt(c.env?.DEFAULT_PAGE_SIZE || '50', 10);

  try {

    const driveData = await searchDriveFolder({
      folderId: realFolderId,
      apiKey,
      searchTerm,
      pageToken,
      pageSize,
    });

    // Nếu đang ở chế độ ẩn ID: Mã hóa các thư mục con trong kết quả tìm kiếm
    let subfolderIdMap: Record<string, string> | undefined = undefined;
    if (isMasked && secret) {
      subfolderIdMap = {};
      for (const item of driveData.items) {
        if (item.isFolder) {
          subfolderIdMap[item.id] = await maskFolderId(item.id, secret);
        }
      }
    }

    // Chống Spam API Quota: Nếu feed công khai, áp dụng Edge Cache 300s (5 phút)
    const cacheHeader = hasAuth
      ? 'private, no-cache, no-store, must-revalidate'
      : 'public, max-age=300, s-maxage=300';
    const commonHeaders: Record<string, string> = {
      'Cache-Control': cacheHeader,
      'Vary': 'Accept',
      'X-Gateway-Cache': 'MISS',
    };

    if (isOpds2) {
      const json = buildOpds2Feed({
        feedTitle: `Tìm kiếm: "${searchTerm}"`,
        folderId: rawFolderId,
        items: driveData.items,
        origin,
        currentPath: `/feed/${rawFolderId}/search`,
        nextPageToken: driveData.nextPageToken,
        authParam,
        apiKeyParam: c.req.query('key'),
        searchTerms: searchTerm,
        subfolderIdMap,
      });

      const res = c.text(json, 200, {
        'Content-Type': 'application/opds+json;charset=utf-8',
        ...commonHeaders,
      });
      if (!hasAuth) {
        await putToEdgeCache(c, isOpds2, res);
      }
      return res;
    }

    const xml = buildOpdsFeed({
      feedTitle: `Tìm kiếm: "${searchTerm}"`,
      folderId: rawFolderId,
      items: driveData.items,
      origin,
      currentPath: `/feed/${rawFolderId}/search`,
      nextPageToken: driveData.nextPageToken,
      authParam,
      apiKeyParam: c.req.query('key'),
      searchTerms: searchTerm,
      subfolderIdMap,
    });

    const res = c.text(xml, 200, {
      'Content-Type': 'application/atom+xml;profile=opds-catalog;charset=utf-8',
      ...commonHeaders,
    });
    if (!hasAuth) {
      await putToEdgeCache(c, isOpds2, res);
    }
    return res;
  } catch (error: any) {
    console.error('Lỗi tìm kiếm Drive:', error);
    const msg = error.message || '';
    if (
      msg.includes('429') ||
      msg.includes('rateLimitExceeded') ||
      msg.includes('userRateLimitExceeded') ||
      msg.includes('quotaExceeded')
    ) {
      return c.text(
        'Lỗi: Đã vượt quá hạn mức truy vấn Google Drive API (429 Too Many Requests).\n\nVui lòng chờ 1-2 phút rồi thử lại, hoặc cấu hình Google Drive API Key riêng trên ứng dụng vBook.',
        429,
        {
          'Retry-After': '60',
        }
      );
    }
    return c.text('Lỗi tìm kiếm trong thư mục Google Drive.', 500);
  }
});

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

  // Link download trực tiếp từ Google Drive (thêm confirm=t để bypass cảnh báo virus file dung lượng lớn >25MB)
  const googleDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
  return c.redirect(googleDownloadUrl, 302);
});

export default app;
