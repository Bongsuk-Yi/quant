// Claude가 쓴 work/out/report.json 검사 → 근거 목록(refs.json)과 합쳐 암호화 저장
//   node scripts/brief-pack.mjs work rep/r/2026-11-10.json.enc.json
import { readFileSync, writeFileSync } from 'node:fs';
import { sitePassword, encrypt } from './gate.mjs';
const [work = 'work', dest] = process.argv.slice(2);
let raw = readFileSync(`${work}/out/report.json`, 'utf8').trim().replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
const r = JSON.parse(raw), refs = JSON.parse(readFileSync(`${work}/refs.json`, 'utf8'));
const SEC = ['g_market', 'g_trend', 'g_insight', 'k_market', 'k_trend', 'k_insight'];
const fail = (m) => { console.log('::error::브리핑 형식 오류 — ' + m); process.exit(1); };
const items = (a, name, min) => { if (!Array.isArray(a) || a.length < min) fail(`${name} 항목 부족`); return a.map((x) => ({ text: String(x.text || '').trim(), refs: (Array.isArray(x.refs) ? x.refs : []).map(String) })).filter((x) => x.text); };
if (!r.oneLine) fail('oneLine 없음');
const known = new Set([...refs.metrics.map((m) => m.id), ...refs.news.map((n) => n.id)]);
const web = (Array.isArray(r.web) ? r.web : []).filter((w) => /^W\d+$/.test(w.id || '') && /^https?:\/\//.test(w.url || '')).map((w) => ({ id: w.id, title: String(w.title || w.url).slice(0, 160), src: String(w.src || new URL(w.url).hostname), url: w.url }));
for (const w of web) known.add(w.id);
const clean = (a) => a.map((x) => ({ ...x, refs: x.refs.filter((id) => known.has(id)) }));
const out = { v: 2, date: r.date, created: new Date().toISOString(), oneLine: String(r.oneLine).trim(), key3: clean(items(r.key3, 'key3', 3)).slice(0, 3), watch: clean(items(r.watch, 'watch', 2)),
  sections: Object.fromEntries(SEC.map((k) => [k, clean(items(r.sections?.[k], k, 1))])), signals: { good: clean(items(r.signals?.good || [], 'good', 0)), bad: clean(items(r.signals?.bad || [], 'bad', 0)) }, summary: String(r.summary || '').trim(), metrics: refs.metrics, news: refs.news, web };
const chars = JSON.stringify([out.oneLine, out.key3, out.watch, out.sections, out.summary]).length;
if (chars < 1500) fail(`내용이 너무 짧음 (${chars})`);
writeFileSync(dest, JSON.stringify(encrypt(JSON.stringify(out), sitePassword())));
console.log(`저장 ${dest} · 본문 ${chars}자 · 지표 ${out.metrics.length} · 뉴스 ${out.news.length} · 웹 ${web.length}`);
