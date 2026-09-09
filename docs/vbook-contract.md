# Đặc Tả Kỹ Thuật: Hợp Đồng Giao Tiếp OPDS với vBook (vBook OPDS Contract)

Tài liệu này quy định chi tiết cấu trúc dữ liệu và giao thức Atom XML chuẩn OPDS 1.2 nhằm đảm bảo khả năng tương thích 100% với ứng dụng **vBook** và các ứng dụng đọc OPDS tiêu chuẩn.

---

## 1. Request Contract từ vBook

Khi người dùng mở một kệ sách OPDS trong vBook:
* **HTTP Method:** `GET`
* **HTTP Headers:**
  ```http
  Accept: application/atom+xml;profile=opds-catalog, application/opds+json, */*
  Authorization: Basic <base64(username:password)> (Chỉ gửi khi trường Tên trong vBook có độ dài > 0)
  ```
* **URL Resolution:** vBook tự động tính toán URL tương đối (`/feed?page=2`) dựa trên URL hiện tại của danh mục.
* **Xác thực Basic Auth:** Khi người dùng nhập Tên và Mật khẩu trong vBook, ứng dụng tự động gửi kèm header `Authorization: Basic` cho toàn bộ các request (duyệt mục lục, duyệt thư mục con, tải sách).

---

## 2. Feed-Level Contract (Atom XML Root)

Phản hồi từ Gateway bắt buộc phải là XML Atom với root element `<feed>`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:vbook:feed:{folderId}</id>
  <title>Kho Sách Của Bạn</title>
  <updated>2026-09-09T00:00:00Z</updated>

  <!-- Link tự tham chiếu và link bắt đầu -->
  <link rel="self" href="{currentUrl}" type="application/atom+xml;profile=opds-catalog"/>
  <link rel="start" href="{rootUrl}" type="application/atom+xml;profile=opds-catalog"/>

  <!-- Phân trang (Pagination): vBook tìm kiếm rel="next" để kích hoạt cuộn vô tận (Infinite Scroll) -->
  <link rel="next" href="{nextPageUrl}" type="application/atom+xml;profile=opds-catalog"/>

  <!-- OpenSearch 1.1 Descriptor: Chuẩn bị sẵn cho các phiên bản vBook tương lai và hỗ trợ Moon+ Reader/KOReader -->
  <link rel="search" href="{searchUrl}" type="application/opensearchdescription+xml" title="Tìm kiếm sách"/>

  <!-- Danh sách các Entry (Thư mục con hoặc Sách) -->
  ...
</feed>
```

---

## 3. Entry-Level Contract

vBook phân tích từng thẻ `<entry>` theo 2 kịch bản phân nhánh rõ rệt:

### Kịch bản 1: Thư Mục Con (Sub-Catalog / Navigation Entry)
Được kích hoạt khi `<entry>` **không chứa bất kỳ acquisition link nào** và chứa link có type `application/atom+xml`:
* vBook đánh dấu thuộc tính `isFolder = true` và hiển thị icon thư mục.
* Khi người dùng nhấp vào, vBook điều hướng vào URL được chỉ định trong `href`.
* Nếu feed gốc có cài đặt mật khẩu, Gateway tự động kế thừa `authParam` vào `href` để bảo vệ toàn diện thư mục con.

```xml
<entry>
  <id>urn:vbook:folder:{subFolderId}</id>
  <title>Tên Thư Mục Con (Ví dụ: Tiên Hiệp)</title>
  <updated>2026-09-09T00:00:00Z</updated>
  <summary>Thư mục: Tiên Hiệp</summary>
  <!-- Link chuyển tiếp vào danh mục con -->
  <link rel="subsection" type="application/atom+xml;profile=opds-catalog" href="/feed/{subFolderId}?auth={token}"/>
</entry>
```

### Kịch bản 2: Tệp Sách (Book / Acquisition Entry)
Được kích hoạt khi `<entry>` chứa ít nhất 1 link có thuộc tính `rel` là `"http://opds-spec.org/acquisition"`:
* **Tiêu đề sách (`<title>`):**
  - **Bắt buộc giữ nguyên 100% tên file gốc kèm phần mở rộng** (ví dụ: `Dấu Ấn Rồng Thiêng - Tập 1.cbz`).
  - *Cơ chế hiển thị trên vBook Client*: Khi vẽ bìa sách SVG giả lập (nếu không có thumbnail) và hiển thị dòng phụ (subtitle), vBook tự động bóc tách phần mở rộng từ chuỗi `<title>`:
    + Đuôi `.pdf` $\rightarrow$ Nền bìa màu Đỏ (`#DE3737`), in chữ `PDF`.
    + Đuôi `.epub`, `.mobi`, `.fb2` $\rightarrow$ Nền bìa màu Xanh (`#1E88E5`), in chữ `EPUB`.
    + Đuôi `.cbz`, `.cbr`, `.zip` $\rightarrow$ Nền bìa màu Cam (`#FF9800`), in chữ `CBZ`.
    + Subtitle hiển thị định dạng và kích thước (ví dụ: `EPUB · 2.5 MB`).
    + ⚠️ Nếu gọt bỏ đuôi file trong `<title>`, vBook sẽ không nhận diện được định dạng trên kệ sách, khiến bìa sách biến thành màu xám mặc định và mất huy hiệu format!
  - Tuyệt đối không cố đoán tác giả bằng regex để tránh cắt xén làm hỏng tên sách.
* **MIME Types & Nhãn tải sách (Download Badge) trên vBook:**
  Trong giao diện chọn tải sách, vBook tự động nhận diện huy hiệu định dạng dựa trên **thuộc tính `type` của acquisition link**:
  - `application/epub+zip` $\rightarrow$ Nhãn: **`EPUB`**
  - `application/pdf` $\rightarrow$ Nhãn: **`PDF`**
  - `application/vnd.comicbook+zip` $\rightarrow$ Nhãn: **`CBZ`**
  - `application/x-mobipocket-ebook` $\rightarrow$ Nhãn: **`MOBI`**
* **Tác giả (Author):**
  - Trong chuẩn Atom OPDS, thẻ `<author>` là **Optional**. Nếu không có metadata chính xác từ file, bỏ qua thẻ này (vBook coi tác giả là `null` hợp lệ, không gây lỗi).
* **Ảnh bìa sách (Cover Image):**
  - Chỉ chèn thẻ `rel="http://opds-spec.org/image"` khi Google Drive thực sự có `thumbnailLink`. Nếu không có, vBook tự động vẽ bìa SVG tô màu theo định dạng sách như mô tả ở trên.
* **Tải sách (Acquisition Link):**
  - Trỏ về `/download/{fileId}`. Gateway trả về HTTP 302 chuyển hướng an toàn về máy chủ Google CDN, không làm lộ Google API Key.

```xml
<entry>
  <id>urn:vbook:book:{fileId}</id>
  <title>Dấu Ấn Rồng Thiêng - Tập 1.cbz</title>
  <updated>2026-09-09T00:00:00Z</updated>
  <summary>Dau An Rong Thieng - Tap 1.cbz</summary>
  
  <!-- Link tải sách (Acquisition) -->
  <link rel="http://opds-spec.org/acquisition" href="/download/{fileId}?auth={token}" type="application/vnd.comicbook+zip"/>
</entry>
```
