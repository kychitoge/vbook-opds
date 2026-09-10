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

## Milestone 7: Google Service Account & 100% Private Drive [ĐÃ HỦY BỎ - WON'T DO]
> **Quyết định ngày 2026-09-10 (Xem ADR-006)**: 
> Chính thức bãi bỏ Milestone 7 nhằm bảo vệ **Trải nghiệm người dùng (UX) tối thượng** và giữ vững **Chi phí hạ tầng $0**.
> - **Lý do UX**: Đòi hỏi người dùng trải qua 7 bước phức tạp trên Google Cloud Console (tạo IAM, tải key JSON, share folder).
> - **Lý do Kỹ thuật**: Private Drive buộc Worker phải proxy stream nội dung file thay vì 302 Redirect, làm cạn kiệt tài nguyên CPU/băng thông miễn phí của Cloudflare Worker khi tải sách dung lượng lớn.
> - **Thay thế**: Bản v1.1.0 với **Stateless URL Masking (AES-256-GCM)** đã bảo vệ 100% danh tính và thư mục con mà chỉ cần 1 thao tác dán link đơn giản.

---

## Milestone 8: Minor v1.2.0 (vBook Native OpenSearch Engine & Chuẩn Hóa MIME Types)
- [x] **M8.1**: **Kích hoạt vBook Search Contract**:
  - Nhúng trực tiếp URL template vào feed root: `<link rel="search" href="/feed/{folderId}/search?q={searchTerms}" type="application/atom+xml;profile=opds-catalog"/>`.
  - Endpoint `/feed/:folderId/search?q=...` hỗ trợ cả `folderId` thô và ID ẩn `m_...` (AES-GCM).
  - Tìm kiếm Google Drive API: `name contains '${q}'` và phân trang `rel="next"`.
- [x] **M8.2**: **Mở rộng & Khớp 100% MIME Type Matrix của vBook**:
  - Bổ sung định dạng Kindle: `.azw` (`application/vnd.amazon.ebook`), `.azw3` (`application/vnd.amazon.mobi8-ebook`), `.prc` (`application/x-mobipocket-ebook`).
  - Bổ sung định dạng tài liệu văn phòng: `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), `.doc` (`application/msword`).
  - Chuẩn hóa lại MIME Comic & FictionBook theo parser vBook:
    + `.cbr` $\rightarrow$ `application/vnd.comicbook-rar` (thay vì bị gán nhầm sang `comicbook+zip`).
    + `.fb2` $\rightarrow$ `application/x-fictionbook+xml`.
    + `.fb2.zip` $\rightarrow$ `application/x-zip-compressed-fb2`.
  - Hỗ trợ kho lưu trữ truyện nén `.zip` (`application/zip`).
- [x] **M8.3**: Nâng cấp bộ kiểm thử tự động lên 8 test suites đạt 100% qua `pnpm test` và `pnpm run build`.

---

## Milestone 9: Minor v1.3.0 (Rich Metadata & OPDS 2.0 JSON Content Negotiation - Full Contract Edition)
- [x] **M9.1**: **Metadata phong phú cho Entry (Atom OPDS 1.2)**:
  - Bổ sung thẻ `<category term="..." label="..."/>` hiển thị nhãn định dạng format trên vBook.
  - Thẻ dự phòng `<content type="text">` fallback cho các reader yêu cầu thẻ content.
- [x] **M9.2**: **Hỗ trợ OPDS 2.0 JSON (`application/opds+json`)**:
  - Cơ chế Content Negotiation: Khi client/vBook gửi header `Accept: application/opds+json`, Gateway trả về JSON chuẩn OPDS 2.0 (`Opds2Feed`: metadata, links, navigation, publications).
  - Khớp 100% đặc tả giao thức OPDS 2.0 theo vBook Client Schema.
  - Bảo vệ thư mục con bằng `subfolderIdMap` (AES-GCM masking) và bảo toàn tham số xác thực `authParam`.
  - Phản hồi siêu nhẹ, bỏ qua tầng serialize XML, tối ưu hoá TTFB trên Cloudflare Edge.
- [x] **M9.3**: Bộ kiểm thử tự động đạt 9/9 test suites (100% pass) và build sạch không cảnh báo.

---

## Milestone 10: Patch v1.3.1 (Worker Server Hardening & Large File Download Bypass)
- [x] **M10.1**: **Download Bypass Cảnh Báo Virus File Lớn (ADR-009)**:
  - Bổ sung tham số `&confirm=t` vào URL redirect Google Drive Direct Download (`https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`).
  - Triệt tiêu lỗi vBook tải về trang HTML cảnh báo của Google thay vì file sách đối với các file PDF/CBZ nặng (>25MB).
- [x] **M10.2**: **Xử Lý Quota Error 429 Graceful**:
  - Bắt các mã lỗi rate limit và quota cạn kiệt từ Google Drive API, phản hồi `HTTP 429 Too Many Requests` kèm `Retry-After: 60` và thông báo tiếng Việt rõ ràng.
- [x] **M10.3**: **Phòng vệ Truy cập Biến Môi trường Edge**:
  - Sử dụng optional chaining `c.env?.` trên toàn bộ luồng xử lý router để an toàn tuyệt đối trong môi trường test/mock và Cloudflare Worker runtime.
- [x] **M10.4**: Nâng cấp bộ kiểm thử tự động lên 10/10 test suites đạt 100% pass.

---

## Milestone 11: Minor v1.4.0 (Deep Search Engine & Cloudflare Edge Cache Layer)
- [x] **M11.1**: **Động cơ Tìm kiếm sâu (Deep Search Engine - ADR-010)**:
  - Thuật toán BFS Level-Order Traversal trên cây đa phân (N-ary Tree) quét các thư mục con theo batch.
  - Tích hợp bộ đệm **Tree Memoization (TTL 300s / 5 phút)**: Trả về folder tree ngay lập tức (0ms), tối đa 35 folders để query luôn `< 2KB`.
  - Tối ưu hóa `searchDriveFolder` và `buildSearchQuery` trong **1 câu query Google duy nhất**, bảo toàn 100% native `nextPageToken` cho vBook Infinite Scroll.
  - Kiểm tra rỗng `searchTerm` chuyển hướng 302 ngay lập tức, tiết kiệm 100% subrequest Google API.
- [x] **M11.2**: **Cloudflare Edge Cache Layer (`caches.default`)**:
  - Tích hợp bộ nhớ đệm Edge Cache native:
    + Cache feed danh mục `/feed/:folderId`: **60 giây** (`public, max-age=60, s-maxage=60`).
    + Cache kết quả tìm kiếm `/feed/:folderId/search`: **300 giây** (`public, max-age=300, s-maxage=300`).
  - Phân tách định dạng an toàn XML/JSON qua query `_fmt`, header `Vary: Accept` và `X-Gateway-Cache: HIT/MISS`.
  - Bảo vệ quyền riêng tư: Bỏ qua hoàn toàn Edge Cache (`private, no-cache, no-store`) khi request có xác thực Basic Auth.
- [x] **M11.3**: Nâng cấp bộ kiểm thử tự động lên 12/12 test suites đạt 100% pass.

---

> **TRẠNG THÁI HIỆN TẠI (v1.4.0)**: Đạt chuẩn **100% Full Contract Compliance & Deep Search + Edge Cached**!


