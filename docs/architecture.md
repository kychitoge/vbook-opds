# Kiến Trúc Hệ Thống: VBook OPDS Gateway (Cloud-to-OPDS)

## 1. Bối Cảnh & Mục Tiêu

- **Vấn đề cốt lõi:** vBook hỗ trợ chuẩn OPDS để người dùng thêm kho tài nguyên sách cá nhân mà không phụ thuộc vào cơ chế backup dữ liệu. Tuy nhiên, người dùng phổ thông chỉ có link thư mục Google Drive (chứa file `.epub`, `.cbz`, `.pdf`), không có khả năng tự dựng và duy trì máy chủ Calibre/Kavita/Komga phức tạp.
- **Mục tiêu:** Xây dựng một **Protocol Adapter / Gateway** trung gian siêu nhẹ, chạy hoàn toàn trên Cloudflare Workers (chi phí hạ tầng $0):
  - Dịch danh mục file từ Google Drive sang định dạng Atom XML chuẩn OPDS 1.2 mà vBook hiểu được.
  - Phục vụ người dùng cá nhân và cộng đồng máy đọc sách E-ink (không có Google Play Services).
  - Không lưu trữ nội dung sách, không lưu index cơ sở dữ liệu nặng, miễn nhiễm bản quyền (DMCA-free) và hoàn toàn riêng tư.

---

## 2. Mô Hình Kiến Trúc Tổng Thể (System Architecture)

```
+------------------+         +-------------------------------+         +-----------------------+
|                  |  (1)    |   VBook OPDS Gateway          |  (2)    |                       |
|   vBook App      | ------->|   (Cloudflare Worker)         | ------->|   Google Drive API    |
| (Mobile / E-ink) |         |                               |         | (Folder & File Data)  |
|                  | <-------| - Parser & Atom XML Builder   | <-------|                       |
|                  |  (3)    | - Basic Auth Verifier         |         |                       |
+------------------+         | - 302 Redirect Handler        |         +-----------------------+
        |                    +-------------------------------+
        |                                   
        | (4) Direct Stream Download (HTTP 302 / Google Direct URL)
        +----------------------------------------------------------> Google Servers
```

### Luồng Vận Hành (Data Flow):
1. **Duyệt mục lục (Browse / Infinite Scroll):**
   - vBook gửi request `GET https://opds.domain.com/feed/:folderId?page=...` kèm theo Header `Accept: application/atom+xml` và `Authorization: Basic ...` (nếu có).
2. **Gateway xử lý:**
   - Gateway trích xuất `folderId` và xác thực HTTP Basic Auth (nếu user đặt mật khẩu).
   - Gateway truy vấn Google Drive API v3 (`files.list` với query `'<folderId>' in parents and trashed = false`).
   - Gateway chuyển đổi danh sách file thành cấu trúc XML Atom OPDS theo đúng Contract của vBook.
3. **vBook hiển thị:**
   - vBook nhận XML, bóc tách ra các thư mục con (Sub-catalog) và danh sách sách có đủ ảnh bìa (Cover), định dạng nhãn (`EPUB`, `CBZ`, `PDF`), tác giả, mô tả tóm tắt.
4. **Tải sách (Acquisition):**
   - Khi người dùng bấm Tải sách, vBook gọi `GET /download/:fileId`.
   - Gateway trả về mã `HTTP 302 Found` (Redirect) trỏ thẳng sang URL tải trực tiếp của Google (`https://drive.google.com/uc?export=download&id=:fileId`).
   - Băng thông tải sách đi trực tiếp giữa Google và thiết bị người dùng. Gateway tiêu tốn 0 MB băng thông lưu trữ.

---

## 3. Các Thành Phần Hệ Thống

| Thành phần | Công nghệ | Nhiệm vụ | Chi phí |
|---|---|---|---|
| **Edge Runtime** | Cloudflare Workers | Xử lý request, sinh feed XML, redirect tải sách | $0 (Free-tier: 100,000 req/ngày) |
| **Web Framework** | Hono (TypeScript) | Router siêu nhẹ (< 15KB), độ trễ < 10ms | $0 (Open Source) |
| **Giao diện Web** | HTML/CSS tĩnh tối giản (Embed trong Worker) | Nhận link Google Drive $\rightarrow$ Xuất URL OPDS kèm cấu hình Basic Auth | $0 (Không cần hosting ngoài) |
| **Data Provider** | Google Drive API v3 | Lấy danh sách file và metadata của thư mục | $0 (Hạn mức API miễn phí của Google) |
| **Xác thực** | HTTP Basic Auth (Stateless) | Mã hóa credentials trong token/query hoặc header để bảo vệ feed riêng tư | $0 |
