# Đặc Tả Giao Diện Người Dùng (UI Specification)

## 1. Triết Lý Thiết Kế: "Tối Giản & Thực Dụng Tuyệt Đối"
- Giao diện web là công cụ 1 trang (Single-Page Utility).
- Không có các thành phần thừa (không banner, không footer rườm rà, không menu đa cấp).
- Thao tác gói gọn trong **3 bước / 1 màn hình duy nhất**:
  1. Dán Link Google Drive (hoặc Folder ID).
  2. [Tùy chọn] Nhập Tên đăng nhập & Mật khẩu (Basic Auth).
  3. Bấm **"Tạo URL OPDS"** $\rightarrow$ Nút 1-Click Copy hiện ra kèm hướng dẫn dán vào vBook.

---

## 2. Hệ Thống Màu Sắc & Biến CSS (Design Tokens)

Tuân thủ nghiêm ngặt bảng mã màu được chỉ định:

```css
:root {
  /* Light Theme */
  --bg: #f8fafc;
  --surface: #ffffff;
  --surface-glass: rgba(255, 255, 255, 0.7);
  --border: #e2e8f0;
  --text-main: #0f172a;
  --text-muted: #64748b;

  /* Primary Accent: Ocean Blue */
  --primary: #038fd2;
  --primary-hover: #0277b0;
  --primary-light: rgba(3, 143, 210, 0.12);
  --radius: 12px;
}

:root[data-theme="dark"] {
  /* Dark Theme */
  --bg: #020617;
  --surface: #0f172a;
  --surface-glass: rgba(15, 23, 42, 0.7);
  --border: #1e293b;
  --text-main: #e2e8f0;
  --text-muted: #94a3b8;

  /* Primary Accent: Ocean Blue */
  --primary: #038fd2;
  --primary-hover: #1ca5ec;
  --primary-light: rgba(3, 143, 210, 0.18);
}
```

---

## 3. Cấu Trúc Bố Cục Giao Diện (Wireframe)

```
+-------------------------------------------------------------------+
|  [Logo] VBook OPDS  [DRIVE TO OPDS]            [Toggle Dark/Light]|
+-------------------------------------------------------------------+
|                                                                   |
|   +-----------------------------------------------------------+   |
|   |  Đường link thư mục Google Drive                          |   |
|   |  [ https://drive.google.com/drive/folders/...           ] |   |
|   |                                                           |   |
|   |  [+] Tùy chọn bảo mật & API Key (Accordion)               |   |
|   |      [ Google Drive API Key (Tùy chọn) ]                  |   |
|   |      [ Tên (Tùy chọn) ]    [ Mật khẩu (Tùy chọn) ]        |   |
|   |                                                           |   |
|   |  [               TẠO ĐƯỜNG DẪN OPDS                      ] |   |
|   +-----------------------------------------------------------+   |
|                                                                   |
|   (Khi bấm Tạo đường dẫn):                                        |
|   +-----------------------------------------------------------+   |
|   |  URL DANH MỤC CHO VBOOK:                                  |   |
|   |  [ https://vbook-opds.domain.com/feed/folderId          ] |   |
|   |    (Hiển thị 1 dòng, ẩn thanh cuộn, chạm tự bôi đen)      |   |
|   |                                                           |   |
|   |  [                SAO CHÉP LIÊN KẾT                      ] |   |
|   |                                                           |   |
|   |  * Hướng dẫn 3 bước thêm vào ứng dụng vBook.              |   |
|   +-----------------------------------------------------------+   |
|                                                                   |
+-------------------------------------------------------------------+
```
