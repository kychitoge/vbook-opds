export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  isFolder: boolean;
  bookMimeType?: string;
}

export interface FetchDriveResult {
  items: DriveItem[];
  nextPageToken?: string;
}

/**
 * Trích xuất Folder ID từ nhiều định dạng URL Google Drive hoặc ID thô
 */
export function extractFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Trường hợp là link folder: https://drive.google.com/drive/folders/1AbC...
  // hoặc https://drive.google.com/drive/u/0/folders/1AbC...
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  // Trường hợp là link open id: https://drive.google.com/open?id=1AbC...
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  // Trường hợp người dùng dán trực tiếp Folder ID (chuỗi alphanumeric)
  if (/^[a-zA-Z0-9_-]{10,60}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Xác định MIME type sách chuẩn cho vBook dựa trên phần mở rộng hoặc MIME của file
 */
export function detectBookMimeType(fileName: string, mimeType: string): string | null {
  const lowerName = fileName.toLowerCase();

  // EPUB
  if (lowerName.endsWith('.epub') || mimeType === 'application/epub+zip') {
    return 'application/epub+zip';
  }
  // CBZ
  if (lowerName.endsWith('.cbz') || mimeType === 'application/vnd.comicbook+zip') {
    return 'application/vnd.comicbook+zip';
  }
  // CBR (Khớp chuẩn parser vBook: application/vnd.comicbook-rar)
  if (lowerName.endsWith('.cbr') || mimeType === 'application/vnd.comicbook-rar') {
    return 'application/vnd.comicbook-rar';
  }
  // PDF
  if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
    return 'application/pdf';
  }
  // MOBI / PRC
  if (lowerName.endsWith('.mobi') || lowerName.endsWith('.prc') || mimeType === 'application/x-mobipocket-ebook') {
    return 'application/x-mobipocket-ebook';
  }
  // AZW (Kindle)
  if (lowerName.endsWith('.azw') || mimeType === 'application/vnd.amazon.ebook') {
    return 'application/vnd.amazon.ebook';
  }
  // AZW3 (Kindle KF8)
  if (lowerName.endsWith('.azw3') || mimeType === 'application/vnd.amazon.mobi8-ebook') {
    return 'application/vnd.amazon.mobi8-ebook';
  }
  // FB2.ZIP
  if (lowerName.endsWith('.fb2.zip') || mimeType === 'application/x-zip-compressed-fb2') {
    return 'application/x-zip-compressed-fb2';
  }
  // FB2 (Khớp chuẩn parser vBook: application/x-fictionbook+xml)
  if (lowerName.endsWith('.fb2') || mimeType === 'application/x-fictionbook+xml') {
    return 'application/x-fictionbook+xml';
  }
  // DOCX
  if (lowerName.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  // DOC
  if (lowerName.endsWith('.doc') || mimeType === 'application/msword') {
    return 'application/msword';
  }
  // ZIP (Truyện nén)
  if (lowerName.endsWith('.zip') || mimeType === 'application/zip') {
    return 'application/zip';
  }
  // TXT
  if (lowerName.endsWith('.txt') || mimeType === 'text/plain') {
    return 'text/plain';
  }

  return null;
}

interface RawDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  hasThumbnail?: boolean;
}

function parseDriveFiles(files: RawDriveFile[]): DriveItem[] {
  const items: DriveItem[] = [];

  for (const f of files) {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    if (isFolder) {
      items.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        isFolder: true,
      });
    } else {
      const bookMime = detectBookMimeType(f.name, f.mimeType);
      // Chỉ nhận những file là định dạng sách đọc hoặc có thể mở được
      if (bookMime) {
        items.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          modifiedTime: f.modifiedTime,
          thumbnailLink: f.thumbnailLink,
          isFolder: false,
          bookMimeType: bookMime,
        });
      }
    }
  }

  return items;
}

async function executeDriveQuery(options: {
  query: string;
  apiKey: string;
  pageToken?: string;
  pageSize?: number;
}): Promise<FetchDriveResult> {
  const { query, apiKey, pageToken, pageSize = 50 } = options;
  const fields = 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, hasThumbnail)';
  const orderBy = 'folder desc, name asc';

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', query);
  url.searchParams.set('fields', fields);
  url.searchParams.set('orderBy', orderBy);
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set('key', apiKey);
  url.searchParams.set('spaces', 'drive');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('includeItemsFromAllDrives', 'true');

  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    files?: RawDriveFile[];
    nextPageToken?: string;
  };

  return {
    items: parseDriveFiles(data.files || []),
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Gọi Google Drive API v3 để lấy danh sách file & folder
 */
export async function fetchDriveFolder(options: {
  folderId: string;
  apiKey: string;
  pageToken?: string;
  pageSize?: number;
}): Promise<FetchDriveResult> {
  const { folderId, apiKey, pageToken, pageSize } = options;
  const query = `'${folderId}' in parents and trashed = false`;
  return executeDriveQuery({ query, apiKey, pageToken, pageSize });
}

/**
 * Tìm kiếm sách trong thư mục Google Drive theo từ khóa tên file
 */
export async function searchDriveFolder(options: {
  folderId: string;
  apiKey: string;
  searchTerm: string;
  pageToken?: string;
  pageSize?: number;
}): Promise<FetchDriveResult> {
  const { folderId, apiKey, searchTerm, pageToken, pageSize } = options;
  // Escape ký tự đặc biệt trong search term để an toàn cho query string
  const sanitized = searchTerm.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = `'${folderId}' in parents and trashed = false and name contains '${sanitized}'`;
  return executeDriveQuery({ query, apiKey, pageToken, pageSize });
}
