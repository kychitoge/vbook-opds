# Đặc Tả Kỹ Thuật: Hợp Đồng Giao Tiếp OPDS với vBook (vBook OPDS Contract)

Tài liệu này được trích xuất trực tiếp từ mã nguồn decompile của ứng dụng vBook (`vBook.apk`, phân hệ `ik9.java`, `n68.java`, `dk9.java`, `ek9.java`, `fk9.java`).

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

---

## 2. Feed-Level Contract (Atom XML Root)

Phản hồi từ Gateway bắt buộc phải là XML Atom với root element `<feed>`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:vbook:feed:{folderId}</id>
  <title>Kho Sách Của Bạn</title>
  <updated>2026-09-08T00:00:00Z</updated>

  <!-- Link tự tham chiếu -->
  <link rel="self" href="{currentUrl}" type="application/atom+xml;profile=opds-catalog"/>
  <link rel="start" href="{rootUrl}" type="application/atom+xml;profile=opds-catalog"/>

  <!-- Phân trang (Pagination) - vBook tìm kiếm rel="next" để kích hoạt cuộn vô tận (Infinite Scroll) -->
  <link rel="next" href="{nextPageUrl}" type="application/atom+xml;profile=opds-catalog"/>

  <!-- [Tùy chọn] Ô tìm kiếm sách trong vBook -->
  <!-- <link rel="search" href="{searchUrl}" type="application/opensearchdescription+xml"/> -->

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
* Khi người dùng nhấp vào, vBook sẽ điều hướng đệ quy vào URL được chỉ định trong `href`.

```xml
<entry>
  <title>Tên Thư Mục Con (Ví dụ: Thể loại Tiên Hiệp)</title>
  <id>urn:vbook:folder:{subFolderId}</id>
  <updated>2026-09-08T00:00:00Z</updated>
  <summary>Thư mục chứa 50 cuốn sách</summary>
  <!-- Link chuyển tiếp vào danh mục con -->
  <link rel="subsection" type="application/atom+xml;profile=opds-catalog" href="/feed/{subFolderId}"/>
</entry>
```

### Kịch bản 2: Tệp Sách (Book / Acquisition Entry)
Được kích hoạt khi `<entry>` chứa ít nhất 1 link có thuộc tính `rel` bắt đầu bằng `"http://opds-spec.org/acquisition"`:
* **MIME Types & Nhãn giao diện (Badge) trên vBook:**
  - `application/epub+zip` $\rightarrow$ Nhãn: **`EPUB`**, file tải về lưu đuôi `.epub`
  - `application/pdf` $\rightarrow$ Nhãn: **`PDF`**, file tải về lưu đuôi `.pdf`
  - `application/vnd.comicbook+zip` $\rightarrow$ Nhãn: **`CBZ`**, file tải về lưu đuôi `.cbz`
  - `application/x-mobipocket-ebook` $\rightarrow$ Nhãn: **`MOBI`**, file tải về lưu đuôi `.mobi`
* **Ảnh bìa sách (Cover Image):**
  - Ưu tiên 1: Link có `rel="http://opds-spec.org/image"`
  - Ưu tiên 2 (Fallback): Link có `rel="http://opds-spec.org/image/thumbnail"`
* **Tác giả (Author):**
  - Thẻ `<author><name>...</name></author>`. Nếu có nhiều tác giả, vBook tự động nối bằng `", "`.
* **Mô tả sách:**
  - Lấy từ `<summary>` hoặc `<content>`.

```xml
<entry>
  <title>Tên Cuốn Sách</title>
  <id>urn:vbook:book:{fileId}</id>
  <updated>2026-09-08T00:00:00Z</updated>
  <author>
    <name>Tên Tác Giả</name>
  </author>
  <summary>Mô tả tóm tắt nội dung cuốn sách...</summary>
  
  <!-- Ảnh bìa sách -->
  <link rel="http://opds-spec.org/image" href="{coverUrl}" type="image/jpeg"/>
  <link rel="http://opds-spec.org/image/thumbnail" href="{thumbnailUrl}" type="image/jpeg"/>
  
  <!-- Tải sách (Acquisition) -->
  <link rel="http://opds-spec.org/acquisition" href="/download/{fileId}" type="application/epub+zip"/>
</entry>
```
