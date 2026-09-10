import { DriveItem } from './drive';
import { cleanBookTitle } from './opds';

export interface BuildOpds2Options {
  feedTitle: string;
  folderId: string;
  items: DriveItem[];
  origin: string;
  currentPath: string;
  nextPageToken?: string;
  authParam?: string;
  apiKeyParam?: string;
  searchTerms?: string;
  subfolderIdMap?: Record<string, string>;
}

interface Opds2Link {
  href: string;
  rel?: string[];
  type?: string;
  title?: string;
}

interface Opds2Publication {
  metadata: {
    identifier: string;
    title: string;
    modified?: string;
  };
  links: Opds2Link[];
  images?: Array<{ href: string; type: string }>;
}

interface Opds2Feed {
  metadata: {
    identifier: string;
    title: string;
    modified: string;
  };
  links: Opds2Link[];
  navigation: Opds2Link[];
  publications: Opds2Publication[];
}

/**
 * Xây dựng OPDS 2.0 JSON Feed theo chuẩn tương thích 100% với vBook OPDS 2.0 Schema
 */
export function buildOpds2Feed(options: BuildOpds2Options): string {
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
    subfolderIdMap,
  } = options;

  const now = new Date().toISOString();

  // Helper tạo query params (kế thừa auth và key)
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

  const baseSubParams = buildSubParams();
  const searchExtra = baseSubParams ? `&${baseSubParams.slice(1)}` : '';
  const searchTemplate = `${origin}/feed/${folderId}/search?q={searchTerms}${searchExtra}`;

  const links: Opds2Link[] = [
    {
      href: selfUrl,
      rel: ['self'],
      type: 'application/opds+json',
    },
    {
      href: startUrl,
      rel: ['start'],
      type: 'application/opds+json',
    },
    {
      href: searchTemplate,
      rel: ['search'],
      type: 'application/opds+json',
      title: 'Tìm kiếm sách',
    },
  ];

  if (nextPageToken) {
    const nextParams: Record<string, string> = { page: nextPageToken };
    if (searchTerms) nextParams.q = searchTerms;
    const nextUrl = `${origin}${currentPath}${buildSubParams(nextParams)}`;
    links.push({
      href: nextUrl,
      rel: ['next'],
      type: 'application/opds+json',
    });
  }

  const navigation: Opds2Link[] = [];
  const publications: Opds2Publication[] = [];

  for (const item of items) {
    if (item.isFolder) {
      // Kịch bản thư mục con -> Cho vào mảng navigation
      const subFolderRef = (subfolderIdMap && subfolderIdMap[item.id]) || item.id;
      const subFolderUrl = `${origin}/feed/${subFolderRef}${buildSubParams()}`;
      navigation.push({
        href: subFolderUrl,
        title: item.name,
        type: 'application/opds+json',
        rel: ['subsection'],
      });
    } else {
      // Kịch bản tệp sách -> Cho vào mảng publications
      const displayTitle = cleanBookTitle(item.name);
      const bookMime = item.bookMimeType || 'application/epub+zip';
      const downloadUrl = `${origin}/download/${item.id}${buildSubParams()}`;

      const pub: Opds2Publication = {
        metadata: {
          identifier: `urn:vbook:book:${item.id}`,
          title: displayTitle,
          modified: item.modifiedTime || now,
        },
        links: [
          {
            href: downloadUrl,
            rel: ['http://opds-spec.org/acquisition'],
            type: bookMime,
          },
        ],
      };

      if (item.thumbnailLink) {
        pub.images = [
          {
            href: item.thumbnailLink,
            type: 'image/jpeg',
          },
        ];
      }

      publications.push(pub);
    }
  }

  const feed: Opds2Feed = {
    metadata: {
      identifier: `urn:vbook:feed:${folderId}`,
      title: feedTitle,
      modified: now,
    },
    links,
    navigation,
    publications,
  };

  return JSON.stringify(feed);
}
