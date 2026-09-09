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

## Milestone 6: Minor v1.1.0 (Lộ Trình Tương Lai - 100% Private Drive) [Dự Kiến]
- [ ] **M6.1**: **Khắc phục Lộ `folderId` trên Public Link (ADR-003)**:
  - Thay thế `folderId` thô bằng mã định danh che giấu (Masked ID / Alias).
- [ ] **M6.2**: **Hỗ trợ Google Service Account (Zero Public Link)**:
  - Cho phép người dùng kết nối qua Service Account để đọc thư mục hoàn toàn Private trên Google Drive (không cần bật chế độ "Bất kỳ ai có liên kết").
- [ ] **M6.3**: **Proxy Stream Download**:
  - Tải luồng byte sách trực tiếp qua Worker có kiểm soát bộ nhớ đệm (Edge Caching) cho các file Private không thể 302 Redirect.
