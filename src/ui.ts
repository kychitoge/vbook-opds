/**
 * Render giao diện Web tối giản theo đúng chuẩn Design Tokens, tinh gọn, thoáng đãng
 */
export function renderHtmlPage(defaultApiKeyConfigured: boolean): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VBook OPDS Gateway</title>
  <style>
    :root {
      /* Light Theme */
      --bg: #f8fafc;
      --surface: #ffffff;
      --surface-glass: rgba(255, 255, 255, 0.7);
      --border: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #64748b;

      /* Primary Accent: #038fd2 */
      --primary: #038fd2;
      --primary-hover: #0277b0;
      --primary-light: rgba(3, 143, 210, 0.12);
      --radius: 12px;
    }

    :root[data-theme="dark"] {
      /* Dark Theme - Background #020617, chữ dịu mắt #e2e8f0 */
      --bg: #020617;
      --surface: #0f172a;
      --surface-glass: rgba(15, 23, 42, 0.7);
      --border: #1e293b;
      --text-main: #e2e8f0;
      --text-muted: #94a3b8;

      /* Primary Accent: #038fd2 */
      --primary: #038fd2;
      --primary-hover: #1ca5ec;
      --primary-light: rgba(3, 143, 210, 0.18);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    body {
      background-color: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
      transition: background-color 0.2s, color 0.2s;
    }

    /* Bố cục phẳng, loại bỏ cảm giác hộp lồng hộp gò bó */
    .app-wrapper {
      width: 100%;
      max-width: 480px;
      margin: auto 0;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-title {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.5px;
    }

    .badge {
      font-size: 0.72rem;
      background: var(--primary);
      color: #fff;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .theme-toggle {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: 10px;
      width: 40px;
      height: 40px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .theme-toggle svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .theme-toggle:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 8px;
    }

    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 14px 16px;
      background: var(--surface);
      border: 1.5px solid var(--border);
      border-radius: 10px;
      color: var(--text-main);
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input[type="text"]:focus, input[type="password"]:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-light);
    }

    .accordion-toggle {
      background: none;
      border: none;
      color: var(--primary);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 0;
      margin-bottom: 18px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .accordion-toggle:hover {
      opacity: 0.85;
    }

    .accordion-content {
      display: none;
      margin-bottom: 20px;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .accordion-content.open {
      display: block;
    }

    .row {
      display: flex;
      gap: 12px;
    }

    .row .form-group {
      flex: 1;
      margin-bottom: 0;
    }

    .btn-submit {
      width: 100%;
      padding: 15px;
      background: var(--primary);
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.3px;
      transition: transform 0.1s, opacity 0.2s, background-color 0.2s;
    }

    .btn-submit:hover {
      background: var(--primary-hover);
    }

    .btn-submit:active {
      transform: scale(0.98);
    }

    /* Result Box: Phẳng, tinh gọn chuẩn prod */
    .result-box {
      display: none;
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      animation: fadeIn 0.25s ease-out;
    }

    .result-title {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    .url-display-card {
      background: var(--surface);
      border: 1.5px solid var(--primary);
      border-radius: 10px;
      padding: 14px 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.92rem;
      color: var(--primary);
      white-space: nowrap;
      overflow-x: auto;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE/Edge */
      line-height: 1.4;
      margin-bottom: 12px;
      user-select: all;
    }

    .url-display-card::-webkit-scrollbar {
      display: none; /* Chrome, Safari, Opera */
    }

    .btn-copy {
      width: 100%;
      padding: 14px;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      border: none;
      background: var(--primary);
      color: #ffffff;
      transition: opacity 0.2s, transform 0.1s, background-color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-copy svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .btn-copy:hover {
      background: var(--primary-hover);
    }

    .btn-copy:active {
      transform: scale(0.98);
    }

    .instructions {
      margin-top: 20px;
      padding: 16px;
      background: var(--surface);
      border-radius: 10px;
      border: 1px solid var(--border);
      font-size: 0.82rem;
      color: var(--text-muted);
      line-height: 1.6;
    }

    .instructions strong {
      color: var(--text-main);
    }

    .instructions ol {
      margin-top: 6px;
      padding-left: 18px;
    }

    .instructions li {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="app-wrapper">
    <div class="header">
      <div class="brand">
        <span class="brand-title">VBook OPDS</span>
        <span class="badge">Drive to OPDS</span>
      </div>
      <button class="theme-toggle" id="themeBtn" aria-label="Đổi giao diện">
        <!-- Sun icon -->
        <svg id="sunIcon" style="display:none" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        <!-- Moon icon -->
        <svg id="moonIcon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
      </button>
    </div>

    <form id="opdsForm">
      <div class="form-group">
        <label for="driveInput">Đường link thư mục Google Drive</label>
        <input 
          type="text" 
          id="driveInput" 
          placeholder="https://drive.google.com/drive/folders/..." 
          required 
          autocomplete="off"
        />
      </div>

      <button type="button" class="accordion-toggle" id="toggleOptions">
        <span id="accordionText">+ Tùy chọn bảo mật & API Key</span>
      </button>

      <div class="accordion-content" id="optionsContent">
        ${
          !defaultApiKeyConfigured
            ? `<div class="form-group">
                 <label for="apiKeyInput">Google Drive API Key</label>
                 <input type="text" id="apiKeyInput" placeholder="AIzaSy..." />
               </div>`
            : `<div class="form-group">
                 <label for="apiKeyInput">Google Drive API Key (Tùy chọn)</label>
                 <input type="text" id="apiKeyInput" placeholder="Để trống nếu dùng API Key của máy chủ" />
               </div>`
        }
        <div class="row">
          <div class="form-group">
            <label for="usernameInput">Tên (Tùy chọn)</label>
            <input type="text" id="usernameInput" placeholder="vbook" />
          </div>
          <div class="form-group">
            <label for="passwordInput">Mật khẩu (Tùy chọn)</label>
            <input type="password" id="passwordInput" placeholder="••••••" />
          </div>
        </div>
      </div>

      <button type="submit" class="btn-submit">TẠO ĐƯỜNG DẪN OPDS</button>
    </form>

    <div class="result-box" id="resultBox">
      <div class="result-title">URL Danh Mục Cho vBook</div>
      <div class="url-display-card" id="outputUrl"></div>

      <button class="btn-copy" id="copyBtn">
        <svg id="copyIcon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <svg id="checkIcon" style="display:none" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <span id="copyText">Sao chép liên kết</span>
      </button>

      <div class="instructions">
        <strong>Hướng dẫn thêm vào ứng dụng vBook:</strong>
        <ol>
          <li>Mở vBook &rarr; <strong>Kho lưu trữ / Đám mây</strong> &rarr; Chọn <strong>OPDS</strong>.</li>
          <li>Dán link vừa sao chép vào ô <strong>URL danh mục</strong>.</li>
          <li>Điền Tên và Mật khẩu (nếu có thiết lập ở mục tùy chọn) &rarr; Bấm <strong>Lưu</strong>.</li>
        </ol>
      </div>
    </div>
  </div>

  <script>
    // Theme toggle
    const themeBtn = document.getElementById('themeBtn');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');
    const root = document.documentElement;
    
    function updateThemeIcons(theme) {
      if (theme === 'dark') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }
    }

    const savedTheme = localStorage.getItem('vbook-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (savedTheme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      updateThemeIcons('dark');
    } else {
      updateThemeIcons('light');
    }

    themeBtn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      if (next === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      localStorage.setItem('vbook-theme', next);
      updateThemeIcons(next);
    });

    // Accordion toggle
    const toggleBtn = document.getElementById('toggleOptions');
    const optionsContent = document.getElementById('optionsContent');
    const accordionText = document.getElementById('accordionText');
    toggleBtn.addEventListener('click', () => {
      const isOpen = optionsContent.classList.toggle('open');
      accordionText.textContent = isOpen ? '− Thu gọn tùy chọn' : '+ Tùy chọn bảo mật & API Key';
    });

    // Form submit
    const form = document.getElementById('opdsForm');
    const resultBox = document.getElementById('resultBox');
    const outputUrl = document.getElementById('outputUrl');
    const copyBtn = document.getElementById('copyBtn');
    const copyIcon = document.getElementById('copyIcon');
    const checkIcon = document.getElementById('checkIcon');
    const copyText = document.getElementById('copyText');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const driveVal = document.getElementById('driveInput').value.trim();
      const apiKeyVal = document.getElementById('apiKeyInput')?.value.trim() || '';
      const userVal = document.getElementById('usernameInput').value.trim();
      const passVal = document.getElementById('passwordInput').value.trim();

      // Extract folder ID
      let folderId = driveVal;
      const folderMatch = driveVal.match(/\\/folders\\/([a-zA-Z0-9_-]+)/);
      if (folderMatch && folderMatch[1]) {
        folderId = folderMatch[1];
      } else {
        const idMatch = driveVal.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          folderId = idMatch[1];
        }
      }

      if (!folderId) {
        alert('Vui lòng nhập đường link thư mục Google Drive hợp lệ!');
        return;
      }

      const currentOrigin = window.location.origin;
      const url = new URL(\`\${currentOrigin}/feed/\${folderId}\`);

      if (apiKeyVal) {
        url.searchParams.set('key', apiKeyVal);
      }

      if (userVal && passVal) {
        const token = btoa(\`\${userVal}:\${passVal}\`);
        url.searchParams.set('auth', token);
      }

      const fullUrl = url.toString();
      outputUrl.textContent = fullUrl;
      resultBox.style.display = 'block';
    });

    copyBtn.addEventListener('click', () => {
      const text = outputUrl.textContent;
      navigator.clipboard.writeText(text).then(() => {
        copyIcon.style.display = 'none';
        checkIcon.style.display = 'block';
        copyText.textContent = 'Đã sao chép vào bộ nhớ tạm';
        setTimeout(() => {
          copyIcon.style.display = 'block';
          checkIcon.style.display = 'none';
          copyText.textContent = 'Sao chép liên kết';
        }, 2000);
      });
    });
  </script>
</body>
</html>`;
}
