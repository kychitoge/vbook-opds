# Kế Hoạch Triển Khai & Danh Sách Công Việc (Backlog)

Dự án được quản lý theo chuẩn SemVer và nguyên tắc Dao cạo Ockham ($0 Infra):

---

## Milestone 1: Nền Tảng & Engine Adapter Core (v1.0.0)
- [x] **M1.1**: Khởi tạo project Cloudflare Worker với TypeScript + Hono Framework.
- [x] **M1.2**: Module trích xuất Folder ID từ URL Google Drive (hỗ trợ nhiều format link chia sẻ khác nhau).
- [x] **M1.3**: Module tương tác Google Drive API v3:
  - Lấy danh sách file và folder con (`pageSize = 50`, phân trang `pageToken`).
  - Lọc các file định dạng sách: `.epub`, `.cbz`, `.pdf`, `.mobi`, `.cbr`, `.fb2`, `.txt`.
- [x] **M1.4**: Module sinh XML Atom (OPDS 1.2 Feed Builder).

---

## Milestone 2: Cơ Chế Tải Sách & Bảo Mật Cơ Bản (v1.0.0)
- [x] **M2.1**: Endpoint tải sách `/download/:fileId`:
  - Trả về mã `HTTP 302 Found` chuyển hướng trực tiếp đến Google Drive Direct Download.
- [x] **M2.2**: Xác thực HTTP Basic Auth phi trạng thái (Stateless).
- [x] **M2.3**: Cơ chế Cache phân tách (Public Edge Cache 60s vs Private `no-store`).

---

## Milestone 3: Giao Diện Người Dùng Tối Giản (v1.0.0)
- [x] **M3.1**: Xây dựng UI HTML/CSS nhúng trực tiếp trong Worker (zero-dependency).
- [x] **M3.2**: Áp dụng Design Tokens chuẩn: Ocean Blue `#038fd2`, Dark/Light Mode.
- [x] **M3.3**: Form 1-click sinh link OPDS + nút Copy vào Clipboard + hướng dẫn 3 bước dán vào vBook.

---

## Milestone 4: Kiểm Thử Thực Tế & Triển Khai (v1.0.0)
- [x] **M4.1**: Kiểm thử tích hợp trực tiếp trên ứng dụng vBook thật.
- [x] **M4.2**: Viết hướng dẫn cấu hình Cloudflare Worker + Cấu hình Custom Domain (DNS).

---

## Milestone 5: Patch v1.0.1 (Contract Alignment, Security Hardening & OpenSearch)
- [x] **M5.1**: **Cắt bỏ Over-Engineering & Đoán mò (ADR-001)**:
  - Xóa deadcode SVG `cover.ts` và route `/cover/:fileId`.
  - Thay thế regex bói tác giả bằng hàm `cleanBookTitle`: Bảo toàn 100% tên sách gốc từ Google Drive (không bị cắt cụt tập/chương, triệt tiêu lỗi lặp badge `[EPUB] [EPUB]`).
  - Loại bỏ thẻ `<author>` đoán mò, tuân thủ đúng chuẩn optional của Atom OPDS.
- [x] **M5.2**: **Vá Lỗ Hổng Bảo Mật & Kế Thừa Auth (ADR-002)**:
  - Kế thừa `authParam` xuyên suốt toàn bộ cây thư mục con và link download, xóa bỏ hoàn toàn nguy cơ Auth Bypass trên subfolders.
  - Thêm Input Validation cho `fileId` bằng regex `/^[a-zA-Z0-9_-]{10,60}$/` chống Injection và Open Redirect.
  - Thuật toán so khớp mật khẩu thời gian hằng số `constantTimeEqual` chống Timing Attack.
  - Che giấu stack trace và mã lỗi nội bộ từ Google API (Information Disclosure).
- [x] **M5.3**: **Bổ sung Đặc Tả Tìm Kiếm OpenSearch 1.1**:
  - Endpoint `/feed/:folderId/opensearch.xml` và `/feed/:folderId/search?q=...`.
  - Thẻ `<link rel="search">` trong feed root, sẵn sàng đón đầu các bản cập nhật vBook tương lai.
- [x] **M5.4**: Nâng cấp bộ kiểm thử tự động lên 6 test suites đạt 100% qua `pnpm test`.

---

## Milestone 5.5: Patch v1.0.2 (Bảo Toàn Đuôi File Sách Cho Contract vBook SVG Cover & Badge)
- [x] **M5.5.1**: **Bảo toàn phần mở rộng file trong thẻ `<title>` (ADR-004)**:
  - Sửa hàm `cleanBookTitle` giữ nguyên 100% phần mở rộng (`.epub`, `.pdf`, `.cbz`...).
  - Giúp `j12.c` và `uya.a` trong vBook nhận diện chính xác đuôi file để tô màu bìa sách SVG (PDF Đỏ, EPUB Xanh, CBZ Cam) và in chữ badge định dạng to trên bìa sách.
  - Hiển thị đầy đủ nhãn format trên dòng phụ (Subtitle `EPUB · 2.5 MB`).
- [x] **M5.5.2**: **Cắt ngắn an toàn phòng vệ**:
  - Tự động cắt ngắn nếu tên file vượt quá 255 ký tự nhưng luôn bảo toàn đuôi file.
  - Không gọt ký tự rác bằng regex đoán mò.
- [x] **M5.5.3**: Nâng cấp bộ kiểm thử tự động (Suite 3 & 4) và cập nhật tài liệu Contract, ADR.

---

## Milestone 6: Minor v1.1.0 (Bảo Vệ Quyền Riêng Tư - Stateless URL Masking & Tạm Dừng OpenSearch)
- [x] **M6.1**: **Khắc phục Lộ `folderId` trên Public Link (ADR-005)**:
  - Thay thế `folderId` thô bằng chuỗi mã hóa an toàn có tiền tố `m_` dùng thuật toán **AES-256-GCM** ($0 database).
  - Ngăn chặn kẻ lạ lấy `folderId` mở trên web Google Drive để soi tên tài khoản, avatar, email hoặc các file cá nhân ngoài sách.
  - Tích hợp tính năng chống giả mạo (Tamper-proof) nhờ Auth Tag của AES-GCM.
  - Đảm bảo tương thích ngược 100%: Nhận diện cả `folderId` thô lẫn `m_...`.
- [x] **M6.2**: **Che giấu toàn bộ thư mục con trong XML Atom Feed**:
  - Tự động mã hóa các thư mục con thành `m_...` trong thẻ `<id>` và `<link rel="subsection">`. Real ID không xuất hiện ở bất kỳ đâu trong XML.
- [x] **M6.3**: **Tạm dừng OpenSearch**:
  - Comment out các route `/opensearch.xml`, `/search` và thẻ `<link rel="search">` trong feed Atom do app vBook hiện chưa kích hoạt tìm kiếm OPDS.
- [x] **M6.4**: **Giữ nguyên 100% Web UI & Tự động ẩn ID**:
  - Giữ nguyên giao diện tối giản, tự động gọi `/api/mask` để sinh link `m_...` mặc định cho người dùng.
  - Phân quyền Admin: Admin cấu hình `MASK_SECRET` trên Cloudflare Worker, người dùng cuối không cần cấu hình gì thêm.
- [x] **M6.5**: Nâng cấp bộ kiểm thử tự động lên 7 test suites đạt 100% qua `pnpm test`.

---

## Milestone 7: Minor v1.2.0 (Google Service Account - Zero Public Link) [Dự Kiến]
- [ ] **M7.1**: Hỗ trợ kết nối Google Service Account (`credentials.json` / private key RS256).
- [ ] **M7.2**: Đọc thư mục Google Drive hoàn toàn đóng (100% Private, không bật public link).
- [ ] **M7.3**: Proxy stream có kiểm soát bộ nhớ đệm cho các file sách Private không thể 302 Redirect.
