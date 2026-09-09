import { extractFolderId, detectBookMimeType } from '../src/drive';
import { buildOpdsFeed, buildOpenSearchDescription, cleanBookTitle } from '../src/opds';
import { verifyBasicAuth, createAuthToken, parseBasicAuthHeader } from '../src/auth';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

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
  detectBookMimeType('TaiLieu.pdf', 'application/pdf') === 'application/pdf',
  'Nhận diện PDF'
);
assert(
  detectBookMimeType('Doc.mobi', 'application/octet-stream') === 'application/x-mobipocket-ebook',
  'Nhận diện MOBI'
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
assert(!xmlWithAuth.includes('<author>'), 'Không có thẻ author đoán mò');
assert(xmlWithAuth.includes('<link rel="search" href="https://opds.test.com/feed/rootFolder123/opensearch.xml?auth=dmJvb2s6c2VjcmV0MTIz" type="application/opensearchdescription+xml" title="Tìm kiếm sách"/>'), 'Thẻ OpenSearch link trong root feed');

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

console.log('--- 5. Kiểm tra OpenSearch Description Builder ---');
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

console.log('\n=========================================');
console.log('TẤT CẢ 6 BỘ KIỂM THỬ ĐỀU ĐẠT CHUẨN 100%!');
console.log('=========================================');
