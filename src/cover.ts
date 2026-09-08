import { escapeXml } from './opds';

/**
 * Sinh ảnh bìa SVG tỷ lệ 2:3 chuẩn sách điện tử, tối ưu hiển thị cho Coil3 trên vBook
 */
export function generateSvgCover(title: string, author: string, ext: string = 'EPUB'): string {
  const safeTitle = escapeXml(decodeURIComponent(title) || 'Sách Điện Tử');
  const safeAuthor = escapeXml(decodeURIComponent(author) || 'Tác Giả');
  const safeExt = escapeXml(ext.toUpperCase() || 'EPUB');

  // Ngắt tiêu đề thành tối đa 3 dòng nếu quá dài
  const words = safeTitle.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const w of words) {
    if ((currentLine + ' ' + w).trim().length > 18) {
      if (lines.length < 2) {
        lines.push(currentLine.trim());
        currentLine = w;
      } else {
        currentLine += ' ' + w;
      }
    } else {
      currentLine += ' ' + w;
    }
  }
  if (currentLine) {
    if (lines.length >= 2 && currentLine.length > 20) {
      lines.push(currentLine.substring(0, 17) + '...');
    } else {
      lines.push(currentLine.trim());
    }
  }

  // Tọa độ Y cho tiêu đề
  const startY = 240 - (lines.length - 1) * 20;
  const titleTspans = lines
    .map(
      (line, idx) =>
        `<tspan x="200" y="${startY + idx * 36}" text-anchor="middle">${line}</tspan>`
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2005/svg" viewBox="0 0 400 600" width="400" height="600">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#131c2e"/>
      <stop offset="60%" stop-color="#0a0f1a"/>
      <stop offset="100%" stop-color="#0f1729"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d8c4"/>
      <stop offset="100%" stop-color="#7ea6ff"/>
    </linearGradient>
  </defs>

  <!-- Nền chính -->
  <rect width="400" height="600" rx="16" fill="url(#bgGrad)"/>

  <!-- Khung viền thanh lịch -->
  <rect x="20" y="20" width="360" height="560" rx="10" fill="none" stroke="#23304a" stroke-width="2"/>
  <rect x="26" y="26" width="348" height="548" rx="8" fill="none" stroke="#23304a" stroke-width="1" stroke-opacity="0.5"/>

  <!-- Huy hiệu định dạng ở góc trên -->
  <rect x="40" y="44" width="70" height="26" rx="6" fill="url(#accentGrad)"/>
  <text x="75" y="62" fill="#0a0f1a" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="800" text-anchor="middle" letter-spacing="1">${safeExt}</text>

  <!-- Họa tiết trang trí giữa sách -->
  <circle cx="200" cy="140" r="32" fill="#131c2e" stroke="#23304a" stroke-width="2"/>
  <path d="M188 130 C194 126 200 126 200 132 L200 152 C194 148 188 148 188 152 Z M212 130 C206 126 200 126 200 132 L200 152 C206 148 212 148 212 152 Z" fill="url(#accentGrad)"/>

  <!-- Tiêu đề sách -->
  <text fill="#f2f6fd" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="24" font-weight="700">
    ${titleTspans}
  </text>

  <!-- Đường kẻ phân cách -->
  <line x1="140" y1="420" x2="260" y2="420" stroke="url(#accentGrad)" stroke-width="2" stroke-linecap="round"/>

  <!-- Tên tác giả -->
  <text x="200" y="460" fill="#9aa7bd" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="15" font-weight="500" text-anchor="middle">
    ${safeAuthor}
  </text>

  <!-- Logo chân sách -->
  <text x="200" y="540" fill="#64708a" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" text-anchor="middle" letter-spacing="2">
    VBOOK OPDS
  </text>
</svg>`;
}
