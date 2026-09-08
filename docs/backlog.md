# Kế Hoạch Triển Khai & Danh Sách Công Việc (Backlog)

Dự án được chia thành 4 giai đoạn tinh gọn (Milestones) theo nguyên tắc Ockham's Razor và $0 Infra:

---

## Milestone 1: Nền Tảng & Engine Adapter Core (Core Engine)
- [x] **M1.1**: Khởi tạo project Cloudflare Worker với TypeScript + Hono Framework.
- [x] **M1.2**: Module trích xuất Folder ID từ URL Google Drive (hỗ trợ nhiều format link chia sẻ khác nhau).
- [x] **M1.3**: Module tương tác Google Drive API v3:
  - Lấy danh sách file và folder con (`pageSize = 50`, phân trang `pageToken`).
  - Lọc các file định dạng sách: `.epub`, `.cbz`, `.pdf`, `.mobi`, `.cbr`, `.fb2`, `.txt`.
- [x] **M1.4**: Module sinh XML Atom (OPDS 1.2 Feed Builder):
  - Ánh xạ Navigation Entry (cho Folder).
  - Ánh xạ Acquisition Entry (cho Sách) kèm đúng MIME types (`application/epub+zip`, `application/vnd.comicbook+zip`, `application/pdf`).
  - Bảo lưu đuôi file trong `<title>` để vBook tự động vẽ huy hiệu định dạng.
  - Sinh thẻ `rel="next"` để hỗ trợ Infinite Scroll trên vBook.
  - Xử lý thumbnail/cover image thật từ Drive, không tạo SVG giả cho file EPUB.

---

## Milestone 2: Cơ Chế Tải Sách & Bảo Mật (Streaming & Auth)
- [x] **M2.1**: Endpoint tải sách `/download/:fileId`:
  - Trả về mã `HTTP 302 Found` chuyển hướng trực tiếp đến Google Drive Direct Download (`https://drive.google.com/uc?export=download&id=:fileId`).
- [x] **M2.2**: Middleware HTTP Basic Auth (Stateless):
  - Hỗ trợ mã hóa user/pass trong signature token hoặc Header `Authorization: Basic ...` để vBook gửi kèm khi duyệt và tải sách.
- [x] **M2.3**: Cơ chế Cache phân tách:
  - Thư mục công khai: Edge cache 60s tiết kiệm quota API.
  - Thư mục bảo mật: `private, no-store` đảm bảo tuyệt đối tính riêng tư.

---

## Milestone 3: Giao Diện Người Dùng Tối Giản (Minimal UI)
- [x] **M3.1**: Xây dựng UI HTML/CSS nhúng trực tiếp trong Worker (zero-dependency).
- [x] **M3.2**: Áp dụng Design Tokens chuẩn:
  - Accent Color: `#038fd2` (Ocean Blue).
  - Dark Mode: Background `#020617`, Card `#0f172a`, Text `#e2e8f0` dịu mắt.
  - Light Mode: Background `#f8fafc`.
- [x] **M3.3**: Form 1-click sinh link OPDS + nút Copy vào Clipboard + hướng dẫn 3 bước dán vào vBook.
- [x] **M3.4**: Tinh chỉnh Production: Loại bỏ Emoji, thay bằng vector icon Lucide SVG sắc nét, ẩn thanh cuộn xấu xí, hỗ trợ cuộn ngang mượt mà.

---

## Milestone 4: Kiểm Thử Thực Tế & Triển Khai (Verification & Cloudflare Deploy)
- [x] **M4.1**: Kiểm thử tích hợp trực tiếp trên ứng dụng vBook thật:
  - Test thêm tài khoản OPDS với URL sinh từ Gateway.
  - Test duyệt cây thư mục Google Drive (Folder lồng Folder).
  - Test tải sách .epub về vBook và mở đọc bình thường.
  - Test phân trang cuộn mượt mà.
  - Test xác thực Basic Auth (nhập sai pass $\rightarrow$ chặn 401, đúng pass $\rightarrow$ mở).
  - Test xử lý lỗi thư mục Drive chưa chia sẻ công khai (thông báo tiếng Việt thân thiện).
- [x] **M4.2**: Viết hướng dẫn cấu hình Cloudflare Worker + Cấu hình Custom Domain (DNS).
- [x] **M4.3**: Bộ kiểm thử tự động 5 scenarios đạt 100% qua `pnpm test`.
