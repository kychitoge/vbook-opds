# VBook OPDS Gateway (Cloudflare Worker) - v1.4.0

> **Cổng chuyển đổi giao thức (Protocol Adapter / Gateway)** biến thư mục Google Drive thành kho sách điện tử chuẩn **OPDS 1.2 (Atom XML)** và **OPDS 2.0 (JSON)** tối ưu riêng cho ứng dụng **vBook** và các ứng dụng đọc OPDS tiêu chuẩn (Moon+ Reader, KOReader).

- **Chi phí hạ tầng:** **$0** (tối ưu hóa chạy trên Cloudflare Workers Free Tier).
- **Băng thông:** **$0** (Sách được chuyển hướng trực tiếp HTTP 302 sang máy chủ Google CDN, kèm cờ `confirm=t` bypass cảnh báo virus scan cho file nặng >25MB).
- **Bảo mật & Quyền riêng tư (Privacy Shield):** Tự động mã hóa Folder ID thành chuỗi vô danh `m_...` (AES-256-GCM + PBKDF2), hỗ trợ HTTP Basic Auth bảo vệ toàn diện cây thư mục cá nhân.
- **Dual Protocol (OPDS 1.2 & OPDS 2.0):** Tự động chuyển đổi mượt mà giữa Atom XML và JSON (`application/opds+json`) thông qua cơ chế Content Negotiation (`Accept` header).
- **Động cơ Tìm kiếm Sâu (Deep Search Engine):** Thuật toán BFS Level-Order Traversal trên cây đa phân (N-ary Tree) quét các thư mục con theo batch, tích hợp bộ đệm **Tree Memoization (TTL 300s)** và bảo toàn 100% con trỏ `nextPageToken` cho tính năng cuộn vô tận (Infinite Scroll) trên vBook.
- **Cloudflare Edge Cache Layer:** Tự động lưu bộ nhớ đệm tại biên (60s cho feed mục lục, 300s cho tìm kiếm), giảm 85-90% quota Google API, phản hồi siêu tốc (<30ms khi HIT).
- **Tương thích vBook Client Schema:** Bảo toàn 100% phần mở rộng trong `<title>` giúp vBook tô màu bìa sách SVG giả lập và in huy hiệu format to trên kệ sách; hỗ trợ đầy đủ ma trận định dạng (EPUB, PDF, CBZ, CBR, MOBI, AZW, AZW3, FB2, DOCX, ZIP, TXT).

---

## 🚀 Hướng Dẫn Nhanh

### 1. Cài đặt & Chạy Thử Cục Bộ
```bash
# Cài đặt dependencies
pnpm install

# Chạy kiểm thử tự động toàn diện (12 test suites)
pnpm test

# Chạy server thử nghiệm cục bộ
pnpm dev
```
Mở trình duyệt tại `http://localhost:8787` để trải nghiệm giao diện.

---

### 2. Triển Khai Lên Cloudflare Workers (Miễn phí 100%)

#### Bước 1: Đăng nhập Cloudflare từ Terminal
```bash
npx wrangler login
```

#### Bước 2: Cấu hình Secrets cho Worker (Bắt buộc cho Production)
1. Cấu hình Google Drive API Key:
```bash
npx wrangler secret put GOOGLE_API_KEY
# Dán API Key lấy từ Google Cloud Console
```
2. Cấu hình Khóa bảo mật URL Masking (AES-256-GCM):
```bash
npx wrangler secret put MASK_SECRET
# Dán một chuỗi ký tự bí mật dài ngẫu nhiên
```

#### Bước 3: Deploy
```bash
pnpm run predeploy && pnpm deploy
```
Wrangler sẽ trả về đường dẫn URL dạng: `https://vbook-opds.<your-subdomain>.workers.dev`.

---

### 3. Trỏ Domain Riêng (Custom Domain) trên Cloudflare
1. Đăng nhập vào Dashboard Cloudflare &rarr; Chọn Domain của bạn.
2. Vào mục **Workers Routes** (hoặc Cài đặt Worker &rarr; **Triggers** &rarr; **Custom Domains**).
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
5. Toàn bộ sách và các thư mục con trong Google Drive sẽ hiện lên kệ sách vBook như một thư viện chuyên nghiệp!

---

## 📂 Cấu Trúc Mã Nguồn

```
vbook-opds/
├── docs/                      # Tài liệu kỹ thuật chi tiết
│   ├── architecture.md        # Thiết kế kiến trúc tổng thể & luồng $0 băng thông
│   ├── vbook-contract.md      # Đặc tả Contract OPDS XML & OPDS 2.0 JSON của vBook
│   ├── ui-spec.md             # Đặc tả UI tối giản & Design Tokens
│   └── backlog.md             # Kế hoạch công việc & Lộ trình SemVer qua các Milestone
├── .agents/
│   ├── decisions.md           # Sổ ghi nhận quyết định kiến trúc (ADR-001 đến ADR-010)
│   └── handoff.md             # Tài liệu bàn giao trạng thái hệ thống
├── src/
│   ├── index.ts               # Hono router chính, Content Negotiation & Edge Cache
│   ├── crypto.ts              # Stateless URL Masking (AES-256-GCM + PBKDF2)
│   ├── drive.ts               # Xử lý Google Drive API v3, Deep Search BFS & Tree Memoization
│   ├── opds.ts                # Sinh feed Atom XML OPDS 1.2 & OpenSearch
│   ├── opds2.ts               # Sinh feed JSON OPDS 2.0 (chuẩn vBook Client Schema)
│   ├── auth.ts                # Xác thực HTTP Basic Auth (Timing-safe)
│   └── ui.ts                  # Giao diện Web tối giản nhúng trực tiếp Worker
├── test/
│   └── opds.test.ts           # Bộ 12 kiểm thử tự động toàn diện (100% pass)
├── package.json               # v1.4.0
├── tsconfig.json
├── wrangler.toml              # Cấu hình Cloudflare Workers
└── LICENSE                    # Giấy phép MIT
```
