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
 * Tách tên sách và tác giả từ tên file
 */
export function parseTitleAndAuthor(rawName: string): { title: string; author: string; ext: string } {
  // Lấy phần mở rộng file (.epub, .cbz, .pdf...)
  const extMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const cleanName = rawName.replace(/\.[a-zA-Z0-9]+$/, '').trim();

  // Dạng: "Tên sách - Tác giả"
  const dashMatch = cleanName.match(/^(.*?)\s*[-–—]\s*(.*?)$/);
  if (dashMatch && dashMatch[1] && dashMatch[2]) {
    return {
      title: dashMatch[1].trim(),
      author: dashMatch[2].trim(),
      ext,
    };
  }

  // Dạng: "[Tác giả] Tên sách"
  const bracketMatch = cleanName.match(/^\[(.*?)\]\s*(.*?)$/);
  if (bracketMatch && bracketMatch[1] && bracketMatch[2]) {
    return {
      title: bracketMatch[2].trim(),
      author: bracketMatch[1].trim(),
      ext,
    };
  }

  // Dạng: "Tên sách (Tác giả)"
  const parenMatch = cleanName.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch && parenMatch[1] && parenMatch[2]) {
    return {
      title: parenMatch[1].trim(),
      author: parenMatch[2].trim(),
      ext,
    };
  }

  return {
    title: cleanName,
    author: 'Khuyết Danh',
    ext,
  };
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
}

/**
 * Sinh chuỗi XML Atom chuẩn OPDS 1.2 đáp ứng chính xác Contract của vBook
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
  } = options;

  const now = new Date().toISOString();

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

  const selfUrl = `${origin}${currentPath}${buildSubParams()}`;
  const startUrl = `${origin}/feed/${folderId}${buildSubParams()}`;

  let nextLinkXml = '';
  if (nextPageToken) {
    const nextUrl = `${origin}/feed/${folderId}${buildSubParams({ page: nextPageToken })}`;
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
        const { title, author, ext } = parseTitleAndAuthor(item.name);
        const bookMime = item.bookMimeType || 'application/epub+zip';
        const downloadUrl = `${origin}/download/${item.id}${buildSubParams()}`;

        // vBook nhận diện định dạng từ đuôi file trong title
        const fullDisplayTitle = ext ? `${title}.${ext}` : item.name;

        // Chỉ chèn link ảnh nếu Google Drive thực sự có thumbnail (ví dụ PDF, Comic...)
        // Với file epub thuần không có thumbnail thì không chèn thẻ ảnh giả
        let imageLinkXml = '';
        if (item.thumbnailLink) {
          imageLinkXml = `\n    <link rel="http://opds-spec.org/image" href="${escapeXml(item.thumbnailLink)}" type="image/jpeg"/>\n    <link rel="http://opds-spec.org/image/thumbnail" href="${escapeXml(item.thumbnailLink)}" type="image/jpeg"/>`;
        }

        return `  <entry>
    <id>urn:vbook:book:${item.id}</id>
    <title>${escapeXml(fullDisplayTitle)}</title>
    <author>
      <name>${escapeXml(author)}</name>
    </author>
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
${nextLinkXml}${entriesXml}
</feed>`;
}
