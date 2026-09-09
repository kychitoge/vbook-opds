# Đặc Tả Kỹ Thuật: Hợp Đồng Giao Tiếp OPDS với vBook (vBook OPDS Contract)

Tài liệu này được trích xuất trực tiếp từ mã nguồn decompile của ứng dụng vBook (`vBook.apk`, phân hệ `ik9.java`, `n68.java`, `dk9.java`, `ek9.java`, `fk9.java`, `r1g.java`, `uya.java`, `whg.java`).

---

## 1. Request Contract từ vBook

Khi người dùng mở một kệ sách OPDS trong vBook:
* **HTTP Method:** `GET`
* **HTTP Headers:**
  ```http
  Accept: application/atom+xml;profile=opds-catalog, application/opds+json, */*
  Authorization: Basic <base64(username:password)> (Chỉ gửi khi trường Tên trong vBook có độ dài > 0)
  ```
* **URL Resolution:** vBook tự động tính toán URL tương đối (`/feed?page=2`) dựa trên URL hiện tại nhờ hàm `d(href, baseUrl)` trong `ik9.java`.
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

vBook phân tích từng thẻ `<entry>` theo 2 kịch bản phân nhánh rõ rệt trong hàm `ik9.c`:

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
  - Giữ nguyên 100% tên sách gốc từ file Drive (chỉ gọt bỏ đuôi mở rộng `.epub`, `.pdf`), bảo toàn số tập/chương (ví dụ: `Harry Potter - Tập 1`).
  - Tuyệt đối không cố đoán tác giả bằng regex để tránh cắt xén làm hỏng tên sách.
* **MIME Types & Nhãn giao diện (Badge) trên vBook:**
  vBook tự động nhận diện huy hiệu định dạng hiển thị bên cạnh tên sách dựa trên **thuộc tính `type` của acquisition link** (không phụ thuộc vào tên file):
  - `application/epub+zip` $\rightarrow$ Nhãn: **`EPUB`**
  - `application/pdf` $\rightarrow$ Nhãn: **`PDF`**
  - `application/vnd.comicbook+zip` $\rightarrow$ Nhãn: **`CBZ`**
  - `application/x-mobipocket-ebook` $\rightarrow$ Nhãn: **`MOBI`**
* **Tác giả (Author):**
  - Trong chuẩn Atom OPDS và `r1g.java:L2470`, thẻ `<author>` là **Optional**. Nếu không có metadata chính xác từ file, bỏ qua thẻ này (vBook coi tác giả là `null` hợp lệ, không gây lỗi).
* **Ảnh bìa sách (Cover Image):**
  - Chỉ chèn thẻ `rel="http://opds-spec.org/image"` khi Google Drive thực sự có `thumbnailLink`. Nếu không có, vBook tự động hiển thị icon mặc định theo định dạng sách.
* **Tải sách (Acquisition Link):**
  - Trỏ về `/download/{fileId}`. Gateway trả về HTTP 302 chuyển hướng an toàn về máy chủ Google CDN, không làm lộ Google API Key.

```xml
<entry>
  <id>urn:vbook:book:{fileId}</id>
  <title>Dấu Ấn Rồng Thiêng - Tập 1</title>
  <updated>2026-09-09T00:00:00Z</updated>
  <summary>Dau An Rong Thieng - Tap 1.cbz</summary>
  
  <!-- Link tải sách (Acquisition) -->
  <link rel="http://opds-spec.org/acquisition" href="/download/{fileId}?auth={token}" type="application/vnd.comicbook+zip"/>
</entry>
```
