// AI 브리핑용 자료 정리: store → work/brief.md (Claude가 읽는 표·목록)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { sitePassword, decryptNode } from './gate.mjs';
import { seriesSummary, flowSummary, krFearGreed, anomalies, clusterNews, calendar, cotSummary } from './analyze.mjs';

const [file = 'store.enc.json', out = 'work/brief.md'] = process.argv.slice(2);
const S = JSON.parse(decryptNode(JSON.parse(readFileSync(file, 'utf8')), sitePassword()));
const sum = seriesSummary(S), flows = flowSummary(S), krfg = krFearGreed(S);
const f = (v, d = 2) => (v == null ? '-' : (+v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
const sg = (v, d = 2) => (v == null ? '-' : `${v > 0 ? '+' : ''}${f(v, d)}`);
const L = [`# 시장 자료 (수집 ${new Date(Date.parse(S.updated) + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];

const GR = { kr: '한국 지수', us: '미국 지수', fut: '미국 선물', asia: '아시아', rate: '미국 금리', fx: '환율', risk: '위험 지표', cmd: '원자재', sector: '미국 섹터 ETF' };
for (const [g, title] of Object.entries(GR)) {
  const rows = Object.entries(sum).filter(([, s]) => s.grp === g);
  if (!rows.length) continue;
  L.push(`## ${title}`, '', '| 항목 | 거래일 | 값 | 1일 | 1주 | 1달 | 평소 대비(z) |', '|---|---|---|---|---|---|---|');
  for (const [, s] of rows) {
    const r = g === 'rate';
    L.push(`| ${s.name} | ${s.d} | ${r ? f(s.c, 3) + '%' : f(s.c)} | ${r ? sg(s.chg * 100, 1) + 'bp' : sg(s.pct) + '%'} | ${r ? sg(s.w1 * 100, 0) + 'bp' : sg(s.w1) + '%'} | ${r ? sg(s.m1 * 100, 0) + 'bp' : sg(s.m1) + '%'} | ${s.z ?? '-'} |`);
  }
  L.push('');
}
L.push('## 한국 투자자별 순매수 (억원)', '', '| 시장 | 기준일 | 외국인 | 기관 | 개인 | 외국인 5일 | 기관 5일 | 외국인 20일 |', '|---|---|---|---|---|---|---|---|');
for (const mk of ['KOSPI', 'KOSDAQ']) { const x = flows[mk]; if (x?.last) L.push(`| ${mk} | ${x.last.d} | ${sg(x.last.f, 0)} | ${sg(x.last.i, 0)} | ${sg(x.last.p, 0)} | ${sg(x.sum[5].f, 0)} | ${sg(x.sum[5].i, 0)} | ${sg(x.sum[20].f, 0)} |`); }
const b = Object.entries(S.breadth || {}).sort().at(-1);
if (b) L.push('', `- 오른 종목 ${b[1].up} · 내린 종목 ${b[1].down} · 보합 ${b[1].flat} (${b[0]}, 코스피+코스닥)`);
L.push('', '## 공포·탐욕', '', `- 미국 CNN: ${S.cnn ? `${Math.round(S.cnn.now.score)} (${S.cnn.now.rating}), 1주 전 ${Math.round(S.cnn.now.previous_1_week)}, 1달 전 ${Math.round(S.cnn.now.previous_1_month)}` : '자료 없음'}`,
  `- 한국(이 사이트 자체 계산): ${krfg ? `${krfg.score} (${krfg.rating}), 1주 전 ${krfg.w1 ?? '-'}, 1달 전 ${krfg.m1 ?? '-'} · 구성: ${krfg.comp.map((c) => `${c.name} ${c.score}`).join(', ')}` : '자료 없음'}`, '');
const an = anomalies(sum, flows);
L.push('## 평소와 크게 다른 움직임 (|z|≥2)', '', ...(an.length ? an.map((a) => `- ${a.text} (${a.d}, ${a.note})`) : ['- 없음']), '');
const top = (list, n, dir) => [...(list || [])].sort((a, c) => dir * (c.pct - a.pct)).slice(0, n).map((g) => `${g.name} ${sg(g.pct)}%${g.lead ? ` (대표 ${g.lead.name} ${sg(g.lead.pct, 1)}%)` : ''}`).join(' / ');
L.push('## 한국 테마', '', `- 상승 상위: ${top(S.themes?.list, 6, 1)}`, `- 하락 상위: ${top(S.themes?.list, 6, -1)}`, '', '## 미국 업종(대형주 평균)', '', `- 상승: ${top(S.usIndustries, 5, 1)}`, `- 하락: ${top(S.usIndustries, 5, -1)}`, '');
const mv = (rows, us) => (rows || []).slice(0, 8).map((r) => `${r.name}(${r.code}) ${sg(r.pct)}%`).join(', ');
L.push('## 움직인 종목', '', `- 한국 급등: ${mv(S.movers?.kr?.up)}`, `- 한국 급락: ${mv(S.movers?.kr?.down)}`, `- 미국 대형주 급등: ${mv(S.movers?.us?.up)}`, `- 미국 대형주 급락: ${mv(S.movers?.us?.down)}`, '');
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const cal = calendar(S).filter((r) => r.imp >= 2 && r.d >= today).slice(0, 25);
L.push('## 앞으로 일정 (한국 시간)', '', ...cal.map((r) => `- ${r.d} ${r.time || ''} ${r.c} ${r.name}${r.cons ? ` (예상 ${r.cons}, 이전 ${r.prev})` : ''}`), '');
const past = calendar(S).filter((r) => r.kind === 'econ' && r.act && r.d < today && r.d >= new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10) && r.imp >= 2);
if (past.length) L.push('## 최근 발표된 지표', '', ...past.map((r) => `- ${r.d} ${r.c} ${r.name}: 발표 ${r.act} / 예상 ${r.cons || '-'} / 이전 ${r.prev || '-'}`), '');
L.push('## 선물 투기 포지션 (CFTC)', '', ...cotSummary(S).map((c) => `- ${c.name} (${c.d}): 순 ${f(c.net, 0)}계약, 전주 대비 ${sg(c.chg, 0)}, 3년 범위 위치 ${c.idx ?? '-'}`), '');
const ev = clusterNews(S.news || [], 18).slice(0, 25);
L.push('## 최근 18시간 주요 사건 (기사 제목·매체·링크, 여러 매체가 다룬 순)', '');
for (const e of ev) { L.push(`- ${e.title} — ${e.srcs.slice(0, 4).join(', ')} (${e.n}건)`); for (const x of e.items.slice(0, 2)) L.push(`  - [${x.src}] ${x.url}`); }
mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
writeFileSync(out, L.join('\n') + '\n');
console.log('저장', out, L.length + '줄');
