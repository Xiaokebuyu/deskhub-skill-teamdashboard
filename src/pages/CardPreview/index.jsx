/**
 * Bot 卡片 v2 本地预览页
 * 通过 URL hash `#card-mocks` 进入（绕过登录）
 * 自动 glob 加载 dev/card-mocks/*.json
 */

import CardKit from './CardKit.jsx';
import { TB } from './tokens.js';

// Vite glob：eager 加载 + import default，构建期把 JSON 直接打进 bundle
const modules = import.meta.glob('/card-mocks/*.json', {
  eager: true,
  import: 'default',
});

const cards = Object.entries(modules)
  .map(([path, data]) => ({
    name: path.split('/').pop().replace('.json', ''),
    data,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function CardPreview() {
  return (
    <div style={{
      padding: 32,
      background: TB.bgSide,
      minHeight: '100vh',
      fontFamily: TB.fontSans,
    }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 22, color: TB.text, margin: 0, fontWeight: 700,
            fontFamily: TB.fontMono, letterSpacing: 0.5,
          }}>
            Bot 卡片 v2 本地预览
          </h1>
          <p style={{
            fontSize: 13, color: TB.text4, margin: '6px 0 0 0',
          }}>
            {cards.length} 张 mock · 近似渲染（色板/字体已对齐 TeamBoard，细节观感以 cardbuilder 为准）·
            {' '}
            <a
              href="https://open.feishu.cn/tool/cardbuilder"
              target="_blank"
              rel="noreferrer"
              style={{ color: TB.text4, textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              飞书 cardbuilder
            </a>
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 28,
        }}>
          {cards.map(({ name, data }) => (
            <div key={name}>
              <div style={{
                fontSize: 11,
                color: TB.sub,
                marginBottom: 8,
                fontFamily: TB.fontMono,
                letterSpacing: 0.3,
              }}>
                {name}.json
              </div>
              <CardKit card={data} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
