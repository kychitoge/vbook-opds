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

// Bộ đệm cây thư mục (Memory Fallback cho Cloudflare Worker isolate và môi trường test)
const memoryTreeCache = new Map<string, { folderIds: string[]; expiresAt: number }>();

/**
 * Xóa bộ nhớ đệm cây thư mục (phục vụ test hoặc làm mới cưỡng bức)
 */
export function clearTreeCache(): void {
  memoryTreeCache.clear();
}

/**
 * Thu thập tất cả ID thư mục con đệ quy (tối đa maxDepth cấp và maxFolders thư mục)
 * Thuật toán: BFS Level-Order Traversal trên cây đa phân (N-ary Tree)
 * Sử dụng batching query OR để giảm thiểu số lượng request tới Google Drive API
 */
export async function fetchDescendantFolderIds(options: {
  rootFolderId: string;
  apiKey: string;
  maxDepth?: number;
  maxFolders?: number;
}): Promise<string[]> {
  const { rootFolderId, apiKey, maxDepth = 3, maxFolders = 35 } = options;
  const collectedFolderIds: string[] = [];
  let currentLevelFolderIds = [rootFolderId];
  let depth = 0;

  while (currentLevelFolderIds.length > 0 && depth < maxDepth && collectedFolderIds.length < maxFolders) {
    depth++;
    const batchSize = 15;
    const nextLevelFolderIds: string[] = [];

    for (let i = 0; i < currentLevelFolderIds.length; i += batchSize) {
      if (collectedFolderIds.length >= maxFolders) break;

      const batch = currentLevelFolderIds.slice(i, i + batchSize);
      const parentConditions = batch.map((id) => `'${id}' in parents`).join(' or ');
      const query = `(${parentConditions}) and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

      try {
        const url = new URL('https://www.googleapis.com/drive/v3/files');
        url.searchParams.set('q', query);
        url.searchParams.set('fields', 'files(id)');
        url.searchParams.set('pageSize', '100');
        url.searchParams.set('key', apiKey);
        url.searchParams.set('spaces', 'drive');
        url.searchParams.set('supportsAllDrives', 'true');
        url.searchParams.set('includeItemsFromAllDrives', 'true');

        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          const data = (await response.json()) as { files?: { id: string }[] };
          const foundFolders = (data.files || []).map((f) => f.id);
          for (const fid of foundFolders) {
            if (!collectedFolderIds.includes(fid) && fid !== rootFolderId) {
              collectedFolderIds.push(fid);
              nextLevelFolderIds.push(fid);
              if (collectedFolderIds.length >= maxFolders) break;
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi khi quét thư mục con:', err);
        break;
      }
    }

    currentLevelFolderIds = nextLevelFolderIds;
  }

  return collectedFolderIds;
}

/**
 * Lấy danh sách ID thư mục con kèm bộ đệm Edge Cache / Memory Cache (TTL 300 giây = 5 phút)
 * - Cache HIT: 0ms latency, 0 request Google API
 * - Cache MISS: Quét BFS 1 lần duy nhất và lưu cache 300s
 */
export async function getCachedDescendantFolderIds(options: {
  rootFolderId: string;
  apiKey: string;
  maxDepth?: number;
  maxFolders?: number;
  ttlSeconds?: number;
}): Promise<string[]> {
  const { rootFolderId, apiKey, maxDepth = 3, maxFolders = 35, ttlSeconds = 300 } = options;
  const now = Date.now();

  // 1. Kiểm tra Memory Cache
  const memCached = memoryTreeCache.get(rootFolderId);
  if (memCached && memCached.expiresAt > now) {
    return memCached.folderIds;
  }

  // 2. Kiểm tra Cloudflare Edge Cache API (nếu có)
  const cacheKey = `https://internal.cache/tree/${rootFolderId}`;
  if (typeof caches !== 'undefined' && caches?.default) {
    try {
      const match = await caches.default.match(new Request(cacheKey));
      if (match) {
        const ids = (await match.json()) as string[];
        memoryTreeCache.set(rootFolderId, { folderIds: ids, expiresAt: now + ttlSeconds * 1000 });
        return ids;
      }
    } catch {
      // Bỏ qua lỗi cache
    }
  }

  // 3. Cache MISS: Quét BFS các thư mục con
  const folderIds = await fetchDescendantFolderIds({
    rootFolderId,
    apiKey,
    maxDepth,
    maxFolders,
  });

  // 4. Lưu Memory Cache
  memoryTreeCache.set(rootFolderId, { folderIds, expiresAt: now + ttlSeconds * 1000 });

  // 5. Lưu Cloudflare Edge Cache API (300s)
  if (typeof caches !== 'undefined' && caches?.default) {
    try {
      const res = new Response(JSON.stringify(folderIds), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
        },
      });
      await caches.default.put(new Request(cacheKey), res);
    } catch {
      // Bỏ qua lỗi cache
    }
  }

  return folderIds;
}

/**
 * Xây dựng câu query tìm kiếm file sách trong danh sách thư mục (root + subfolders)
 */
export function buildSearchQuery(options: {
  folderIds: string[];
  searchTerm: string;
}): string {
  const { folderIds, searchTerm } = options;
  const sanitized = searchTerm.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const validFolderIds = folderIds.length > 0 ? folderIds : ['root'];
  const parentConditions = validFolderIds.map((id) => `'${id}' in parents`).join(' or ');
  return `(${parentConditions}) and trashed = false and name contains '${sanitized}'`;
}

/**
 * Tìm kiếm sách trong thư mục Google Drive (hỗ trợ Deep Search quét toàn bộ cây thư mục con)
 * Sử dụng bộ nhớ đệm Tree Cache 300s để bảo toàn tốc độ <300ms và duy trì native nextPageToken cho vBook
 */
export async function searchDriveFolder(options: {
  folderId: string;
  apiKey: string;
  searchTerm: string;
  pageToken?: string;
  pageSize?: number;
  deepSearch?: boolean;
}): Promise<FetchDriveResult> {
  const { folderId, apiKey, searchTerm, pageToken, pageSize, deepSearch = true } = options;
  const folderIds = [folderId];

  if (deepSearch) {
    try {
      const subfolderIds = await getCachedDescendantFolderIds({
        rootFolderId: folderId,
        apiKey,
        maxDepth: 3,
        maxFolders: 35, // Giới hạn 35 folder để query string < 2KB, an toàn tuyệt đối với Google Drive API
        ttlSeconds: 300, // Chốt chuẩn 300 giây (5 phút)
      });
      folderIds.push(...subfolderIds);
    } catch (err) {
      console.warn('Lỗi quét deep search subfolders, fallback về search cấp 1:', err);
    }
  }

  const query = buildSearchQuery({ folderIds, searchTerm });
  return executeDriveQuery({ query, apiKey, pageToken, pageSize });
}
