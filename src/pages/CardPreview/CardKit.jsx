/**
 * 飞书 CardKit JSON → React 本地渲染器（近似还原，非官方引擎）
 * 支持我们实际会用到的 tag 子集：
 *   - card 壳（schema 2.0）
 *   - header（title / subtitle / icon / template）
 *   - config.summary（作为 header 下方一行灰字）
 *   - markdown（含内联 <text_tag> / <font> / **bold**）
 *   - plain_text / div / hr
 *   - collapsible_panel（可点击展开收起，+ icon 旋转）
 *   - interactive_container（border / radius / padding / bg）
 */

import { useState } from 'react';
import { COLOR_HEX, COLOR_BG, HEADER_TEMPLATE, ICON_MAP, TEXT_SIZE, TB } from './tokens.js';

// ─── markdown → HTML（最小可用子集）─────────────────────────

function escapeHtml(s) {
  // 只 escape 掉我们不认识的 < > & — 保留已写入的 <text_tag>/<font> 等
  return s;
}

function mdToHtml(md) {
  if (!md) return '';
  let html = md;

  // <text_tag color='X'>Y</text_tag> → 彩色小徽标（TeamBoard pill 风格）
  html = html.replace(
    /<text_tag\s+color=['"]?(\w+)['"]?>([\s\S]*?)<\/text_tag>/g,
    (_, color, content) => {
      const bg = COLOR_BG[`${color}-50`] || TB.bgCard;
      const fg = COLOR_HEX[color] || TB.text2;
      return `<span style="display:inline-block;padding:1px 7px;border-radius:4px;background:${bg};color:${fg};font-size:11px;font-weight:500;line-height:1.6;margin:0 2px;vertical-align:middle;font-family:${TB.fontMono};">${content}</span>`;
    }
  );

  // <font color='X'>Y</font>
  html = html.replace(
    /<font\s+color=['"]?(\w+)['"]?>([\s\S]*?)<\/font>/g,
    (_, color, content) => `<span style="color:${COLOR_HEX[color] || color};">${content}</span>`
  );

  // **bold** — TeamBoard 标题常用 mono
  html = html.replace(/\*\*([\s\S]+?)\*\*/g, `<strong style="font-family:${TB.fontMono};color:${TB.text};">$1</strong>`);
  html = html.replace(/(?<!\*)\*(?!\*)([^\n*]+?)\*(?!\*)/g, '<em>$1</em>');

  // `code`
  html = html.replace(/`([^`\n]+)`/g, `<code style="background:${TB.bgCard};padding:1px 5px;border-radius:3px;font-size:12px;color:${TB.text};font-family:${TB.fontMono};">$1</code>`);

  // \n\n → 段落间隙；\n → <br/>
  html = html
    .split(/\n\n+/)
    .map(p => p.replace(/\n/g, '<br/>'))
    .map(p => `<p style="margin:0 0 6px 0;">${p}</p>`)
    .join('');

  return html;
}

// ─── 小工具 ─────────────────────────

function resolveBg(value) {
  if (!value) return 'transparent';
  if (value === 'default') return '#FFFFFF';
  if (COLOR_BG[value]) return COLOR_BG[value];
  if (COLOR_HEX[value]) return COLOR_HEX[value];
  return value;   // 允许直接传 hex
}

function resolveBorderColor(value) {
  if (!value) return TB.border;
  if (COLOR_BG[value]) return COLOR_BG[value];
  if (COLOR_HEX[value]) return COLOR_HEX[value];
  return value;
}

function RenderIcon({ icon, fallbackSize = 16 }) {
  if (!icon) return null;
  const Comp = ICON_MAP[icon.token];
  const size = icon.size ? parseInt(String(icon.size).split(/\s+/)[0], 10) || fallbackSize : fallbackSize;
  const color = COLOR_HEX[icon.color] || TB.text4;
  if (!Comp) {
    return (
      <span style={{
        fontSize: 9, color: TB.sub, fontFamily: TB.fontMono,
        border: `1px dashed ${TB.borderMd}`, padding: '0 4px', borderRadius: 3,
      }}>
        {icon.token}
      </span>
    );
  }
  return <Comp size={size} color={color} strokeWidth={1.6} />;
}

// ─── Element 分发 ─────────────────────────

function Markdown({ content, textSize }) {
  const size = TEXT_SIZE[textSize] || 14;
  const color = textSize === 'notation' ? TB.text4 : TB.text2;
  return (
    <div
      style={{
        fontSize: size,
        lineHeight: 1.65,
        color,
        wordBreak: 'break-word',
        fontFamily: TB.fontSans,
      }}
      dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
    />
  );
}

function CollapsiblePanel({ element }) {
  const [expanded, setExpanded] = useState(element.expanded !== false);
  const borderColor = resolveBorderColor(element.border?.color);
  const cornerRadius = element.border?.corner_radius || '8px';
  const bg = resolveBg(element.background_color);

  const headerTitle = element.header?.title;
  const icon = element.header?.icon;
  const angle = element.header?.icon_expanded_angle ?? -180;

  return (
    <div style={{
      background: bg,
      border: element.border ? `1px solid ${borderColor}` : 'none',
      borderRadius: cornerRadius,
      padding: element.padding || 0,
      margin: element.margin || 0,
      transition: 'all 0.2s',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: element.header?.padding || 0,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {headerTitle?.tag === 'markdown' ? (
            <Markdown content={headerTitle.content} textSize="notation" />
          ) : (
            <span style={{ fontSize: 13, color: TB.text2, fontFamily: TB.fontSans }}>{headerTitle?.content}</span>
          )}
        </div>
        {icon && (
          <div style={{
            transform: expanded ? `rotate(${angle}deg)` : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
            display: 'flex', alignItems: 'center', marginLeft: 8,
          }}>
            <RenderIcon icon={icon} fallbackSize={12} />
          </div>
        )}
      </div>
      {expanded && element.elements?.length > 0 && (
        <div style={{ paddingTop: 4 }}>
          {element.elements.map((el, i) => <Element key={i} element={el} />)}
        </div>
      )}
    </div>
  );
}

function InteractiveContainer({ element }) {
  const bg = resolveBg(element.background_style);
  const borderColor = resolveBorderColor(element.border_color);
  return (
    <div style={{
      background: bg,
      border: element.has_border ? `1px solid ${borderColor}` : 'none',
      borderRadius: element.corner_radius || 0,
      padding: element.padding || 0,
      margin: element.margin || 0,
    }}>
      {element.elements?.map((el, i) => <Element key={i} element={el} />)}
    </div>
  );
}

function Element({ element }) {
  if (!element || !element.tag) return null;
  switch (element.tag) {
    case 'markdown':
      return <Markdown content={element.content} textSize={element.text_size} />;
    case 'plain_text':
      return <div style={{ fontSize: 14, color: TB.text2, fontFamily: TB.fontSans }}>{element.content}</div>;
    case 'div':
      return <Markdown content={element.text?.content || ''} textSize={element.text?.text_size} />;
    case 'hr':
      return <hr style={{
        border: 'none',
        borderTop: `1px solid ${TB.border}`,
        margin: element.margin || '8px 0',
      }} />;
    case 'collapsible_panel':
      return <CollapsiblePanel element={element} />;
    case 'interactive_container':
      return <InteractiveContainer element={element} />;
    default:
      return (
        <div style={{
          padding: 8, background: '#FEF2F2', color: '#991B1B',
          fontSize: 11, fontFamily: 'ui-monospace, monospace', borderRadius: 4,
        }}>
          unsupported tag: {element.tag}
        </div>
      );
  }
}

// ─── Header + Card 壳 ─────────────────────────

function Header({ header }) {
  const template = HEADER_TEMPLATE[header.template] || HEADER_TEMPLATE.default;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 14px',
      background: template.bg,
      borderBottom: `1px solid ${template.border}`,
    }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <RenderIcon icon={header.icon} fallbackSize={18} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          fontSize: 15,
          fontWeight: 700,
          color: TB.text,
          lineHeight: 1.2,
          fontFamily: TB.fontMono,
          letterSpacing: 0.3,
        }}>
          {header.title?.content}
        </div>
        {header.subtitle && (
          <div style={{
            fontSize: 11.5,
            color: TB.text4,
            marginTop: 2,
            fontFamily: TB.fontSans,
            letterSpacing: 0.2,
          }}>
            {header.subtitle.content}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CardKit({ card }) {
  if (!card || card.schema !== '2.0') {
    return (
      <div style={{ padding: 12, color: '#991B1B', fontSize: 12 }}>
        非 schema 2.0 卡片
      </div>
    );
  }
  const summaryContent = card.config?.summary?.content;
  return (
    <div style={{
      background: TB.bgModal,
      border: `1px solid ${TB.border}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: TB.shadow,
    }}>
      {card.header && <Header header={card.header} />}
      {summaryContent && (
        <div style={{
          padding: '5px 14px',
          background: 'rgba(0,0,0,0.015)',
          color: TB.sub,
          fontSize: 10.5,
          borderBottom: `1px solid ${TB.border}`,
          fontStyle: 'italic',
          letterSpacing: 0.2,
          fontFamily: TB.fontMono,
        }}>
          summary · {summaryContent}
        </div>
      )}
      <div style={{ padding: '14px 16px' }}>
        {card.body?.elements?.map((el, i) => <Element key={i} element={el} />)}
      </div>
    </div>
  );
}
