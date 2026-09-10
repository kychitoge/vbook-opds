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

  <!-- vBook Native OpenSearch: Nhúng trực tiếp URL Template chứa {searchTerms} -->
  <link rel="search" href="{searchUrlTemplate}" type="application/atom+xml;profile=opds-catalog" title="Tìm kiếm sách"/>

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
* **Bảo vệ danh tính (từ v1.1.0):** `subFolderId` trong đường dẫn `href` được Gateway tự động mã hóa thành `m_...` (AES-256-GCM) để người dùng khi duyệt vào thư mục con không bị lộ `folderId` gốc của Google Drive.
* Nếu feed gốc có cài đặt mật khẩu, Gateway tự động kế thừa `authParam` vào `href` để bảo vệ toàn diện thư mục con.

```xml
<entry>
  <id>urn:vbook:folder:{subFolderId}</id>
  <title>Tên Thư Mục Con (Ví dụ: Tiên Hiệp)</title>
  <updated>2026-09-09T00:00:00Z</updated>
  <summary>Thư mục: Tiên Hiệp</summary>
  <!-- Link chuyển tiếp vào danh mục con (đã mã hóa ID m_... và kế thừa auth) -->
  <link rel="subsection" type="application/atom+xml;profile=opds-catalog" href="/feed/m_{maskedSubFolderId}?auth={token}"/>
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
  Trong giao diện chọn tải sách, vBook tự động nhận diện huy hiệu định dạng dựa trên **thuộc tính `type` của acquisition link** (khớp chính xác theo bytecode `tk9.java`):
  - `application/epub+zip` $\rightarrow$ Nhãn: **`EPUB`**
  - `application/pdf` $\rightarrow$ Nhãn: **`PDF`**
  - `application/vnd.comicbook+zip` $\rightarrow$ Nhãn: **`CBZ`**
  - `application/vnd.comicbook-rar` $\rightarrow$ Nhãn: **`CBR`**
  - `application/x-mobipocket-ebook` $\rightarrow$ Nhãn: **`MOBI`** (hoặc `.prc`)
  - `application/vnd.amazon.ebook` $\rightarrow$ Nhãn: **`AZW`**
  - `application/vnd.amazon.mobi8-ebook` $\rightarrow$ Nhãn: **`AZW3`**
  - `application/x-fictionbook+xml` $\rightarrow$ Nhãn: **`FB2`**
  - `application/x-zip-compressed-fb2` $\rightarrow$ Nhãn: **`FB2`** (sách nén `fb2.zip`)
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` $\rightarrow$ Nhãn: **`DOCX`**
  - `application/msword` $\rightarrow$ Nhãn: **`DOC`**
  - `application/zip` $\rightarrow$ Nhãn: **`ZIP`**
  - `text/plain` $\rightarrow$ Nhãn: **`TXT`**
* **Tác giả (Author):**
  - Trong chuẩn Atom OPDS, thẻ `<author>` là **Optional**. Nếu không có metadata chính xác từ file, bỏ qua thẻ này (vBook coi tác giả là `null` hợp lệ, không gây lỗi). Nếu có nhiều tác giả, vBook tự động ghép bằng dấu phẩy `, `.
* **Ảnh bìa sách (Cover Image):**
  - vBook tìm thẻ link có `rel="http://opds-spec.org/image"` hoặc `rel="http://opds-spec.org/image/thumbnail"`. Nếu không có, vBook tự động vẽ bìa SVG tô màu theo định dạng sách dựa trên đuôi file trong thẻ `<title>`.
* **Tải sách (Acquisition Link):**
  - Trỏ về `/download/{fileId}`. Gateway trả về HTTP 302 chuyển hướng an toàn về máy chủ Google CDN, không làm lộ Google API Key.
* **Hỗ trợ nhiều định dạng tải trên 1 Entry**:
  - vBook cho phép một `<entry>` chứa nhiều link `rel="http://opds-spec.org/acquisition"` với các `type` khác nhau. Khi người dùng bấm tải, vBook sẽ hiển thị hộp thoại chọn định dạng (EPUB, PDF, MOBI...).

```xml
<entry>
  <id>urn:vbook:book:{fileId}</id>
  <title>Dấu Ấn Rồng Thiêng - Tập 1.cbz</title>
  <updated>2026-09-10T00:00:00Z</updated>
  <summary>Dấu Ấn Rồng Thiêng - Tập 1.cbz</summary>
  
  <!-- Link tải sách (Acquisition) -->
  <link rel="http://opds-spec.org/acquisition" href="/download/{fileId}?auth={token}" type="application/vnd.comicbook+zip"/>
</entry>
```

---

## 4. OpenSearch Contract với vBook (Direct URL Template)

Qua dịch ngược mã nguồn vBook (`tk9.java` - method `d` và `a`), cơ chế tìm kiếm trong vBook vận hành như sau:

### A. Nhận Diện Search Template
- vBook duyệt qua danh sách `<link>` ở root feed và tìm link có `rel` chứa từ khóa `"search"`.
- vBook **không tải file mô tả trung gian `opensearch.xml`** mà bóc tách trực tiếp chuỗi URL từ thuộc tính `href`.
- Định dạng bắt buộc của thẻ link trong feed Atom:
  ```xml
  <link rel="search" 
        href="https://domain.com/feed/{folderId}/search?q={searchTerms}&amp;auth={token}&amp;key={apiKey}" 
        type="application/atom+xml;profile=opds-catalog" 
        title="Tìm kiếm sách"/>
  ```

### B. Thực Thi Truy Vấn Tìm Kiếm
1. Người dùng nhập từ khóa tìm kiếm (ví dụ: `doraemon`).
2. vBook mã hóa URL-encode từ khóa theo chuẩn RFC-3986.
3. vBook thực hiện thay thế chuỗi token: `templateUrl.replace("{searchTerms}", encodedQuery)`.
4. vBook gửi request `GET` đến URL đã thay thế, kèm Header `Authorization: Basic` (nếu có).

### C. Phân Trang Kết Quả Tìm Kiếm (Infinite Scroll)
- Feed kết quả tìm kiếm trả về các `<entry>` khớp với từ khóa.
- Nếu có nhiều hơn 50 kết quả, Gateway trả về thẻ `<link rel="next" href=".../search?q=doraemon&amp;page=NEXT_TOKEN..."/>`.
- Khi người dùng cuộn xuống đáy màn hình tìm kiếm trên vBook, ứng dụng tự động gọi URL trong thuộc tính `href` của `rel="next"` để tải tiếp trang sau.

