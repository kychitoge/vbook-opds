# BẢN ĐỒ BỐI CẢNH DỰ ÁN (PROJECT CONTEXT): vbook-opds-gateway

> **Dành cho AI Agent & Lập trình viên:** Đọc tệp này để có góc nhìn toàn cảnh (360-degree overview), nắm vững toàn bộ kiến trúc, hợp đồng giao tiếp, triết lý kỹ thuật và có thể lập tức bắt tay vào phát triển mà không cần đào bới lịch sử hội thoại.

---

## 1. MỤC TIÊU CỐT LÕI (THE NORTH STAR)
- **Tên dự án:** `vbook-opds-gateway`
- **Bản chất:** Một **Protocol Adapter / Gateway** trung gian chạy trên **Cloudflare Workers** ($0 chi phí máy chủ), biến bất kỳ thư mục sách nào trên Google Drive thành kho sách chuẩn **OPDS 1.2 (Atom XML)** và **OPDS 2.0 (JSON)** tương thích 100% với ứng dụng đọc sách **vBook** (Android & Máy đọc sách E-ink) cùng các ứng dụng đọc OPDS tiêu chuẩn khác (Moon+ Reader, KOReader).
- **Vấn đề giải quyết:** Không cần dựng máy chủ riêng (Calibre, Kavita, Audiobookshelf) cắm điện 24/7, không cần IP tĩnh, không tốn băng thông trung gian, tạo link 1-click dùng ngay.

---

## 2. NGUYÊN TẮC BẤT DI BẤT DỊCH (NON-NEGOTIABLE PRINCIPLES)

1. **Chi phí $0 Tuyệt đối ($0 Infra Stack)**:
   - Tận dụng tối đa Cloudflare Workers Free Tier (100.000 requests/ngày).
   - Tận dụng Google Drive API v3 Free Tier (20.000 requests / 100s).
   - Tuyệt đối không sử dụng cơ sở dữ liệu có phí hay máy chủ ngoài ($0 Database, $0 Redis). Mọi trạng thái xác thực và mã hóa đều là **Stateless**.
2. **Băng thông $0 (Zero-Bandwidth Proxy)**:
   - Gateway **chỉ xử lý metadata** (XML/JSON feed). Tuyệt đối **không proxy hay stream tệp nhị phân sách** qua Worker.
   - Khi người dùng tải sách, endpoint `/download/:fileId` chuyển hướng `HTTP 302 Found` trực tiếp sang Google CDN (`https://drive.google.com/uc?export=download...`).
3. **Bảo vệ Quyền riêng tư (Privacy-First)**:
   - Không làm lộ Google Folder ID cá nhân ra URL công khai. Áp dụng thuật toán **Stateless URL Masking (AES-256-GCM)** biến ID thành `m_...`.
   - Tuyệt đối không để lộ Google API Key trên client; hỗ trợ HTTP Basic Auth bảo vệ toàn diện cây thư mục.
4. **Quy chuẩn Open-Source Chuẩn Mực**:
   - Mọi commit, tài liệu, comment mã nguồn **tuyệt đối không sử dụng từ ngữ "dịch ngược / decompile / đục app"**. Thay vào đó, sử dụng thuật ngữ kỹ thuật chuẩn: **"Khảo sát giao thức mở / vBook Client Schema / Protocol Reverse-Compatibility Analysis"**.
5. **Dao cạo Ockham (Anti Over-Engineering)**:
   - Ưu tiên giải pháp gọn nhẹ nhất chạy được ngay. Không dựng thêm các module thừa thãi (Uptime monitoring, Microservices, Worker Cron không cần thiết).

---

## 3. TECH STACK & KIẾN TRÚC MÁY CHỦ

- **Runtime:** Cloudflare Workers (Edge Serverless V8 Isolate, `nodejs_compat`).
- **Framework:** [Hono](https://hono.dev/) v4 (siêu nhẹ, zero-overhead, chuẩn Web Standards `Request`/`Response`).
- **Language:** TypeScript 5 (Strict Mode).
- **Mã hóa:** Web Crypto API native (`crypto.subtle`: AES-256-GCM, PBKDF2, Timing-Safe Equality).
- **Kiểm thử:** `tsx` + Native Assertions (12 bộ kiểm thử độc lập, không phụ thuộc framework test cồng kềnh, chạy qua `pnpm test`).

---

## 4. HỢP ĐỒNG GIAO TIẾP VỚI vBOOK CLIENT (THE GOLDEN CONTRACT)

Mọi thay đổi trong mã nguồn **bắt buộc phải tuân thủ nghiêm ngặt 5 điều khoản hợp đồng** này để tránh làm hỏng giao diện vBook:

1. **Bảo Toàn Đuôi File Trong Thẻ `<title>` (SVG Cover & Format Badge)**:
   - vBook Client trích xuất định dạng sách trực tiếp từ chuỗi `<title>` (`title.substringAfterLast('.')`) để:
     + Tô màu bìa sách SVG giả lập: Đỏ cho `.pdf` (`#DE3737`), Xanh cho `.epub` (`#1E88E5`), Cam cho `.cbz` (`#FF9800`).
     + In huy hiệu định dạng to trên bìa sách (`EPUB`, `PDF`, `CBZ`).
   - ⚠️ **Nghiêm cấm gọt bỏ đuôi file trong `<title>`**. Tên sách trong thẻ `<title>` phải luôn giữ nguyên dạng `TenSach.epub`.
2. **Tải Sách File Lớn (Large File Download Bypass)**:
   - Google Drive tự động chặn tải trực tiếp và hiển thị trang cảnh báo quét virus đối với các file nặng (>25MB như PDF scan, truyện tranh CBZ).
   - Link chuyển hướng download `/download/:fileId` **luôn luôn phải có tham số `&confirm=t`** (`https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`) để vBook tải thẳng file nhị phân thay vì nhận về trang HTML cảnh báo của Google.
3. **Ma Trận MIME Types Chuẩn Hóa**:
   - `.cbr`: Phải là `application/vnd.comicbook-rar` (không gán nhầm sang `zip`).
   - `.fb2`: Phải là `application/x-fictionbook+xml`.
   - `.fb2.zip`: Phải là `application/x-zip-compressed-fb2`.
   - `.azw` / `.azw3`: `application/vnd.amazon.ebook` / `application/vnd.amazon.mobi8-ebook`.
4. **Native OpenSearch Template & Infinite Scroll**:
   - vBook bóc tách trực tiếp chuỗi URL template có chứa `{searchTerms}` từ thuộc tính `href` của thẻ `<link rel="search">` trong root feed.
   - **Cuộn vô tận (Infinite Scroll)**: vBook phụ thuộc vào **1 con trỏ `nextPageToken` duy nhất** trong `<link rel="next">`. Do đó, tìm kiếm Google Drive **bắt buộc phải thực thi trong 1 câu query duy nhất** để Google quản lý con trỏ phân trang (không chia chunk làm vỡ token).
5. **Dual Protocol (Content Negotiation)**:
   - Khi client gửi header `Accept: application/opds+json`, Gateway trả về JSON chuẩn OPDS 2.0 (`metadata`, `links`, `navigation`, `publications`).
   - Mặc định hoặc khi client yêu cầu XML, Gateway trả về Atom XML OPDS 1.2.

---

## 5. THUẬT TOÁN & BỘ NHỚ ĐỆM (SERVER CORE)

### A. Động Cơ Tìm Kiếm Sâu (Deep Search Engine - ADR-010 & ADR-011)
- **Bản chất cấu trúc**: Google Drive là **Cây đa phân (N-ary Tree)** bậc $N \ge 0$.
- **Thuật toán quét**: Sử dụng **BFS Level-Order Traversal** quét các thư mục con theo batching query (giới hạn 3 cấp, tối đa 35 folders, gom batch 35 folders/request để tối đa hóa I/O chỉ tốn đúng 3 requests API cho cả cây).
- **Kháng lỗi phân trang**: Vòng lặp `do...while (pageToken)` loại bỏ triệt để nguy cơ sót thư mục con khi một cấp có >100 folders.
- **Tree Memoization (TTL 300s / 5 phút)**: Lưu danh sách ID thư mục con vào Memory Cache + Cloudflare Edge Cache (`https://internal.cache/tree/${rootFolderId}`). Các lần tìm kiếm tiếp theo lấy danh sách folder trong **0ms** (0 Google API request).
- **Truy vấn hợp nhất**: Tìm kiếm được gộp vào 1 câu query Google duy nhất `< 2KB` (tránh lỗi `HTTP 414 URI Too Long`), bảo toàn 100% native `nextPageToken`.
- **Hạ cấp tự động (Graceful Fallback)**: Tự động lùi về Flat Search (Root) nếu quét Deep Search gặp lỗi mạng hoặc chạm Quota 429.

### B. Cloudflare Edge Cache Layer (`caches.default`)
- **Feed danh mục (`/feed/:folderId`)**: Cache biên **60 giây** (`s-maxage=60`).
- **Tìm kiếm (`/feed/:folderId/search`)**: Cache biên **300 giây** (`s-maxage=300`), đồng bộ hoàn hảo với Tree Memoization.
- **Phân tách định dạng**: Thêm query nội bộ `_fmt=json|xml` vào `cacheKey` để chống xung đột giữa OPDS 1.2 XML và OPDS 2.0 JSON.
- **Bảo mật tuyệt đối**: Toàn bộ request có Basic Auth hoặc tham số `?auth=` đều được gán `private, no-cache, no-store` và bỏ qua Edge Cache.

---

## 6. SƠ ĐỒ CẤU TRÚC MÃ NGUỒN (SOURCE MAP)

```
vbook-opds/
├── src/
│   ├── index.ts          # Entrypoint: Hono router, Content Negotiation, Edge Cache handler, routes (/feed, /search, /download, /api/mask)
│   ├── drive.ts          # Core Drive: Query Google API v3, Deep Search BFS, Tree Memoization (300s), MIME detector
│   ├── opds.ts           # OPDS 1.2 Engine: Atom XML Builder, OpenSearch Builder, cleanBookTitle bảo toàn đuôi
│   ├── opds2.ts          # OPDS 2.0 Engine: JSON Feed Builder (metadata, links, navigation, publications)
│   ├── crypto.ts         # Privacy Shield: Stateless URL Masking (AES-256-GCM + PBKDF2) biến ID thành m_...
│   ├── auth.ts           # Authentication: HTTP Basic Auth parser, constantTimeEqual chống Timing Attack
│   └── ui.ts             # Web Interface: Trang tạo link OPDS nhúng trực tiếp Worker (Ocean Blue, Zero-dependency)
├── test/
│   └── opds.test.ts      # 12 Test Suites kiểm thử tự động toàn diện (chạy qua `pnpm test`)
├── docs/
│   ├── vbook-contract.md # Đặc tả chi tiết hợp đồng giao thức vBook OPDS 1.2 & 2.0
│   ├── architecture.md   # Thiết kế kiến trúc $0 Cloudflare Workers
│   └── backlog.md        # Lịch sử hoàn thành từ Milestone 1 đến Milestone 11
├── .agents/
│   ├── decisions.md      # Sổ ghi nhận quyết định kiến trúc (ADR-001 đến ADR-010)
│   ├── handoff.md        # Biên bản bàn giao phiên làm việc hiện tại
│   └── context.md        # Tệp này (Bản đồ bối cảnh toàn diện cho Agent & Dev)
├── wrangler.toml         # Cấu hình Cloudflare Worker (nodejs_compat, variables)
└── package.json          # v1.4.0 (scripts: dev, test, build, precommit, deploy)
```

---

## 7. CẨM NANG LỆNH CHO LẬP TRÌNH VIÊN & AGENT (CHEATSHEET)

```bash
# 1. Chạy toàn bộ 12 test suites (Bắt buộc chạy trước khi commit)
pnpm test

# 2. Kiểm tra type check & build
pnpm run build

# 3. Chạy quy trình thẩm định 2 lớp (Build + Test)
pnpm run precommit

# 4. Chạy môi trường phát triển cục bộ
pnpm run dev

# 5. Triển khai lên Cloudflare Workers
pnpm run deploy

# 6. Cấu hình biến bí mật trên Cloudflare (Production)
npx wrangler secret put GOOGLE_API_KEY
npx wrangler secret put MASK_SECRET
```

---

> **Nguyên tắc hành xử của Agent khi nhận việc mới**: 
> Luôn luôn đọc tệp này và `.agents/decisions.md`. Tuyệt đối không thay đổi các quy tắc trong mục **4. Hợp Đồng Giao Tiếp Với vBook** mà không có sự đồng ý của Tech Lead. Mọi đoạn code sửa đổi đều phải vượt qua `pnpm run precommit` với 100% 12 test suites pass.
