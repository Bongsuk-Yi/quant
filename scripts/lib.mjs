// 공용 도구: HTTP 요청, 숫자 변환, 날짜, xlsx 읽기
import { inflateRawSync } from 'node:zlib';
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function get(url, { json = true, headers = {}, timeout = 25000, tries = 3, encoding, buffer } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const h = { 'User-Agent': UA, Accept: '*/*', 'Accept-Language': 'ko,en;q=0.8', ...headers };
      if (url.includes('naver.com')) h.Referer ??= 'https://m.stock.naver.com/';
      const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(timeout) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (buffer) return Buffer.from(await r.arrayBuffer());
      if (encoding) return new TextDecoder(encoding).decode(await r.arrayBuffer());
      const t = await r.text();
      return json ? JSON.parse(t) : t;
    } catch (e) { last = e; await sleep(700 * (i + 1)); }
  }
  throw new Error(`${url.slice(0, 120)} → ${last?.message}`);
}

// 실패해도 멈추지 않는 요청: 실패 목록에 남기고 null
export const failures = [];
export async function tryGet(label, url, opt) {
  try { return await get(url, opt); } catch (e) { failures.push(`${label}: ${e.message}`); console.log('  ✗', label, e.message); return null; }
}

export const num = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^0-9.\-+]/g, '');
  if (!s || s === '-' || s === '+' || s === '.') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export const kstNow = () => new Date(Date.now() + 9 * 3600e3);
export const kstDate = (d = kstNow()) => d.toISOString().slice(0, 10);
export const ymd = (s) => s.replace(/-/g, '');
export const dash = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
export function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const weekday = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();

// 간단한 RSS/Atom 파서 (제목·링크·시각·출처만)
export function parseRss(xml, source) {
  const out = [];
  const unesc = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/g)) {
    const it = m[0];
    const pick = (tag) => { const r = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return r ? unesc(r[1]) : ''; };
    let link = pick('link'); if (!link) { const r = it.match(/<link[^>]*href="([^"]+)"/); link = r ? r[1] : ''; }
    const title = pick('title'); const when = pick('pubDate') || pick('dc:date') || pick('updated') || pick('published');
    let src = source; const s2 = pick('source'); if (s2) src = s2;
    const t = Date.parse(when);
    if (title && link) out.push({ title, url: link.trim(), src, ts: Number.isFinite(t) ? t : Date.now() });
  }
  return out;
}

// xlsx(zip) 첫 시트를 행 배열로 읽는다 (외부 라이브러리 없이)
export function unzip(buf) {
  const out = new Map(), eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('zip 형식이 아님');
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen), start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28), data = buf.subarray(start, start + csize);
    out.set(name, method === 0 ? data : inflateRawSync(data)); p += 46 + nlen + elen + clen;
  }
  return out;
}
export function xlsxRows(buf) {
  const z = unzip(buf), un = (t) => String(t ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const ss = [...(z.get('xl/sharedStrings.xml')?.toString('utf8') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => un([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));
  const sheet = [...z.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  const rows = [];
  for (const r of z.get(sheet).toString('utf8').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+)\d+"/.exec(c[1])?.[1] || '', col = [...ref].reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1, t = /t="(\w+)"/.exec(c[1])?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] || '')?.[1], is = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(c[2] || '')?.[1];
      row[col < 0 ? row.length : col] = t === 's' ? ss[+v] : t === 'inlineStr' ? un(is) : un(v);
    }
    rows.push(row);
  }
  return rows;
}
