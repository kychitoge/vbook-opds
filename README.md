# VBook OPDS Gateway (Cloudflare Worker) - v1.0.2

> **Cổng chuyển đổi giao thức (Protocol Adapter)** biến thư mục Google Drive thành kho sách điện tử chuẩn OPDS 1.2 dành riêng cho ứng dụng **vBook** và các ứng dụng đọc OPDS tiêu chuẩn (Moon+ Reader, KOReader).

- **Chi phí hạ tầng:** **$0** (chạy trên Cloudflare Workers Free Tier).
- **Băng thông:** **$0** (Sách được chuyển hướng tải trực tiếp từ máy chủ Google CDN, không lưu trữ qua Cloudflare).
- **Bảo mật & DMCA-free:** Không lưu trữ nội dung, không có database, hỗ trợ HTTP Basic Auth bảo vệ toàn diện cây thư mục cá nhân.
- **Hỗ trợ thiết bị:** Hoạt động hoàn hảo trên điện thoại Android và các dòng **máy đọc sách E-ink** (Onyx Boox, Likebook, Kobo, Kindle jailbreak) không có Google Play Services.
- **Tương thích Contract vBook:** Bảo toàn đuôi file trong tên sách để kích hoạt bộ sinh bìa SVG tô màu theo định dạng và hiển thị badge format chuẩn xác trên kệ vBook.

---

## 🚀 Hướng Dẫn Nhanh

### 1. Cài đặt & Chạy Thử Cục Bộ
```bash
# Cài đặt dependencies
pnpm install

# Chạy kiểm thử tự động (6 test suites)
pnpm test

# Chạy server thử nghiệm
pnpm dev
```
Mở trình duyệt tại `http://localhost:8787` để trải nghiệm giao diện.

---

### 2. Triển Khai Lên Cloudflare Workers (Miễn phí 100%)

#### Bước 1: Đăng nhập Cloudflare từ Terminal
```bash
npx wrangler login
```

#### Bước 2: [Khuyên dùng] Cấu hình Google Drive API Key mặc định
Lấy một Google API Key miễn phí từ [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Bật thư viện *Google Drive API*):
```bash
npx wrangler secret put GOOGLE_API_KEY
# Dán API Key của bạn vào terminal
```
*(Nếu không cấu hình, người dùng vẫn có thể tự điền API Key cá nhân trên giao diện web).*

#### Bước 3: Deploy
```bash
pnpm run predeploy && pnpm deploy
```
Wrangler sẽ trả về đường dẫn URL dạng: `https://vbook-opds.<your-subdomain>.workers.dev`.

---

### 3. Trỏ Domain Riêng (Custom Domain) trên Cloudflare
1. Đăng nhập vào Dashboard Cloudflare &rarr; Chọn Domain của bạn.
2. Vào mục **Workers Routes** (hoặc trong phần Cài đặt Worker &rarr; **Triggers** &rarr; **Custom Domains**).
3. Thêm domain mong muốn (ví dụ: `opds.yourdomain.com`). Cloudflare sẽ tự động kích hoạt chứng chỉ SSL/HTTPS trong 30 giây.

---

## 📱 Hướng Dẫn Thêm Vào Ứng Dụng vBook

1. Mở trang Web Gateway vừa deploy &rarr; Dán đường link thư mục Google Drive của bạn (ví dụ: `https://drive.google.com/drive/folders/...`).
2. (Tùy chọn) Điền Tên và Mật khẩu nếu muốn đặt mật khẩu riêng cho kho sách.
3. Bấm **TẠO ĐƯỜNG DẪN OPDS** &rarr; Bấm **Sao Chép**.
4. Mở ứng dụng **vBook**:
   - Vào mục **Kho lưu trữ** (Cloud) &rarr; Chọn **OPDS**.
   - Dán URL vừa sao chép vào ô **URL danh mục**.
   - Điền Tên & Mật khẩu (nếu có thiết lập ở bước 2).
   - Bấm **Lưu**.
5. Toàn bộ sách (`.epub`, `.cbz`, `.pdf`, `.mobi`, `.cbr`, `.fb2`, `.txt`) và các thư mục con trong Google Drive sẽ hiện lên kệ sách vBook như một thư viện chuyên nghiệp!

---

## 📂 Cấu Trúc Mã Nguồn

```
vbook-opds/
├── docs/                      # Tài liệu kỹ thuật chi tiết
│   ├── architecture.md        # Kiến trúc tổng thể & luồng $0 băng thông
│   ├── vbook-contract.md      # Đặc tả Contract OPDS XML của vBook
│   ├── ui-spec.md             # Đặc tả UI tối giản & Design Tokens
│   └── backlog.md             # Kế hoạch công việc & Lộ trình SemVer
├── .agents/
│   └── decisions.md           # Sổ ghi nhận quyết định kiến trúc (ADR)
├── src/
│   ├── index.ts               # Router Hono chính & middleware xác thực
│   ├── drive.ts               # Xử lý Google Drive API v3 & tìm kiếm sách
│   ├── opds.ts                # Sinh XML Atom OPDS 1.2 & OpenSearch Description
│   ├── auth.ts                # Xác thực HTTP Basic Auth (Timing-safe)
│   └── ui.ts                  # Giao diện Web tối giản nhúng Worker
├── test/
│   └── opds.test.ts           # Bộ 6 kiểm thử tự động toàn diện
├── package.json               # v1.0.2
├── tsconfig.json
├── wrangler.toml              # Cấu hình Cloudflare Workers
└── LICENSE                    # Giấy phép MIT
```
