// 사이트 빌드: store.enc.json + reports/ → 화면 자료 계산 → 페이지 HTML 에 넣고 통째로 암호화 → dist/index.html
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { sitePassword, encrypt, decryptNode, gatePage, LOCK_SNIPPET } from './gate.mjs';
import { seriesSummary, flowSummary, krFearGreed, rating, temperature, anomalies, clusterNews, hotKeywords, calendar, cotSummary } from './analyze.mjs';

const root = new URL('..', import.meta.url).pathname, dist = join(root, 'dist');
const pw = sitePassword(), STORE_KEY = 'quant.pw';
const file = process.argv[2] || join(root, 'store.enc.json');
const S = existsSync(file) ? JSON.parse(decryptNode(JSON.parse(readFileSync(file, 'utf8')), pw)) : {};

const sum = seriesSummary(S), flows = flowSummary(S), krfg = krFearGreed(S);
const cnn = S.cnn ? { score: Math.round(S.cnn.now.score), rating: rating(S.cnn.now.score), prev: S.cnn.now.previous_close, w1: S.cnn.now.previous_1_week, m1: S.cnn.now.previous_1_month, y1: S.cnn.now.previous_1_year, at: S.cnn.now.timestamp, comp: S.cnn.comp, hist: S.cnn.hist.slice(-260) } : null;

// AI 브리핑 (reports 브랜치 → reports/r/*.md.enc.json)
const reports = [];
const rdir = join(root, 'reports', 'r');
if (existsSync(rdir)) for (const f of readdirSync(rdir).filter((f) => f.endsWith('.md.enc.json')).sort().reverse().slice(0, 40)) {
  try { reports.push({ id: f.replace('.md.enc.json', ''), md: decryptNode(JSON.parse(readFileSync(join(rdir, f), 'utf8')), pw) }); } catch (e) { console.warn('리포트 열기 실패', f, e.message); }
}

const D = {
  built: new Date().toISOString(), updated: S.updated, failures: S.failures || [],
  sum, flows, breadth: Object.entries(S.breadth || {}).sort().slice(-60),
  krfg, cnn, temp: temperature(sum, krfg, S.cnn), anomalies: anomalies(sum, flows),
  kr: S.kr || {}, industries: S.industries, themes: S.themes, usIndustries: S.usIndustries || [], movers: S.movers || {},
  events: clusterNews(S.news || [], 24).slice(0, 40), events3d: clusterNews(S.news || [], 72).slice(0, 120), keywords: hotKeywords(S.news || [], 24),
  news: (S.news || []).slice(0, 300).map(({ title, url, src, ts }) => ({ title, url, src, ts })),
  calendar: calendar(S), cot: cotSummary(S), insider: S.insider, reports,
};

rmSync(dist, { recursive: true, force: true }); mkdirSync(dist, { recursive: true });
const ver = Date.now().toString(36);
const css = readFileSync(join(root, 'site', 'styles.css'), 'utf8'), js = readFileSync(join(root, 'site', 'app.js'), 'utf8');
const json = JSON.stringify(D).replace(/</g, '\\u003c');
let html = readFileSync(join(root, 'site', 'index.html'), 'utf8')
  .replace('<!--CSS-->', () => `<style>${css}</style>`)
  .replace('<!--DATA-->', () => `<script id="D" type="application/json">${json}</script>`)
  .replace('<!--JS-->', () => `<script>${js}</script>`)
  .replace(/<\/body>/i, () => LOCK_SNIPPET(STORE_KEY) + '\n</body>');
writeFileSync(join(dist, 'index.html'), gatePage({ title: 'quant', mark: '🧭', storeKey: STORE_KEY, envelope: encrypt(html, pw), theme: 'light' }));
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`빌드 완료 v${ver} · 페이지 ${(html.length / 1024).toFixed(0)}KB · 계열 ${Object.keys(sum).length} · 사건 ${D.events.length} · 일정 ${D.calendar.length} · 리포트 ${reports.length} · 한국 공포탐욕 ${krfg?.score ?? '-'}`);
