/**
 * MCP OAuth 登录页 HTML 模板
 * DeskSkill 风格内联样式
 */

export function renderLoginPage(requestId, errorMsg = '') {
  const errorHtml = errorMsg
    ? `<div style="background:#fff0f0;color:#d32f2f;border:1px solid #fcc;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:13px;">${errorMsg}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DeskSkill \u2014 MCP \u767b\u5f55</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f4f5f7;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #1a1a2e;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      padding: 36px 32px 28px;
      width: 360px;
      max-width: 90vw;
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo h1 {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a2e;
    }
    .logo p {
      font-size: 13px;
      color: #8e8ea0;
      margin-top: 4px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #555;
      margin-bottom: 4px;
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #d9d9e3;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
      margin-bottom: 16px;
    }
    input:focus {
      border-color: #1a1a2e;
    }
    button {
      width: 100%;
      padding: 11px;
      background: #1a1a2e;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #2d2d44; }
    button:active { background: #111122; }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 11px;
      color: #b0b0b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <h1>DeskSkill TeamBoard</h1>
      <p>MCP \u670d\u52a1\u8ba4\u8bc1</p>
    </div>
    ${errorHtml}
    <form method="POST" action="/oauth/login">
      <input type="hidden" name="request_id" value="${requestId}">
      <label>\u7528\u6237\u540d</label>
      <input type="text" name="username" required autofocus autocomplete="username">
      <label>\u5bc6\u7801</label>
      <input type="password" name="password" required autocomplete="current-password">
      <button type="submit">\u767b\u5f55</button>
    </form>
    <div class="footer">AI \u5de5\u5177\u8fde\u63a5\u6388\u6743 \u00b7 \u767b\u5f55\u540e\u81ea\u52a8\u56de\u4f20 Token</div>
  </div>
</body>
</html>`;
}
