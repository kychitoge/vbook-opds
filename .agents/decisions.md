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
