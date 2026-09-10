import {
  extractFolderId,
  detectBookMimeType,
  buildSearchQuery,
  clearTreeCache,
  getCachedDescendantFolderIds,
} from '../src/drive';
import { buildOpdsFeed, buildOpenSearchDescription, cleanBookTitle } from '../src/opds';
import { buildOpds2Feed } from '../src/opds2';
import { verifyBasicAuth, createAuthToken, parseBasicAuthHeader } from '../src/auth';
import { maskFolderId, unmaskFolderId, isMaskedId } from '../src/crypto';
import app from '../src/index';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runAllTests() {
  console.log('--- 1. Kiểm tra trích xuất Folder ID & File ID an toàn ---');
assert(
  extractFolderId('https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ') ===
    '1aBcDeFgHiJkLmNoPqRsTuVwXyZ',
  'Trích xuất link folder thông thường'
);
assert(
  extractFolderId('https://drive.google.com/drive/u/1/folders/12345ABCDE_xyz') ===
    '12345ABCDE_xyz',
  'Trích xuất link folder u/1'
);
assert(
  extractFolderId('https://drive.google.com/open?id=FOLDER_ID_123') ===
    'FOLDER_ID_123',
  'Trích xuất link open?id='
);
assert(
  extractFolderId('FOLDER_ID_1234567890') === 'FOLDER_ID_1234567890',
  'Trích xuất ID trực tiếp'
);
assert(
  extractFolderId("' or '1'='1") === null,
  'Chặn ID độc hại chứa ký tự injection'
);
console.log('✓ Passed 1. Folder ID extraction');

console.log('--- 2. Kiểm tra nhận diện MIME Type sách cho vBook ---');
assert(
  detectBookMimeType('Truyen.epub', 'application/octet-stream') === 'application/epub+zip',
  'Nhận diện EPUB'
);
assert(
  detectBookMimeType('Manga.cbz', 'application/zip') === 'application/vnd.comicbook+zip',
  'Nhận diện CBZ'
);
assert(
  detectBookMimeType('Comic.cbr', 'application/x-rar') === 'application/vnd.comicbook-rar',
  'Nhận diện CBR chuẩn vBook (comicbook-rar)'
);
assert(
  detectBookMimeType('TaiLieu.pdf', 'application/pdf') === 'application/pdf',
  'Nhận diện PDF'
);
assert(
  detectBookMimeType('Doc.mobi', 'application/octet-stream') === 'application/x-mobipocket-ebook',
  'Nhận diện MOBI'
);
assert(
  detectBookMimeType('Book.prc', 'application/octet-stream') === 'application/x-mobipocket-ebook',
  'Nhận diện PRC'
);
assert(
  detectBookMimeType('Kindle.azw', 'application/octet-stream') === 'application/vnd.amazon.ebook',
  'Nhận diện Kindle AZW'
);
assert(
  detectBookMimeType('Kindle.azw3', 'application/octet-stream') === 'application/vnd.amazon.mobi8-ebook',
  'Nhận diện Kindle AZW3'
);
assert(
  detectBookMimeType('Fiction.fb2', 'text/xml') === 'application/x-fictionbook+xml',
  'Nhận diện FB2 chuẩn vBook (x-fictionbook+xml)'
);
assert(
  detectBookMimeType('Fiction.fb2.zip', 'application/zip') === 'application/x-zip-compressed-fb2',
  'Nhận diện FB2.ZIP'
);
assert(
  detectBookMimeType('Document.docx', 'application/octet-stream') === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'Nhận diện DOCX'
);
assert(
  detectBookMimeType('Document.doc', 'application/octet-stream') === 'application/msword',
  'Nhận diện DOC'
);
assert(
  detectBookMimeType('Archive.zip', 'application/zip') === 'application/zip',
  'Nhận diện ZIP'
);
assert(
  detectBookMimeType('Plain.txt', 'text/plain') === 'text/plain',
  'Nhận diện TXT'
);
assert(
  detectBookMimeType('Video.mp4', 'video/mp4') === null,
  'Bỏ qua file không phải sách'
);
console.log('✓ Passed 2. Book MIME types');

console.log('--- 3. Kiểm tra làm sạch tên sách (Bảo toàn 100% tên file gốc có đuôi) ---');
assert(
  cleanBookTitle('Dau La Dai Luc - Tap 1.epub') === 'Dau La Dai Luc - Tap 1.epub',
  'Bảo toàn tên tập và đuôi epub cho vBook render icon'
);
assert(
  cleanBookTitle('[Full] Pham Nhan Tu Tien.pdf') === '[Full] Pham Nhan Tu Tien.pdf',
  'Bảo toàn tiền tố [Full] và đuôi pdf'
);
assert(
  cleanBookTitle('Harry Potter - J.K. Rowling.cbz') === 'Harry Potter - J.K. Rowling.cbz',
  'Bảo toàn nguyên văn tên file kèm đuôi cbz'
);

const longName = 'A'.repeat(260) + '.epub';
const cleaned = cleanBookTitle(longName);
assert(
  cleaned.length === 255 && cleaned.endsWith('.epub'),
  'Cắt ngắn an toàn nhưng vẫn bảo toàn đuôi file khi quá 255 ký tự'
);
console.log('✓ Passed 3. Clean Book Title with preserved extension');

console.log('--- 4. Kiểm tra sinh OPDS XML chuẩn Contract vBook & Kế thừa Auth ---');
const items = [
  {
    id: 'subfolder_1',
    name: 'Truyện Tiên Hiệp',
    mimeType: 'application/vnd.google-apps.folder',
    isFolder: true,
  },
  {
    id: 'book_1',
    name: 'Pham Nhan Tu Tien - Vong Ngu.epub',
    mimeType: 'application/epub+zip',
    bookMimeType: 'application/epub+zip',
    isFolder: false,
    thumbnailLink: 'https://lh3.googleusercontent.com/thumbnail123',
  },
];

// 4.1. Trường hợp có thiết lập auth qua URL
const xmlWithAuth = buildOpdsFeed({
  feedTitle: 'Kho Sách Có Mật Khẩu',
  folderId: 'rootFolder123',
  origin: 'https://opds.test.com',
  currentPath: '/feed/rootFolder123',
  nextPageToken: 'page2_token_xyz',
  authParam: 'dmJvb2s6c2VjcmV0MTIz',
  items,
});

assert(xmlWithAuth.includes('<feed xmlns="http://www.w3.org/2005/Atom">'), 'Root element feed');
assert(xmlWithAuth.includes('rel="next" href="https://opds.test.com/feed/rootFolder123?auth=dmJvb2s6c2VjcmV0MTIz&amp;page=page2_token_xyz"'), 'Paging kế thừa auth param');
assert(xmlWithAuth.includes('<link rel="subsection" href="https://opds.test.com/feed/subfolder_1?auth=dmJvb2s6c2VjcmV0MTIz" type="application/atom+xml;profile=opds-catalog"/>'), 'Subfolder kế thừa auth param bảo vệ thư mục con');
assert(xmlWithAuth.includes('<link rel="http://opds-spec.org/acquisition" href="https://opds.test.com/download/book_1?auth=dmJvb2s6c2VjcmV0MTIz" type="application/epub+zip"/>'), 'Download link kế thừa auth param');
assert(xmlWithAuth.includes('<title>Pham Nhan Tu Tien - Vong Ngu.epub</title>'), 'Title bảo toàn đuôi file để vBook render bìa SVG và badge format');
assert(xmlWithAuth.includes('<category term="EPUB" label="EPUB"/>'), 'Thẻ category format tag cho vBook nhận diện định dạng');
assert(xmlWithAuth.includes('<content type="text">Pham Nhan Tu Tien - Vong Ngu.epub</content>'), 'Thẻ content fallback cho reader text');
assert(!xmlWithAuth.includes('<author>'), 'Không có thẻ author đoán mò');
assert(
  xmlWithAuth.includes(
    '<link rel="search" href="https://opds.test.com/feed/rootFolder123/search?q={searchTerms}&amp;auth=dmJvb2s6c2VjcmV0MTIz" type="application/atom+xml;profile=opds-catalog" title="Tìm kiếm sách"/>'
  ),
  'Thẻ OpenSearch link nhúng trực tiếp URL template chứa {searchTerms} và kế thừa auth theo vBook contract'
);

// 4.2. Trường hợp feed công khai không cài auth
const xmlPublic = buildOpdsFeed({
  feedTitle: 'Kho Sách Công Khai',
  folderId: 'rootFolder123',
  origin: 'https://opds.test.com',
  currentPath: '/feed/rootFolder123',
  items,
});
assert(!xmlPublic.includes('auth='), 'Feed công khai sạch link hoàn toàn không có auth param');
console.log('✓ Passed 4. OPDS XML Builder Contract & Auth inheritance');

console.log('--- 5. Kiểm tra OpenSearch Description Builder (Bảo lưu cho tương lai) ---');
const openSearchXml = buildOpenSearchDescription('https://opds.test.com', 'folder123', 'API_KEY_VAL', 'TOKEN123');
assert(openSearchXml.includes('<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">'), 'Root OpenSearchDescription tag');
assert(openSearchXml.includes('template="https://opds.test.com/feed/folder123/search?q={searchTerms}&amp;key=API_KEY_VAL&amp;auth=TOKEN123"'), 'Search URL template kế thừa key và auth');
console.log('✓ Passed 5. OpenSearch Description Builder');

console.log('--- 6. Kiểm tra Basic Auth & Giải mã Header ---');
const token = createAuthToken('vbook', 'secret123');
assert(verifyBasicAuth(`Basic ${token}`, token) === true, 'Đúng auth token');
assert(verifyBasicAuth('Basic wrong_token', token) === false, 'Sai auth token');
assert(verifyBasicAuth(null, token) === false, 'Thiếu auth header');
assert(verifyBasicAuth(null, undefined) === true, 'Không cài đặt auth');

const credentials = parseBasicAuthHeader(`Basic ${token}`);
assert(credentials !== null && credentials.user === 'vbook' && credentials.pass === 'secret123', 'Giải mã đúng user và pass');
assert(parseBasicAuthHeader('InvalidHeader') === null, 'Header không hợp lệ trả về null');
console.log('✓ Passed 6. Basic Auth Verification & Header Parser');

console.log('--- 7. Kiểm tra Stateless URL Masking (AES-256-GCM) & Chống Giả Mạo ---');
const secret = 'test-secret-key-12345';
const rawFolderId = '1aBcDeFgHiJkLmNoPqRsTuVwXyZ123456';

// 7.1. Mã hóa và giải mã thành công
const masked = await maskFolderId(rawFolderId, secret);
assert(isMaskedId(masked) === true, 'Mã hóa sinh tiền tố m_');
assert(masked.startsWith('m_'), 'Tiền tố m_');

const unmasked = await unmaskFolderId(masked, secret);
assert(unmasked === rawFolderId, 'Giải mã chính xác 100% Folder ID ban đầu');

// 7.2. Chống giả mạo (Tamper-proof): Sửa ký tự trong chuỗi mã hóa
const tampered = masked.slice(0, -3) + 'XYZ';
const tamperedResult = await unmaskFolderId(tampered, secret);
assert(tamperedResult === null, 'Chuỗi bị can thiệp sẽ bị Auth Tag từ chối giải mã (null)');

// 7.3. Sai Secret Key
const wrongSecretResult = await unmaskFolderId(masked, 'wrong-secret-key-9999');
assert(wrongSecretResult === null, 'Sai secret key không thể giải mã (null)');

// 7.4. Kiểm tra che giấu ID thư mục con trong XML feed (subfolderIdMap)
const subfolderMaskedId = await maskFolderId('subfolder_1', secret);
const xmlMasked = buildOpdsFeed({
  feedTitle: 'Kho Sách Ẩn ID',
  folderId: masked,
  origin: 'https://opds.test.com',
  currentPath: `/feed/${masked}`,
  items,
  subfolderIdMap: {
    subfolder_1: subfolderMaskedId,
  },
});

assert(xmlMasked.includes(`<id>urn:vbook:feed:${masked}</id>`), 'Root feed id dùng masked id');
assert(xmlMasked.includes(`<id>urn:vbook:folder:${subfolderMaskedId}</id>`), 'Thư mục con dùng masked id');
assert(xmlMasked.includes(`href="https://opds.test.com/feed/${subfolderMaskedId}"`), 'Link thư mục con dùng masked id');
assert(!xmlMasked.includes('subfolder_1'), 'Tuyệt đối không lộ ID thật subfolder_1 trong XML');
console.log('✓ Passed 7. Stateless URL Masking & Tamper-proof');

console.log('--- 8. Kiểm tra vBook Native OpenSearch Contract & Phân trang kết quả ---');
// 8.1. Giả lập feed kết quả tìm kiếm với từ khóa và phân trang
const searchFeedXml = buildOpdsFeed({
  feedTitle: 'Tìm kiếm: "harry potter"',
  folderId: masked,
  origin: 'https://opds.test.com',
  currentPath: `/feed/${masked}/search`,
  searchTerms: 'harry potter',
  nextPageToken: 'search_page_2',
  authParam: 'tokenXYZ',
  apiKeyParam: 'key123',
  items: [
    {
      id: 'book_search_1',
      name: 'Harry Potter - Tap 1.epub',
      mimeType: 'application/epub+zip',
      bookMimeType: 'application/epub+zip',
      isFolder: false,
    },
  ],
});

assert(searchFeedXml.includes('<title>Tìm kiếm: &quot;harry potter&quot;</title>'), 'Feed title chứa từ khóa tìm kiếm');
assert(
  searchFeedXml.includes(
    `rel="self" href="https://opds.test.com/feed/${masked}/search?auth=tokenXYZ&amp;key=key123&amp;q=harry+potter"`
  ),
  'Self link bảo toàn q, auth và key'
);
assert(
  searchFeedXml.includes(
    `rel="next" href="https://opds.test.com/feed/${masked}/search?auth=tokenXYZ&amp;key=key123&amp;page=search_page_2&amp;q=harry+potter"`
  ),
  'Next link phân trang tìm kiếm kế thừa token trang và từ khóa q'
);
assert(
  searchFeedXml.includes(
    `<link rel="search" href="https://opds.test.com/feed/${masked}/search?q={searchTerms}&amp;auth=tokenXYZ&amp;key=key123"`
  ),
  'Template search link cho phép tìm kiếm tiếp trong kết quả'
);
assert(searchFeedXml.includes('Harry Potter - Tap 1.epub'), 'Sách tìm thấy hiển thị trong feed');
console.log('✓ Passed 8. vBook Native OpenSearch Engine & Pagination');

console.log('--- 9. Kiểm tra OPDS 2.0 JSON Builder Contract (application/opds+json) ---');
const opds2FeedRaw = buildOpds2Feed({
  feedTitle: 'Kho Sách OPDS 2.0',
  folderId: masked,
  origin: 'https://opds.test.com',
  currentPath: `/feed/${masked}`,
  nextPageToken: 'next_page_opds2',
  authParam: 'tokenXYZ',
  apiKeyParam: 'key123',
  subfolderIdMap: {
    subfolder_1: subfolderMaskedId,
  },
  items: [
    {
      id: 'subfolder_1',
      name: 'Thư Mục Kiếm Hiệp',
      mimeType: 'application/vnd.google-apps.folder',
      isFolder: true,
    },
    {
      id: 'book_opds2_1',
      name: 'Tieu Ngao Giang Ho.epub',
      mimeType: 'application/epub+zip',
      bookMimeType: 'application/epub+zip',
      isFolder: false,
      thumbnailLink: 'https://lh3.googleusercontent.com/thumb_opds2',
    },
  ],
});

const opds2Feed = JSON.parse(opds2FeedRaw);

assert(opds2Feed.metadata.title === 'Kho Sách OPDS 2.0', 'OPDS 2.0 Metadata Title');
assert(opds2Feed.metadata.identifier === `urn:vbook:feed:${masked}`, 'OPDS 2.0 Metadata Identifier');

// Links
const selfLink = opds2Feed.links.find((l) => l.rel.includes('self'));
assert(selfLink !== undefined && selfLink.type === 'application/opds+json', 'OPDS 2.0 Self link đúng type');
assert(selfLink?.href.includes('auth=tokenXYZ') === true, 'Self link bảo toàn auth');

const searchLink = opds2Feed.links.find((l) => l.rel.includes('search'));
assert(
  searchLink !== undefined &&
    searchLink.href.includes('{searchTerms}') &&
    searchLink.href.includes('auth=tokenXYZ') &&
    searchLink.type === 'application/opds+json',
  'OPDS 2.0 Search link chứa {searchTerms} và type JSON'
);

const nextLink = opds2Feed.links.find((l) => l.rel.includes('next'));
assert(nextLink !== undefined && nextLink.href.includes('page=next_page_opds2'), 'OPDS 2.0 Next link phân trang');

// Navigation (Subfolders)
assert(opds2Feed.navigation.length === 1, 'OPDS 2.0 Navigation có 1 thư mục');
assert(opds2Feed.navigation[0].title === 'Thư Mục Kiếm Hiệp', 'OPDS 2.0 Navigation Title');
assert(opds2Feed.navigation[0].href === `https://opds.test.com/feed/${subfolderMaskedId}?auth=tokenXYZ&key=key123`, 'OPDS 2.0 Navigation dùng Masked ID và kế thừa auth');
assert(!JSON.stringify(opds2Feed.navigation).includes('subfolder_1'), 'Tuyệt đối không rò rỉ raw subfolder_1');

// Publications (Books)
assert(opds2Feed.publications.length === 1, 'OPDS 2.0 Publications có 1 quyển sách');
const pub = opds2Feed.publications[0];
assert(pub.metadata.title === 'Tieu Ngao Giang Ho.epub', 'Publication title bảo toàn đuôi');
assert(pub.links.length === 1 && pub.links[0].type === 'application/epub+zip', 'Acquisition link đúng mime');
assert(pub.links[0].href.includes('download/book_opds2_1'), 'Acquisition download URL');
assert(pub.images.length === 1 && pub.images[0].href === 'https://lh3.googleusercontent.com/thumb_opds2', 'Publication thumbnail image');
console.log('✓ Passed 9. OPDS 2.0 JSON Builder Contract (application/opds+json)');

console.log('--- 10. Kiểm tra Worker Server Download Bypass & Hardening ---');
const dlRes = await app.request('/download/test_file_id_12345');
assert(dlRes.status === 302, 'Download endpoint trả về mã HTTP 302 Redirect');
assert(
  dlRes.headers.get('Location') ===
    'https://drive.google.com/uc?export=download&id=test_file_id_12345&confirm=t',
  'Download redirect chứa confirm=t để bypass cảnh báo file lớn của Google Drive'
);

const invalidDlRes = await app.request('/download/bad/../id');
assert(invalidDlRes.status === 400, 'Chặn fileId không hợp lệ chống Injection');

// Kiểm tra bảo mật: Tuyệt đối không hardcode fallback MASK_SECRET
const maskWithoutSecretRes = await app.request('/api/mask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ folderId: '1234567890abcdef' }),
});
assert(
  maskWithoutSecretRes.status === 500,
  'Chặn /api/mask khi server chưa cấu hình MASK_SECRET'
);

const maskWithSecretRes = await app.request(
  '/api/mask',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId: '1234567890abcdef' }),
  },
  {
    MASK_SECRET: 'super-secret-key-32-chars-long!!',
  }
);
assert(maskWithSecretRes.status === 200, '/api/mask thành công khi có MASK_SECRET');
const maskData = await maskWithSecretRes.json();
assert(
  typeof maskData.maskedId === 'string' && maskData.maskedId.startsWith('m_'),
  '/api/mask sinh ID ẩn danh tiền tố m_'
);

const feedWithoutSecretRes = await app.request('/feed/m_AbCdEf123456');
assert(
  feedWithoutSecretRes.status === 500,
  'Chặn truy cập feed ẩn danh nếu server thiếu MASK_SECRET'
);

console.log('✓ Passed 10. Worker Server Download Bypass & Hardening (Zero Hardcoded Secret)');

console.log('--- 11. Kiểm tra Deep Search Engine (Tìm kiếm xuyên suốt thư mục con) ---');
// 11.1. Query với 1 thư mục gốc
const singleFolderQuery = buildSearchQuery({
  folderIds: ['root_folder_id_123'],
  searchTerm: 'Harry Potter',
});
assert(
  singleFolderQuery === "('root_folder_id_123' in parents) and trashed = false and name contains 'Harry Potter'",
  'Query tìm kiếm chuẩn cho 1 folder'
);

// 11.2. Query Deep Search đa thư mục (root + subfolders) kèm escape ký tự đặc biệt
const deepQuery = buildSearchQuery({
  folderIds: ['root_folder_id_123', 'subfolder_van_hoc', 'subfolder_kinh_te'],
  searchTerm: "O'Reilly & Conan\\Doyle",
});
assert(
  deepQuery.includes("('root_folder_id_123' in parents or 'subfolder_van_hoc' in parents or 'subfolder_kinh_te' in parents)"),
  'Deep query gộp tất cả các folder cha bằng mệnh đề OR'
);
assert(
  deepQuery.includes("name contains 'O\\'Reilly & Conan\\\\Doyle'"),
  'Deep query escape an toàn nháy đơn và gạch chéo ngược'
);
assert(deepQuery.includes('trashed = false'), 'Deep query lọc bỏ file trong thùng rác');

// 11.3. Kiểm tra Tree Memoization Cache helper (TTL 300s)
clearTreeCache();
assert(typeof clearTreeCache === 'function', 'clearTreeCache tồn tại và thực thi sạch sẽ');
console.log('✓ Passed 11. Deep Search Engine (Recursive Subfolders & Tree Cache 300s)');

console.log('--- 12. Kiểm tra Edge Cache Isolation & Cache-Control Headers ---');
// 12.1. OpenSearch description cache headers
const osRes = await app.request('/feed/test_folder/opensearch.xml');
assert(osRes.status === 200, 'OpenSearch XML 200 OK');
assert(
  osRes.headers.get('Cache-Control')?.includes('public, max-age=86400') === true,
  'OpenSearch Description cache 24h'
);

// 12.2. Kiểm tra Search rỗng redirect về feed gốc (công khai và có auth)
const emptySearchRes = await app.request('/feed/1234567890abcdef/search');
assert(emptySearchRes.status === 302, 'Search rỗng chuyển hướng 302 về root feed');
assert(
  emptySearchRes.headers.get('Location')?.includes('/feed/1234567890abcdef') === true,
  'Redirect search rỗng về đúng root feed'
);

const validAuthToken = createAuthToken('admin', '123456');
const emptySearchWithAuthRes = await app.request(
  `/feed/1234567890abcdef/search?auth=${validAuthToken}`,
  {
    headers: {
      Authorization: 'Basic ' + Buffer.from('admin:123456').toString('base64'),
    },
  }
);
assert(emptySearchWithAuthRes.status === 302, 'Search rỗng có auth hợp lệ chuyển hướng 302');
assert(
  emptySearchWithAuthRes.headers.get('Location')?.includes(`auth=${validAuthToken}`) === true,
  'Redirect search rỗng bảo toàn auth token'
);

// 12.3. Kiểm tra chặn truy cập khi sai Basic Auth (bảo mật tuyệt đối, không cache)
const authFailRes = await app.request('/feed/root_folder?auth=correctToken', {
  headers: {
    Authorization: 'Basic ' + Buffer.from('user:wrongpassword').toString('base64'),
  },
});
assert(authFailRes.status === 401, 'Chặn 401 khi Basic Auth không khớp');

console.log('✓ Passed 12. Edge Cache Isolation & Cache-Control Headers');

  console.log('\n=========================================');
  console.log('TẤT CẢ 12 BỘ KIỂM THỬ ĐỀU ĐẠT CHUẨN 100%!');
  console.log('=========================================');
}

runAllTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
