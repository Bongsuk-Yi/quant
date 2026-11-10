// 종목 검색·상세용 자료와 AI 종목 분석 목록을 만든다.
//  - 종목 자료: 수급분석 모니터링(stock-monitoring) 저장소 data 브랜치의 store.enc.json (같은 비밀번호)
//  - AI 종목 분석: 이 저장소 reports 브랜치의 s/ + stock-monitoring reports 브랜치(이전에 만든 것)
// 종목별 파일은 dist/s/<코드>.enc.json, 리포트 본문은 dist/ar/<id>.enc.json 으로 따로 두고 화면에서 필요할 때 읽는다.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { encrypt, decryptNode } from './gate.mjs';

const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const r2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

export function buildStocks(file, dist, pw, K) {
  if (!existsSync(file)) { console.warn('종목 자료 없음:', file); return null; }
  let X; try { X = JSON.parse(decryptNode(JSON.parse(readFileSync(file, 'utf8')), pw)); } catch (e) { console.warn('종목 자료를 열 수 없습니다(비밀번호가 다른가요?):', e.message); return null; }
  mkdirSync(join(dist, 's'), { recursive: true });
  const list = [], KEEP = 300;
  for (const x of Object.values(X.stocks || {})) {
    const n = x.d?.length || 0; if (n < 30 || !x.c) continue;
    const c = x.c, last = c[n - 1];
    const ret = (k) => (n > k && c[n - 1 - k] > 0 ? r2((last / c[n - 1 - k] - 1) * 100) : null);
    const amt = (arr, k) => { let s = 0; for (let i = Math.max(0, n - k); i < n; i++) if (Number.isFinite(arr?.[i])) s += arr[i] * c[i]; return Math.round(s / 1e8); };
    const hi = Math.max(...x.h.slice(-252)), lo = Math.min(...x.l.slice(-252).filter((v) => v > 0));
    const v20 = mean(x.v.slice(-21, -1));
    const g = (k) => (n > k && c[n - 1 - k] > 0 ? last / c[n - 1 - k] : null);
    const rsRaw = g(252) ? 2 * g(63) + g(126) + g(189) + g(252) : null;
    list.push({ code: x.code, name: x.name, mk: x.market === 'KOSPI' ? '코스피' : '코스닥', sector: x.sector || '기타', d: x.d[n - 1], price: last, pct: ret(1), w1: ret(5), m1: ret(21), m3: ret(63), y1: ret(252),
      cap: Math.round((X.caps?.[x.code] || 0) / 1e8), f1: amt(x.frg, 1), i1: amt(x.org, 1), f5: amt(x.frg, 5), i5: amt(x.org, 5), f20: amt(x.frg, 20), i20: amt(x.org, 20),
      vr: v20 ? r2(x.v[n - 1] / v20) : null, pos: hi > lo ? Math.round((last - lo) / (hi - lo) * 100) : null, rsRaw });
    const cut = (a) => (a || []).slice(-KEEP);
    writeFileSync(join(dist, 's', `${x.code}.enc.json`), JSON.stringify(encrypt(JSON.stringify({ code: x.code, name: x.name, d: cut(x.d), o: cut(x.o), h: cut(x.h), l: cut(x.l), c: cut(x.c), v: cut(x.v), frg: cut(x.frg), org: cut(x.org) }), pw, K)));
  }
  const ranked = list.filter((s) => s.rsRaw != null).sort((a, b) => a.rsRaw - b.rsRaw);
  ranked.forEach((s, i) => { s.rs = Math.max(1, Math.min(99, Math.round(((i + 0.5) / ranked.length) * 99))); });
  for (const s of list) delete s.rsRaw;
  list.sort((a, b) => b.cap - a.cap);
  return { at: X.updated, list };
}

export function buildStockReports({ dist, pw, K, own, sm }) {
  mkdirSync(join(dist, 'ar'), { recursive: true });
  const out = new Map();
  const put = (meta, md, from) => { out.set(meta.id, { id: meta.id, market: meta.market, code: meta.code, name: meta.name, created: meta.created, chars: md.length, model: meta.model || '', from }); writeFileSync(join(dist, 'ar', `${meta.id}.enc.json`), JSON.stringify(encrypt(JSON.stringify({ md }), pw, K))); };
  try {   // 수급분석 모니터링에서 만든 리포트
    if (sm && existsSync(join(sm, 'index.enc.json'))) for (const m of JSON.parse(decryptNode(JSON.parse(readFileSync(join(sm, 'index.enc.json'), 'utf8')), pw))) {
      const f = join(sm, 'r', `${m.id}.md.enc.json`); if (existsSync(f)) put(m, decryptNode(JSON.parse(readFileSync(f, 'utf8')), pw), 'stock-monitoring');
    }
  } catch (e) { console.warn('stock-monitoring 리포트 읽기 실패:', e.message); }
  if (own && existsSync(own)) for (const f of readdirSync(own).filter((f) => f.endsWith('.json.enc.json'))) {
    try { const r = JSON.parse(decryptNode(JSON.parse(readFileSync(join(own, f), 'utf8')), pw)); put(r.meta, r.md, 'quant'); } catch (e) { console.warn('리포트 열기 실패', f, e.message); }
  }
  return [...out.values()].sort((a, b) => (a.created < b.created ? 1 : -1));
}
