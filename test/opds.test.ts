import { extractFolderId, detectBookMimeType } from '../src/drive';
import { buildOpdsFeed, parseTitleAndAuthor } from '../src/opds';
import { verifyBasicAuth, createAuthToken } from '../src/auth';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- 1. Kiểm tra trích xuất Folder ID ---');
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

console.log('--- 3. Kiểm tra trích xuất tác giả và tiêu đề ---');
const parsed1 = parseTitleAndAuthor('Dau La Dai Luc - Duong Gia Tam Thieu.epub');
assert(parsed1.title === 'Dau La Dai Luc', 'Title tách dấu gạch ngang');
assert(parsed1.author === 'Duong Gia Tam Thieu', 'Author tách dấu gạch ngang');

const parsed2 = parseTitleAndAuthor('[Kim Dung] Tieu Ngao Giang Ho.epub');
assert(parsed2.title === 'Tieu Ngao Giang Ho', 'Title ngoặc vuông');
assert(parsed2.author === 'Kim Dung', 'Author ngoặc vuông');
console.log('✓ Passed 3. Title & Author parser');

console.log('--- 4. Kiểm tra sinh OPDS XML chuẩn Contract vBook ---');
const xml = buildOpdsFeed({
  feedTitle: 'Kho Sách Mẫu',
  folderId: 'rootFolder123',
  origin: 'https://opds.test.com',
  currentPath: '/feed/rootFolder123',
  nextPageToken: 'page2_token_xyz',
  items: [
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
  ],
});

assert(xml.includes('<feed xmlns="http://www.w3.org/2005/Atom">'), 'Root element feed');
assert(xml.includes('rel="next" href="https://opds.test.com/feed/rootFolder123?page=page2_token_xyz"'), 'Paging rel="next"');
assert(xml.includes('<link rel="subsection" href="https://opds.test.com/feed/subfolder_1" type="application/atom+xml;profile=opds-catalog"/>'), 'Sub-catalog folder');
assert(xml.includes('<link rel="http://opds-spec.org/acquisition" href="https://opds.test.com/download/book_1" type="application/epub+zip"/>'), 'Book acquisition link');
assert(xml.includes('<link rel="http://opds-spec.org/image" href="https://lh3.googleusercontent.com/thumbnail123"'), 'Book cover link');
assert(xml.includes('<title>Pham Nhan Tu Tien.epub</title>'), 'Title bảo lưu đuôi .epub để vBook vẽ badge');
console.log('✓ Passed 4. OPDS XML Builder Contract');

console.log('--- 5. Kiểm tra Basic Auth ---');
const token = createAuthToken('vbook', 'secret123');
assert(verifyBasicAuth(`Basic ${token}`, token) === true, 'Đúng auth token');
assert(verifyBasicAuth('Basic wrong_token', token) === false, 'Sai auth token');
assert(verifyBasicAuth(null, token) === false, 'Thiếu auth header');
assert(verifyBasicAuth(null, undefined) === true, 'Không cài đặt auth');
console.log('✓ Passed 5. Basic Auth Verification');

console.log('\n=========================================');
console.log('TẤT CẢ 5 BỘ KIỂM THỬ ĐỀU ĐẠT CHUẨN 100%!');
console.log('=========================================');
