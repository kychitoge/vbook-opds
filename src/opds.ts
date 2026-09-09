import { DriveItem } from './drive';

/**
 * Escape ký tự đặc biệt cho XML Atom
 */
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Làm sạch tên sách bằng cách loại bỏ phần mở rộng file (.epub, .pdf, .cbz...)
 * Giữ nguyên 100% tính toàn vẹn của tên file (tập, phần, số chương...)
 */
export function cleanBookTitle(fileName: string): string {
  const clean = fileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();
  return clean || fileName;
}

export interface BuildOpdsOptions {
  feedTitle: string;
  folderId: string;
  items: DriveItem[];
  origin: string;
  currentPath: string;
  nextPageToken?: string;
  authParam?: string;
  apiKeyParam?: string;
  searchTerms?: string;
}

/**
 * Sinh chuỗi XML Atom chuẩn OPDS 1.2 đáp ứng chính xác Contract của vBook và các OPDS Reader
 */
export function buildOpdsFeed(options: BuildOpdsOptions): string {
  const {
    feedTitle,
    folderId,
    items,
    origin,
    currentPath,
    nextPageToken,
    authParam,
    apiKeyParam,
    searchTerms,
  } = options;

  const now = new Date().toISOString();

  // Hàm sinh query param truyền thống (kế thừa auth và key qua các link con để bảo vệ toàn vẹn catalog)
  const buildSubParams = (extraParams: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams();
    if (authParam) params.set('auth', authParam);
    if (apiKeyParam) params.set('key', apiKeyParam);
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params.set(k, v);
    }
    const q = params.toString();
    return q ? `?${q}` : '';
  };

  const selfParams = searchTerms ? { q: searchTerms } : {};
  const selfUrl = `${origin}${currentPath}${buildSubParams(selfParams)}`;
  const startUrl = `${origin}/feed/${folderId}${buildSubParams()}`;
  
  // Link OpenSearch Description phục vụ tìm kiếm (chuẩn bị sẵn cho các phiên bản vBook tương lai và OPDS reader khác)
  const searchUrl = `${origin}/feed/${folderId}/opensearch.xml${buildSubParams()}`;

  let nextLinkXml = '';
  if (nextPageToken) {
    const nextParams: Record<string, string> = { page: nextPageToken };
    if (searchTerms) nextParams.q = searchTerms;
    const nextUrl = `${origin}${currentPath}${buildSubParams(nextParams)}`;
    nextLinkXml = `  <link rel="next" href="${escapeXml(nextUrl)}" type="application/atom+xml;profile=opds-catalog"/>\n`;
  }

  const entriesXml = items
    .map((item) => {
      const updated = item.modifiedTime || now;

      if (item.isFolder) {
        // KỊCH BẢN 1: Thư mục con (Navigation Entry cho vBook)
        const subFolderUrl = `${origin}/feed/${item.id}${buildSubParams()}`;
        return `  <entry>
    <id>urn:vbook:folder:${item.id}</id>
    <title>${escapeXml(item.name)}</title>
    <updated>${updated}</updated>
    <summary>Thư mục: ${escapeXml(item.name)}</summary>
    <link rel="subsection" href="${escapeXml(subFolderUrl)}" type="application/atom+xml;profile=opds-catalog"/>
  </entry>`;
      } else {
        // KỊCH BẢN 2: Tệp sách (Acquisition Entry cho vBook)
        // vBook tự nhận diện badge loại file từ thuộc tính type trong acquisition link.
        // Giữ nguyên 100% tên sách gốc (chỉ gọt bỏ đuôi mở rộng file), không đoán mò tác giả.
        const displayTitle = cleanBookTitle(item.name);
        const bookMime = item.bookMimeType || 'application/epub+zip';
        const downloadUrl = `${origin}/download/${item.id}${buildSubParams()}`;

        // Chỉ chèn link ảnh nếu Google Drive thực sự có thumbnail hợp lệ
        let imageLinkXml = '';
        if (item.thumbnailLink) {
          imageLinkXml = `\n    <link rel="http://opds-spec.org/image" href="${escapeXml(item.thumbnailLink)}" type="image/jpeg"/>\n    <link rel="http://opds-spec.org/image/thumbnail" href="${escapeXml(item.thumbnailLink)}" type="image/jpeg"/>`;
        }

        return `  <entry>
    <id>urn:vbook:book:${item.id}</id>
    <title>${escapeXml(displayTitle)}</title>
    <updated>${updated}</updated>
    <summary>${escapeXml(item.name)}</summary>${imageLinkXml}
    <link rel="http://opds-spec.org/acquisition" href="${escapeXml(downloadUrl)}" type="${bookMime}"/>
  </entry>`;
      }
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:vbook:feed:${folderId}</id>
  <title>${escapeXml(feedTitle)}</title>
  <updated>${now}</updated>
  <link rel="self" href="${escapeXml(selfUrl)}" type="application/atom+xml;profile=opds-catalog"/>
  <link rel="start" href="${escapeXml(startUrl)}" type="application/atom+xml;profile=opds-catalog"/>
  <!-- OpenSearch link: Tương thích chuẩn OPDS 1.2, sẵn sàng cho các phiên bản vBook tương lai hỗ trợ search -->
  <link rel="search" href="${escapeXml(searchUrl)}" type="application/opensearchdescription+xml" title="Tìm kiếm sách"/>
${nextLinkXml}${entriesXml}
</feed>`;
}

/**
 * Sinh tài liệu mô tả OpenSearch 1.1 chuẩn cho OPDS Reader
 * Được lưu giữ có cấu trúc để sẵn sàng khi app vBook cập nhật tính năng tìm kiếm
 */
export function buildOpenSearchDescription(
  origin: string,
  folderId: string,
  apiKeyParam?: string,
  authParam?: string
): string {
  const params = new URLSearchParams();
  if (apiKeyParam) params.set('key', apiKeyParam);
  if (authParam) params.set('auth', authParam);
  const extra = params.toString() ? `&amp;${escapeXml(params.toString())}` : '';
  const searchTemplate = `${origin}/feed/${folderId}/search?q={searchTerms}${extra}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>VBook Search</ShortName>
  <Description>Tìm kiếm sách trong danh mục Google Drive</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <OutputEncoding>UTF-8</OutputEncoding>
  <Url type="application/atom+xml;profile=opds-catalog" template="${searchTemplate}"/>
</OpenSearchDescription>`;
}
