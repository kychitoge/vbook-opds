# Sổ Ghi Nhận Quyết Định Kiến Trúc (ADR - Architecture Decision Records)

Tài liệu này ghi chép các quyết định kiến trúc then chốt của dự án **vBook OPDS Gateway** theo quy chuẩn Enterprise & SemVer.

---

## [ADR-001] Chuẩn hóa Hợp đồng Giao tiếp vBook & Cắt bỏ Over-Engineering
- **Ngày**: 2026-09-09
- **Phiên bản**: v1.0.1
- **Bối cảnh**: 
  Mã nguồn ban đầu có hàm regex đoán mò tác giả `parseTitleAndAuthor` và sinh cover SVG giả `cover.ts`. Điều này làm sai lệch tên sách (cắt mất số tập/chương như `Harry Potter - Tap 1`), gán nhầm tác giả thành `Tap 1`, `Full`, và gây lỗi hiển thị thừa `[EPUB] [EPUB]` trên vBook.
- **Quyết định**: 
  - Xóa bỏ triệt để `parseTitleAndAuthor`, thay bằng `cleanBookTitle` chỉ gọt đuôi file (`.epub`, `.pdf`), bảo toàn 100% tên sách gốc từ Google Drive.
  - Xóa bỏ deadcode `cover.ts` và route `/cover/:fileId`.
- **Hệ quả**: 
  - Gọn nhẹ, tuân thủ nguyên tắc Dao cạo Ockham. Khớp 100% với cách hiển thị của vBook (thẻ `<title>` là tên hiển thị, badge download được tự động lấy từ MIME Type của acquisition link).

---

## [ADR-002] Cơ chế Xác thực Phi trạng thái (Stateless Basic Auth) Kế thừa Toàn vẹn
- **Ngày**: 2026-09-09
- **Phiên bản**: v1.0.1
- **Bối cảnh**: 
  Người dùng cần tạo feed có mật khẩu bảo vệ trực tiếp từ Web UI mà không muốn cấu hình biến môi trường trên Cloudflare Worker cho từng feed. Tuy nhiên, nếu chỉ truyền `?auth=` ở feed gốc mà không truyền xuống link con, các thư mục con và link download sẽ bị hở bảo mật (Auth Bypass).
- **Quyết định**: 
  - Duy trì cơ chế Stateless Auth: Web UI tạo token `?auth=base64(user:pass)`.
  - Người dùng điền User/Pass vào ứng dụng vBook, vBook tự động gửi header `Authorization: Basic base64(user:pass)`.
  - Gateway so khớp an toàn timing-safe (`constantTimeEqual`).
  - Tự động kế thừa `authParam` xuyên suốt toàn bộ liên kết con (`subFolderUrl`, `downloadUrl`, `nextUrl`, `searchUrl`) để bảo vệ 100% cây thư mục.
- **Hệ quả**: 
  - Người dùng không cần database, không cần đụng vào Cloudflare Worker Env.
  - Bảo vệ chặt chẽ toàn bộ các cấp thư mục con và file download.

---

## [ADR-003] Lộ Folder ID khi dùng Link Public và Lộ trình SemVer cho v1.1.0 (Private Drive)
- **Ngày**: 2026-09-09
- **Phiên bản**: v1.0.1 (Định hướng v1.1.0)
- **Bối cảnh**: 
  Ở phiên bản v1.0.1, Google Drive yêu cầu chia sẻ ở chế độ "Anyone with the link can view". Mặc dù feed OPDS đã được khóa bằng User/Pass, nhưng `folderId` thực tế vẫn hiển thị trên đường dẫn URL (`/feed/:folderId`). Nếu kẻ xấu có được `folderId`, họ có thể truy cập thẳng vào giao diện web Google Drive (`drive.google.com/drive/folders/:folderId`) để xem file mà không qua cổng bảo vệ của Gateway.
- **Quyết định**: 
  - **Phiên bản v1.0.1 (Hiện tại)**: Tối ưu độ ổn định, gọn nhẹ, đúng contract, vá dứt điểm các lỗi logic và bảo mật hiện hành. Chưa đưa cơ chế Service Account vào để tránh làm phình to kiến trúc.
  - **Phiên bản v1.1.0 (Tương lai)**: Sẽ xem xét hỗ trợ **100% Private Drive** (Drive hoàn toàn đóng với bên ngoài, không mở public link) nếu giải pháp đủ gọn nhẹ:
    1. Hỗ trợ Google Service Account (`credentials.json` hoặc private key).
    2. Che giấu / mã hóa `folderId` thành alias hoặc hash nội bộ.
    3. Endpoint `/download/:fileId` chuyển sang Proxy Stream có cache ngắn hạn thay vì 302 Redirect.
- **Hệ quả**: 
  - Giữ vững kỷ luật SemVer: Bản 1.0.1 tập trung vào patch và ổn định, bản 1.1.0 bổ sung tính năng nâng cao (Minor feature).

---

## [ADR-004] Bảo Toàn Phần Mở Rộng File Trong Thẻ <title> Cho vBook SVG Cover & Badge Contract
- **Ngày**: 2026-09-09
- **Phiên bản**: v1.0.2
- **Bối cảnh**: 
  Ở bản v1.0.1, hàm `cleanBookTitle` gọt bỏ phần mở rộng file (`.epub`, `.pdf`, `.cbz`) khỏi thẻ `<title>`. Tuy nhiên, qua phân tích cơ chế hiển thị của vBook Client, ứng dụng trích xuất định dạng sách trực tiếp từ chuỗi `<title>` (`title.substringAfterLast('.')`) để:
  1. Gán màu nền cho bìa sách SVG giả lập (PDF Đỏ, EPUB Xanh, CBZ Cam).
  2. In chữ huy hiệu to trên bìa sách (`EPUB`, `PDF`, `CBZ`).
  3. Hiển thị dòng phụ danh mục (`EPUB · 2.5 MB`).
  Khi bị gọt mất đuôi file, vBook mất khả năng nhận diện định dạng trên giao diện kệ sách, khiến bìa sách biến thành màu xám và mất nhãn format.
- **Quyết định**: 
  - Sửa hàm `cleanBookTitle` để giữ nguyên 100% tên file gốc kèm phần mở rộng (`.epub`, `.pdf`, `.cbz`...).
  - Bổ sung cơ chế cắt an toàn phòng vệ nếu tên file vượt quá 255 ký tự nhưng vẫn luôn bảo toàn phần mở rộng.
  - Không gọt ký tự rác bằng regex đoán mò.
- **Hệ quả**: 
  - Khớp 100% với hợp đồng hiển thị UI của vBook.
  - Bìa sách SVG trên vBook tự động nhận đúng màu sắc và in chữ định dạng chuẩn xác.

---

## [ADR-005] Cơ Chế Stateless URL Masking (AES-256-GCM) & Tạm Dừng OpenSearch
- **Ngày**: 2026-09-09
- **Phiên bản**: v1.1.0
- **Bối cảnh**: 
  1. Khi người dùng vô tình chia sẻ đường dẫn feed OPDS mà không đặt mật khẩu, chuỗi `folderId` thô trên URL có thể bị người khác copy để truy cập trực tiếp vào giao diện web Google Drive, làm lộ danh tính tài khoản Google (tên, avatar, email) và các file ngoài sách của chủ sở hữu.
  2. Ứng dụng vBook hiện tại chưa kích hoạt giao diện tìm kiếm OPDS (mã nguồn client đang comment tính năng này), dẫn đến nguy cơ các endpoint tìm kiếm mở bị spam query làm cạn kiệt hạn mức 100 requests/100s của Google API Key.
- **Quyết định**: 
  - Triển khai module `src/crypto.ts` sử dụng thuật toán mã hóa đối xứng **AES-256-GCM** ($0 database). Chuyển đổi toàn bộ `folderId` thành chuỗi an toàn tiền tố `m_` trên URL và mã hóa toàn bộ thư mục con trong XML feed.
  - Tích hợp tính năng chống giả mạo (Tamper-proof) qua Auth Tag.
  - Giữ nguyên 100% bố cục giao diện Web UI, tự động sinh link ẩn ID mặc định.
  - Tạm thời comment out các route OpenSearch `/opensearch.xml`, `/search` và thẻ `<link rel="search">` trong feed Atom.
- **Hệ quả**: 
  - Bảo vệ 100% quyền riêng tư và danh tính tài khoản Google của người dùng.
  - Triệt tiêu hoàn toàn bề mặt tấn công DoS/spam search qua Google API.
  - Duy trì chi phí hạ tầng $0 và trải nghiệm Zero-config cho người dùng.

---

## [ADR-006] Bãi Bỏ Đề Xuất Google Service Account & Bảo Vệ Triết Lý UX Số 1
- **Ngày**: 2026-09-10
- **Phiên bản**: v1.1.0+
- **Bối cảnh**: 
  Ý tưởng tích hợp Google Service Account để đọc Google Drive hoàn toàn đóng (100% Private, không cần bật public link) được cân nhắc cho Milestone 7. Tuy nhiên, việc áp dụng Service Account đòi hỏi người dùng phải thao tác 7 bước phức tạp trên Google Cloud Console (tạo IAM, tải key JSON, share folder). Đồng thời, Drive Private khiến Gateway không thể dùng cơ chế 302 Redirect sang Google CDN mà buộc phải proxy stream nội dung file qua Worker, làm cạn kiệt CPU Time và băng thông của Cloudflare Workers Free-Tier khi tải file sách lớn (EPUB/PDF/CBZ).
- **Quyết định**: 
  - Chính thức bãi bỏ (Won't Do) ý tưởng tích hợp Google Service Account.
  - Khẳng định giải pháp **Stateless URL Masking (AES-256-GCM)** tại bản v1.1.0 là giải pháp tối ưu toàn diện: Bảo vệ 100% danh tính tài khoản Google của người dùng mà chỉ đòi hỏi duy nhất 1 thao tác dán link đơn giản.
  - Tiếp tục tận dụng HTTP 302 Redirect trực tiếp đến Google CDN để duy trì tốc độ tải tức thì và chi phí hạ tầng $0.
- **Hệ quả**: 
  - Bảo toàn trải nghiệm người dùng tối giản (1-click generation).
  - Codebase không bị phình to (Zero over-engineering).
  - Không phát sinh nguy cơ nghẽn CPU và vượt hạn mức Cloudflare Workers.

---

## [ADR-007] vBook Native OpenSearch Direct URL Template & Chuẩn Hóa Ma Trận MIME Types
- **Ngày**: 2026-09-10
- **Phiên bản**: v1.2.0
- **Bối cảnh**: 
  1. Qua khảo sát giao thức kết nối của ứng dụng vBook, tính năng tìm kiếm OPDS được kích hoạt bằng cơ chế URL Template: vBook trích xuất trực tiếp thuộc tính `href` từ thẻ `<link rel="search">` trong feed Atom và thay thế token `{searchTerms}` bằng từ khóa tìm kiếm encode RFC-3986 thay vì qua file XML trung gian `opensearch.xml`.
  2. Phân tích ma trận định dạng vBook Client hỗ trợ cho thấy ứng dụng hỗ trợ một dải định dạng phong phú gồm Kindle (`.azw`, `.azw3`, `.prc`), tài liệu Office (`.docx`, `.doc`), kho nén (`.zip`), đồng thời parser vBook xử lý tối ưu với MIME type `application/vnd.comicbook-rar` cho `.cbr` và `application/x-fictionbook+xml` cho `.fb2`.
- **Quyết định**: 
  - **Native OpenSearch Contract**:
    - Nhúng trực tiếp thẻ `<link rel="search" href="/feed/{folderId}/search?q={searchTerms}" type="application/atom+xml;profile=opds-catalog" .../>` vào root feed Atom.
    - Kích hoạt endpoint `/feed/:folderId/search` hỗ trợ tìm kiếm cho cả Folder ID thô lẫn Folder ID ẩn danh `m_...` (AES-256-GCM) và bảo toàn tính toàn vẹn xác thực Basic Auth qua mọi cấp liên kết.
    - Tích hợp phân trang `rel="next"` cho kết quả tìm kiếm để kích hoạt cuộn vô tận (Infinite scroll) trên màn hình Search của vBook.
  - **Mở Rộng & Chuẩn Hóa Ma Trận MIME Types**:
    - Bổ sung nhận diện `.azw`, `.azw3`, `.prc`, `.docx`, `.doc`, `.zip`.
    - Chuẩn hóa lại MIME type của `.cbr` sang `application/vnd.comicbook-rar` và `.fb2` sang `application/x-fictionbook+xml`, `.fb2.zip` sang `application/x-zip-compressed-fb2` tương thích 100% với vBook Client.
- **Hệ quả**: 
  - vBook tự động nhận diện thanh tìm kiếm và thực thi tìm kiếm tức thì mà không gặp bất kỳ lỗi xung đột URL nào.
  - Mở rộng kho sách cá nhân của người dùng sang mọi định dạng ebook và tài liệu phổ biến mà vBook có thể đọc được.
  - Tiếp tục bảo vệ 100% danh tính và duy trì chi phí hạ tầng $0 trên Cloudflare Workers.

---

# [ADR-008] Tích Hợp OPDS 2.0 JSON Protocol (Content Negotiation) & Rich Metadata
- **Ngày**: 2026-09-10
- **Bối cảnh**: 
  - Qua phân tích giao thức mạng và header client vBook, ứng dụng gửi kèm header `Accept: application/atom+xml;profile=opds-catalog, application/opds+json, */*` và hỗ trợ chuẩn OPDS 2.0 (JSON) hoàn chỉnh.
  - Chuẩn OPDS 2.0 sử dụng cấu trúc JSON hiện đại với các khối `metadata`, `links`, `navigation` (thư mục con), và `publications` (sách), giúp giảm thiểu đáng kể kích thước gói tin so với Atom XML và tối ưu hóa thời gian phân tích cú pháp (parse time) trên các thiết bị máy đọc sách E-ink cấu hình thấp.
  - Đồng thời, trong chuẩn Atom OPDS 1.2, các thẻ rich metadata `<category term="..." label="..."/>` và fallback `<content>` cần được bổ sung để đảm bảo hiển thị định dạng và tương thích với toàn bộ hệ sinh thái trình đọc sách e-reader.
- **Quyết định**:
  - **Content Negotiation Thông Minh**:
    - Khi client gửi header `Accept` chứa `application/opds+json`, Gateway kích hoạt `buildOpds2Feed()` và trả về `Content-Type: application/opds+json; charset=utf-8`.
    - Mặc định hoặc khi `Accept` chứa `application/atom+xml`, Gateway tiếp tục phục vụ Atom XML OPDS 1.2 (tương thích ngược 100%).
  - **Khớp Cấu Trúc OPDS 2.0 với Schema vBook Client**:
    - `metadata`: `{ identifier, title, modified }`.
    - `links`: Các liên kết điều hướng cấp feed (`self`, `start`, `search` với template `{searchTerms}`, `next`).
    - `navigation`: Mảng thư mục con (`rel: ["subsection"]`), tự động áp dụng `subfolderIdMap` (AES-256-GCM) để che giấu ID thật của Google Drive và kế thừa token xác thực.
    - `publications`: Mảng danh mục sách với metadata bảo toàn tên file có đuôi, link acquisition mang MIME type chuẩn xác và ảnh bìa thumbnail (nếu có).
  - **Bổ Sung Rich Metadata cho OPDS 1.2**:
    - Thêm thẻ `<category term="..." label="..."/>` với nhãn định dạng (EPUB, PDF, CBZ...).
    - Thêm thẻ `<content type="text">` làm fallback cho trường hợp reader không hỗ trợ hiển thị summary.

---

## [ADR-009] Worker Server Hardening: Google Drive Large File Download Bypass & API Quota 429 Graceful Handling
- **Ngày**: 2026-09-10
- **Phiên bản**: v1.3.1
- **Bối cảnh**:
  1. Với các tệp sách có dung lượng lớn (> 25MB - 100MB như truyện tranh CBZ, tài liệu PDF scan), máy chủ Google Drive tự động chặn tải trực tiếp và trả về trang HTML cảnh báo virus quét (`virus scan warning`). Khi vBook tải đường dẫn `/download/:fileId`, ứng dụng nhận về file HTML rác thay vì tệp sách.
  2. Khi hạn mức Google API Key bị vượt (100 requests/100s) hoặc bị Google bóp băng thông, server trước đây trả về HTTP 500 chung chung khiến người dùng lầm tưởng worker bị lỗi hệ thống.
  3. Cân nhắc tính năng Uptime Monitoring: Cloudflare Workers là mạng lưới Serverless Edge phân tán toàn cầu, không có cơ chế sleep/cold start như Heroku/Render nên việc dựng cron monitoring là dư thừa, vi phạm nguyên tắc Dao cạo Ockham.
- **Quyết định**:
  - **Download Bypass Cảnh Báo File Lớn**: Thêm tham số `&confirm=t` vào URL redirect Google Drive Direct Download (`https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`). Đảm bảo vBook luôn tải thẳng tệp nhị phân gốc.
  - **Graceful Error Handling cho Quota 429**: Bắt các lỗi `429`, `rateLimitExceeded`, `quotaExceeded` từ Google API và trả về mã `HTTP 429 Too Many Requests` kèm header `Retry-After: 60` và thông báo hướng dẫn người dùng chờ 1-2 phút hoặc dùng API Key riêng.
  - **Xóa Bỏ Triệt Để Hardcoded Fallback Secret (CWE-798 Elimination)**: Loại bỏ hoàn toàn chuỗi fallback key mặc định trong `getMaskSecret`. Máy chủ bắt buộc phải có `MASK_SECRET` do admin cấu hình qua `wrangler secret put MASK_SECRET`; nếu thiếu, server từ chối xử lý và trả về HTTP 500 thông báo thiếu biến bảo mật thay vì dùng secret mặc định có thể bị dò quét.
  - **Bảo vệ Triết lý Dao cạo Ockham**: Bỏ qua các module monitoring uptime và CI/CD phức tạp không cần thiết cho Solo Dev.
- **Hệ quả**:
  - Tải mượt mà 100% các tệp truyện tranh CBZ và PDF dung lượng lớn trên vBook.
  - Thông báo lỗi rõ ràng, chuyên nghiệp cho người dùng khi Google API chạm hạn mức.
  - Triệt tiêu 100% lỗ hổng rò rỉ mã giải mã ID ẩn danh trên môi trường production.
  - Giữ vững kiến trúc gọn nhẹ, $0 chi phí hạ tầng.
