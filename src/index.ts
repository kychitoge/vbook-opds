import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { fetchDriveFolder, extractFolderId } from './drive';
import { buildOpdsFeed } from './opds';
import { verifyBasicAuth } from './auth';
import { renderHtmlPage } from './ui';
import { generateSvgCover } from './cover';

export interface Env {
  GOOGLE_API_KEY?: string;
  DEFAULT_PAGE_SIZE?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Kích hoạt CORS cho mọi nguồn
app.use('*', cors());

/**
 * Trang chủ: Giao diện Web tối giản
 */
app.get('/', (c) => {
  const hasServerKey = Boolean(c.env.GOOGLE_API_KEY);
  return c.html(renderHtmlPage(hasServerKey));
});

/**
 * Endpoint OPDS Feed: Trả về XML Atom theo đúng hợp đồng của vBook
 */
app.get('/feed/:folderId', async (c) => {
  const rawFolderId = c.req.param('folderId');
  const folderId = extractFolderId(rawFolderId);

  if (!folderId) {
    return c.text('Thư mục Google Drive không hợp lệ', 400);
  }

  // 1. Kiểm tra xác thực HTTP Basic Auth
  const expectedAuthToken = c.req.query('auth');
  const authHeader = c.req.header('Authorization');

  if (expectedAuthToken && !verifyBasicAuth(authHeader, expectedAuthToken)) {
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

  try {
    // 3. Lấy dữ liệu từ Google Drive
    const driveData = await fetchDriveFolder({
      folderId,
      apiKey,
      pageToken,
      pageSize,
    });

    // 4. Sinh XML Atom OPDS 1.2
    const origin = new URL(c.req.url).origin;
    const xml = buildOpdsFeed({
      feedTitle: 'Kho Sách VBook',
      folderId,
      items: driveData.items,
      origin,
      currentPath: `/feed/${folderId}`,
      nextPageToken: driveData.nextPageToken,
      authParam: expectedAuthToken,
      apiKeyParam: c.req.query('key'),
    });

    // Nếu feed có cài đặt mật khẩu Auth -> Cấm CDN cache để bảo vệ dữ liệu riêng tư
    // Nếu feed công khai -> Cho phép Edge Cache 60s để giảm tải quota Google
    const cacheHeader = expectedAuthToken
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
    return c.text(`Lỗi xử lý thư mục Drive: ${msg}`, 500);
  }
});

/**
 * Endpoint Tải Sách: Redirect 302 sang Google Direct Download
 * Chi phí băng thông trung chuyển = $0
 */
app.get('/download/:fileId', (c) => {
  const fileId = c.req.param('fileId');

  // Kiểm tra xác thực nếu có cài đặt
  const expectedAuthToken = c.req.query('auth');
  const authHeader = c.req.header('Authorization');
  if (expectedAuthToken && !verifyBasicAuth(authHeader, expectedAuthToken)) {
    return c.text('Yêu cầu xác thực tài khoản (HTTP Basic Auth)', 401, {
      'WWW-Authenticate': 'Basic realm="vBook OPDS Gateway"',
    });
  }

  // Link download trực tiếp từ máy chủ Google Drive
  const googleDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  return c.redirect(googleDownloadUrl, 302);
});

/**
 * Endpoint Ảnh Bìa (Cover Image): Sinh ảnh bìa SVG chuẩn tỷ lệ 2:3 cho vBook
 */
app.get('/cover/:fileId', (c) => {
  const title = c.req.query('title') || 'Sách Điện Tử';
  const author = c.req.query('author') || 'Tác Giả';
  const ext = c.req.query('ext') || 'EPUB';

  const svg = generateSvgCover(title, author, ext);

  return c.text(svg, 200, {
    'Content-Type': 'image/svg+xml;charset=utf-8',
    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
  });
});

export default app;
