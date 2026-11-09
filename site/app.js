'use strict';
const D = JSON.parse(document.getElementById('D').textContent);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

/* ── 숫자 표시 ── */
const fmt = (v, d = 0) => (v == null || !Number.isFinite(+v) ? '-' : (+v).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const cls = (v) => (v == null ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
const sgn = (v, d = 2, unit = '%') => (v == null ? '-' : `${v > 0 ? '+' : ''}${fmt(v, d)}${unit}`);
const tri = (v) => (v > 0 ? '▲' : v < 0 ? '▼' : '');
const md = (iso) => (iso ? `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}` : '');
const ymdDash = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const WD = '일월화수목금토';
const kstNow = () => new Date(Date.now() + 9 * 3600e3);
const todayISO = () => kstNow().toISOString().slice(0, 10);
function ago(ts) { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`; }
function kstTime(iso) { if (!iso) return ''; const d = new Date(Date.parse(iso) + 9 * 3600e3); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; }
const eok = (v) => (v == null ? '-' : Math.abs(v) >= 10000 ? `${v > 0 ? '+' : ''}${fmt(v / 10000, 2)}조원` : `${v > 0 ? '+' : ''}${fmt(v)}억원`);
function valText(s) {
  if (!s) return '-';
  if (s.grp === 'rate') return `${fmt(s.c, 3)}%`;
  if (s.grp === 'fx' || s.grp === 'cmd' || s.grp === 'risk' || s.grp === 'sector') return fmt(s.c, s.c >= 1000 ? 0 : 2);
  return fmt(s.c, 2);
}
function chgText(s) { if (!s) return '-'; return s.grp === 'rate' ? `${s.chg > 0 ? '+' : ''}${fmt(s.chg * 100, 1)}bp` : sgn(s.pct); }
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2200); }

/* ── 그림 ── */
function spark(arr, color) {
  if (!arr || arr.length < 2) return '<svg></svg>';
  const w = 160, h = 34, lo = Math.min(...arr), hi = Math.max(...arr), r = hi - lo || 1;
  const pts = arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - 3 - ((v - lo) / r) * (h - 6)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}
// series: [{name,color,pts:[[label,value]]}]  — x는 순서(같은 길이 가정 안 함, 날짜로 맞춤)
function lineChart(series, { h = 200, zero = false, yfmt = (v) => fmt(v, 1), band } = {}) {
  const all = series.flatMap((s) => s.pts.map((p) => p[1])).filter((v) => v != null);
  if (!all.length) return '<p class="note">자료가 아직 없습니다.</p>';
  const dates = [...new Set(series.flatMap((s) => s.pts.map((p) => p[0])))].sort();
  const W = 640, L = 46, R = 8, T = 8, B = 20, iw = W - L - R, ih = h - T - B;
  let lo = Math.min(...all), hi = Math.max(...all); if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); } if (band) { lo = Math.min(lo, band[0]); hi = Math.max(hi, band[1]); }
  const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
  const xi = new Map(dates.map((d, i) => [d, i])), X = (d) => L + (dates.length > 1 ? (xi.get(d) / (dates.length - 1)) * iw : iw / 2), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * ih;
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4, y = Y(v); g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 5}" y="${y + 3}" text-anchor="end">${yfmt(v)}</text>`; }
  if (zero && lo < 0 && hi > 0) g += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#adb5bd" stroke-dasharray="3 3"/>`;
  const lab = [0, Math.floor((dates.length - 1) / 2), dates.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  for (const i of lab) g += `<text x="${X(dates[i])}" y="${h - 5}" text-anchor="${i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}">${esc(String(dates[i]).slice(2))}</text>`;
  for (const s of series) {
    const p = s.pts.filter((q) => q[1] != null).map((q) => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ');
    if (s.bar) { const bw = Math.max(1, iw / dates.length - 1); g += s.pts.map((q) => `<rect x="${X(q[0]) - bw / 2}" y="${Math.min(Y(0), Y(q[1]))}" width="${bw}" height="${Math.abs(Y(q[1]) - Y(0))}" fill="${q[1] >= 0 ? '#d6336c' : '#1c7ed6'}" opacity=".55"/>`).join(''); }
    else g += `<polyline points="${p}" fill="none" stroke="${s.color}" stroke-width="${s.w || 1.8}"/>`;
  }
  const leg = series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return leg + `<svg class="chart" viewBox="0 0 ${W} ${h}">${g}</svg>`;
}
function gauge(score, label, sub, hist) {
  if (score == null) return `<div class="gauge"><div class="lb">${esc(label)}</div><p class="note">자료 없음</p></div>`;
  const a = Math.PI * (1 - score / 100), cx = 120, cy = 110, r = 90;
  const arc = (from, to, c) => { const p = (t) => [cx + r * Math.cos(Math.PI * (1 - t / 100)), cy - r * Math.sin(Math.PI * (1 - t / 100))]; const [x1, y1] = p(from), [x2, y2] = p(to); return `<path d="M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}" stroke="${c}" stroke-width="16" fill="none"/>`; };
  const col = score < 25 ? '#1c7ed6' : score < 45 ? '#74c0fc' : score <= 55 ? '#adb5bd' : score <= 75 ? '#faa2c1' : '#d6336c';
  const rt = score < 25 ? '극단적 공포' : score < 45 ? '공포' : score <= 55 ? '중립' : score <= 75 ? '탐욕' : '극단적 탐욕';
  return `<div class="gauge"><div class="lb">${esc(label)}</div>
    <svg viewBox="0 0 240 125">${arc(0, 25, '#1c7ed6')}${arc(25, 45, '#74c0fc')}${arc(45, 55, '#dee2e6')}${arc(55, 75, '#faa2c1')}${arc(75, 100, '#d6336c')}
    <line x1="${cx}" y1="${cy}" x2="${cx + (r - 22) * Math.cos(a)}" y2="${cy - (r - 22) * Math.sin(a)}" stroke="#1b1f24" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="#1b1f24"/>
    <text x="22" y="122" font-size="10" fill="#9aa1ab">공포</text><text x="218" y="122" font-size="10" fill="#9aa1ab" text-anchor="end">탐욕</text></svg>
    <div class="sc n" style="color:${col}">${Math.round(score)}</div><div class="rt" style="color:${col}">${rt}</div>
    ${hist ? `<div class="hs">${hist}</div>` : ''}${sub ? `<div class="hs">${sub}</div>` : ''}</div>`;
}

/* ── 마크다운 (리포트용, 링크·표·목록·강조) ── */
function mdRender(src) {
  const inline = (t) => esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const lines = src.replace(/\r/g, '').split('\n'); let out = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { const n = Math.min(3, m[1].length); out += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
    if (/^---+\s*$/.test(l)) { out += '<hr>'; i++; continue; }
    if (/^\s*\|/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const row = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const hd = row(l); i += 2; let body = '';
      while (i < lines.length && /^\s*\|/.test(lines[i])) { body += `<tr>${row(lines[i]).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`; i++; }
      out += `<table><thead><tr>${hd.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`; continue;
    }
    if (/^\s*>/.test(l)) { let q = ''; while (i < lines.length && /^\s*>/.test(lines[i])) { q += inline(lines[i].replace(/^\s*>\s?/, '')) + '<br>'; i++; } out += `<blockquote>${q}</blockquote>`; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ol = /^\s*\d+\./.test(l); let items = '';
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items += `<li>${inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`; i++; }
      out += ol ? `<ol>${items}</ol>` : `<ul>${items}</ul>`; continue;
    }
    let p = ''; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*]\s|\s*\d+\.\s|\s*\||\s*>|---)/.test(lines[i])) { p += (p ? ' ' : '') + lines[i].trim(); i++; }
    out += `<p>${inline(p)}</p>`;
  }
  return out;
}

/* ── 공통 조각 ── */
const S = D.sum || {};
const GROUPS = [
  ['kr', '한국', ['KOSPI', 'KOSDAQ', 'KPI200']], ['us', '미국', ['SPX', 'NDX', 'DJI', 'RUT', 'SOX', 'ES', 'NQ']], ['asia', '아시아', ['N225', 'SSEC', 'HSI', 'TWII']],
  ['rate', '금리', ['US3M', 'US5Y', 'US10Y', 'US30Y']], ['fx', '환율', ['USDKRW', 'JPYKRW', 'EURKRW', 'CNYKRW', 'DXY', 'USDJPY']],
  ['risk', '위험 지표', ['VIX', 'MOVE', 'HYG', 'BTC']], ['cmd', '원자재', ['WTI', 'BRENT', 'GOLD', 'SILVER', 'COPPER', 'NATGAS']],
];
function tile(k) {
  const s = S[k]; if (!s) return '';
  const c = s.grp === 'rate' ? s.chg : s.pct;
  const color = c > 0 ? '#d6336c' : c < 0 ? '#1c7ed6' : '#868e96';
  return `<div class="tile" data-k="${k}"><div class="nm">${esc(s.name)}</div><div class="dt">${md(s.d)}</div>
    <div class="v n">${valText(s)}</div><div class="c n ${cls(c)}">${tri(c)} ${chgText(s)}</div>${spark(s.spark, color)}</div>`;
}
function openSeries(k) {
  const s = S[k]; if (!s) return;
  const rows = [['1주', s.w1], ['1달', s.m1], ['1년', s.y1]].map(([l, v]) => `<span class="kv">${l} <b class="${cls(v)}">${s.grp === 'rate' ? (v == null ? '-' : `${v > 0 ? '+' : ''}${fmt(v * 100, 0)}bp`) : sgn(v)}</b></span>`).join(' · ');
  modal(`${esc(s.name)} <small>${esc(s.src)} · ${s.d}</small>`, `<div class="row"><b class="n" style="font-size:22px">${valText(s)}</b><span class="n ${cls(s.grp === 'rate' ? s.chg : s.pct)}">${chgText(s)}</span></div><div class="row">${rows}</div>${lineChart([{ name: s.name, color: '#3b5bdb', pts: s.hist }], { h: 240, yfmt: (v) => fmt(v, s.c < 100 ? 2 : 0) })}`);
}
function modal(title, body) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div><h3><span>${title}</span><button class="x" aria-label="닫기">×</button></h3>${body}</div>`;
  m.addEventListener('click', (e) => { if (e.target === m || e.target.classList.contains('x')) m.remove(); });
  document.body.appendChild(m);
}
function evRow(e, i, open = false) {
  const lead = e.items[0];
  return `<div class="ev"><div class="rk">${i + 1}</div><div class="tt"><a href="${esc(lead.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a></div>
    <span class="cnt">${e.n > 1 ? `기사 ${e.n}건` : esc(lead.src)}</span>
    <div class="meta">${ago(e.ts)} · ${e.srcs.slice(0, 5).map(esc).join(', ')}${e.srcs.length > 5 ? ` 외 ${e.srcs.length - 5}` : ''}</div>
    ${open && e.items.length > 1 ? `<div class="srcs">${e.items.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(x.src)}</b>${esc(x.title)}</a>`).join('')}</div>` : ''}</div>`;
}
function calRows(rows, { limit = 999, minImp = 1 } = {}) {
  let out = '', lastD = '', n = 0;
  for (const r of rows) {
    if (r.imp < minImp) continue; if (n++ >= limit) break;
    if (r.d !== lastD) { const d = new Date(r.d + 'T00:00:00Z'); out += `<tr class="dh"><td colspan="3">${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WD[d.getUTCDay()]})${r.d === todayISO() ? ' · 오늘' : ''}</td></tr>`; lastD = r.d; }
    const kv = r.kind === 'econ' ? [['발표', r.act], ['예상', r.cons], ['이전', r.prev]].filter((x) => x[1]).map(([a, b]) => `<span class="kv">${a} <b>${esc(b)}</b></span>`).join(' ') : r.kind === 'earn' && r.eps ? `<span class="kv">EPS 예상 <b>${esc(r.eps)}</b></span>` : '';
    out += `<tr><td class="dt n">${esc(r.time || '')}</td><td><span class="imp i${r.imp}"></span>${esc(r.c)} · ${esc(r.name)}</td><td style="text-align:right">${kv}</td></tr>`;
  }
  return out ? `<div class="tw"><table class="cal">${out}</table></div>` : '<p class="note">예정된 일정이 없습니다.</p>';
}
const krLink = (code) => `https://m.stock.naver.com/domestic/stock/${code}/total`;
const usLink = (sym) => `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
function moverRow(r, us) {
  return `<a class="mv" href="${us ? usLink(r.code) : krLink(r.code)}" target="_blank" rel="noopener noreferrer"><span class="nm">${esc(r.name)}</span>
    <span class="sm">${esc(r.code)} · ${esc(us ? r.ex : r.mk)} · ${us ? '$' + fmt(r.price, 2) : fmt(r.price) + '원'}${r.limit ? '<span class="pill lim">가격제한</span>' : ''}</span><span class="p n ${cls(r.pct)}">${sgn(r.pct)}</span></a>`;
}
function themeRow(g) {
  const ld = g.lead ? `${esc(g.lead.name)} ${sgn(g.lead.pct)}` : g.n ? `${g.n}종목 · 오름 ${g.up ?? '-'} 내림 ${g.down ?? '-'}` : '';
  return `<div class="th"><span class="nm">${esc(g.name)}</span><span class="p n ${cls(g.pct)}">${sgn(g.pct)}</span><span class="ld">${ld}</span></div>`;
}

/* ── 화면 ── */
const VIEW = {};
const state = { tab: 'home', tileGrp: lsGet('q.tile', 'kr'), mvRegion: 'kr', thRegion: 'kr', mkt: 'fg', newsSrc: '', kw: '', report: 0, calKind: '' };

VIEW.home = () => {
  const now = kstNow(), mm = now.getUTCMonth() + 1, dd = now.getUTCDate();
  $('#title').textContent = `${mm}월 ${dd}일 ${WD[now.getUTCDay()]}요일 브리핑`;
  const ev = D.events.slice(0, 6).map((e, i) => evRow(e, i)).join('') || '<p class="note">최근 24시간 기사가 없습니다.</p>';
  const t0 = todayISO(), wk = D.calendar.filter((r) => r.d >= t0 && r.d <= addDays(t0, 7));
  const k = D.kr.KOSPI, q = D.kr.KOSDAQ, fl = D.flows;
  const krClose = [['코스피', S.KOSPI, k, fl.KOSPI], ['코스닥', S.KOSDAQ, q, fl.KOSDAQ]].map(([nm, s, b, f]) => s ? `<div style="border-left-color:${s.pct >= 0 ? '#d6336c' : '#1c7ed6'}"><div class="nm">${nm} <small>${md(s.d)}</small></div><div class="v n">${fmt(s.c, 2)}</div><div class="n ${cls(s.pct)}">${tri(s.pct)} ${sgn(s.pct)}</div>${f?.last ? `<div class="sm muted">외국인 ${eok(f.last.f)} · 기관 ${eok(f.last.i)}</div>` : ''}</div>` : '').join('');
  const usClose = ['SPX', 'NDX', 'DJI', 'SOX'].map((x) => S[x] ? `<div style="border-left-color:${S[x].pct >= 0 ? '#d6336c' : '#1c7ed6'}"><div class="nm">${esc(S[x].name)} <small>${md(S[x].d)}</small></div><div class="v n">${fmt(S[x].c, 2)}</div><div class="n ${cls(S[x].pct)}">${tri(S[x].pct)} ${sgn(S[x].pct)}</div></div>` : '').join('');
  const rep = D.reports[0];
  const an = D.anomalies.length ? D.anomalies.slice(0, 8).map((a) => `<div class="an"><span class="tg">${{ kr: '한국', us: '미국', asia: '아시아', fut: '선물', rate: '금리', fx: '환율', risk: '위험', cmd: '원자재', flow: '수급' }[a.grp] || ''}</span><span class="${a.z > 0 ? 'up' : 'down'}">${esc(a.text)}</span><span class="nt">${md(a.d)} · ${esc(a.note)}</span></div>`).join('') : '<p class="note">최근 거래일에 평소 범위를 크게 벗어난 움직임은 없었습니다.</p>';
  const th = D.themes?.list || [], usi = D.usIndustries || [];
  const thList = state.thRegion === 'kr' ? th : usi;
  const thSorted = [...thList].sort((a, b) => b.pct - a.pct);
  const mv = state.mvRegion === 'kr' ? D.movers.kr : D.movers.us;
  const krfg = D.krfg, cnn = D.cnn;
  return `
  <section class="card c8"><h2>밤사이 큰 사건 <button class="more" data-go="news">뉴스 더 보기 ›</button></h2><p class="sub">최근 24시간 · 여러 매체가 다룬 사건 순 · 비슷한 기사는 하나로 묶음</p>${ev}</section>
  <section class="card c4"><h2>오늘·이번 주 일정 <button class="more" data-go="cal">전체 일정 ›</button></h2><p class="sub">한국 시간 · 주요 지표, 옵션 만기, 대형주 실적</p>${calRows(wk, { limit: 12, minImp: 2 })}</section>
  <section class="card c6"><h2>지난 장 마감</h2><p class="sub">한국 ${k?.at ? kstTime(k.at) : '-'} · 미국 ${S.SPX ? md(S.SPX.d) : '-'}</p>
    <h3 style="margin-top:0">한국</h3><div class="idx">${krClose}</div><h3>미국</h3><div class="idx">${usClose}</div></section>
  <section class="card c6"><h2>AI 아침 브리핑 ${rep ? `<button class="more" data-go="ai">전체 리포트 ›</button>` : ''}</h2><p class="sub">Claude가 이 사이트의 시장 자료와 뉴스로 쓴 요약입니다</p>
    ${rep ? `<div class="md fade">${mdRender(rep.md)}</div>` : '<p class="note">아직 브리핑이 없습니다. 평일 아침 6시 50분쯤 자동으로 만들어집니다.</p>'}</section>
  <section class="card c6"><h2>평소와 크게 다른 것</h2><p class="sub">최근 거래일 하루 변화가 지난 60일 평소 변동의 2배를 넘은 것 · 지수·금리·환율·원자재·수급</p>${an}</section>
  <section class="card c6"><h2>시장 기분 <button class="more" data-go="market" data-sub="fg">자세히 ›</button></h2><p class="sub">0에 가까울수록 공포, 100에 가까울수록 탐욕</p>
    <div class="gauges">${gauge(cnn?.score, '미국 · CNN 공포탐욕', cnn ? `1주 전 ${Math.round(cnn.w1)} · 1달 전 ${Math.round(cnn.m1)}` : '')}${gauge(krfg?.score, '한국 · 자체 계산', krfg ? `1주 전 ${krfg.w1 ?? '-'} · 1달 전 ${krfg.m1 ?? '-'}` : '')}</div>
    <h3>시장 체온</h3><div class="sm"><b>한국</b> ${D.temp.kr.map(esc).join(' · ')}</div><div class="sm" style="margin-top:4px"><b>미국</b> ${D.temp.us.map(esc).join(' · ')}</div></section>
  <section class="card"><h2>시장 숫자 <span class="seg" id="tg">${GROUPS.map(([g, n]) => `<button data-g="${g}" class="${state.tileGrp === g ? 'on' : ''}">${n}</button>`).join('')}</span></h2><p class="sub">칸마다 오른쪽 위 날짜가 그 값의 거래일 · 선은 최근 석 달 · 누르면 1년 차트</p>
    <div class="tiles">${(GROUPS.find((x) => x[0] === state.tileGrp) || GROUPS[0])[2].map(tile).join('')}${state.tileGrp === 'kr' ? krExtraTiles() : ''}${state.tileGrp === 'rate' ? spreadTile() : ''}</div></section>
  <section class="card c6"><h2>오늘 많이 오른·내린 ${state.thRegion === 'kr' ? '테마' : '업종'} <span class="seg" id="thr"><button data-r="kr" class="${state.thRegion === 'kr' ? 'on' : ''}">한국</button><button data-r="us" class="${state.thRegion === 'us' ? 'on' : ''}">미국</button></span><button class="more" data-go="market" data-sub="sector">업종 전체 ›</button></h2>
    <p class="sub">${state.thRegion === 'kr' ? '하루 등락 · 작은 글씨는 그날 가장 크게 움직인 대표 종목' : '미국 시가총액 상위 600종목을 업종별로 묶은 평균 등락'}</p>
    <div class="thm"><div>${thSorted.slice(0, 6).map(themeRow).join('')}</div><div>${thSorted.slice(-6).reverse().map(themeRow).join('')}</div></div></section>
  <section class="card c6"><h2>움직인 종목 <span class="seg" id="mvr"><button data-r="kr" class="${state.mvRegion === 'kr' ? 'on' : ''}">한국</button><button data-r="us" class="${state.mvRegion === 'us' ? 'on' : ''}">미국</button></span><button class="more" data-go="market" data-sub="movers">더 보기 ›</button></h2>
    <p class="sub">${state.mvRegion === 'kr' ? 'KRX 보통주 · 1,000원·거래대금 10억원 이상' : '나스닥·뉴욕 시가총액 상위 각 300종목'}</p>
    <div class="thm"><div>${(mv?.up || []).slice(0, 5).map((r) => moverRow(r, state.mvRegion === 'us')).join('')}</div><div>${(mv?.down || []).slice(0, 5).map((r) => moverRow(r, state.mvRegion === 'us')).join('')}</div></div></section>
  <section class="card"><p class="note" style="margin:0">정보 제공 목적의 개인용 자료이며 투자 권유가 아닙니다. 출처: 네이버 증권, Yahoo Finance, CNN, Nasdaq, CFTC, OpenInsider, 각 언론사. 기사 제목과 링크만 모으며 본문은 원문에서 확인하세요.</p></section>`;
};
function krExtraTiles() {
  const b = D.breadth.at(-1), f = D.flows.KOSPI?.last, f2 = D.flows.KOSDAQ?.last;
  let h = '';
  if (b) h += `<div class="tile"><div class="nm">오른·내린 종목 수</div><div class="dt">${md(ymdDash(b[0]))}</div><div class="v n"><span class="up">${fmt(b[1].up)}</span> / <span class="down">${fmt(b[1].down)}</span></div><div class="c muted">보합 ${fmt(b[1].flat)} · 코스피+코스닥</div>${spark(D.breadth.map((x) => x[1].up / Math.max(1, x[1].up + x[1].down)), '#868e96')}</div>`;
  if (f) h += `<div class="tile" data-go2="flow"><div class="nm">외국인·기관 순매수</div><div class="dt">${md(ymdDash(f.d))}</div><div class="v n" style="font-size:15px">외 <span class="${cls(f.f)}">${eok(f.f)}</span></div><div class="c n">기관 <span class="${cls(f.i)}">${eok(f.i)}</span> <span class="muted">코스피</span></div>${f2 ? `<div class="c n muted">코스닥 외 ${eok(f2.f)} · 기 ${eok(f2.i)}</div>` : ''}</div>`;
  return h;
}
function spreadTile() {
  const a = S.US10Y?.hist, b = S.US3M?.hist; if (!a || !b) return '';
  const m = new Map(b); const pts = a.filter((x) => m.has(x[0])).map((x) => [x[0], +(x[1] - m.get(x[0])).toFixed(3)]);
  const last = pts.at(-1), prev = pts.at(-2); if (!last) return '';
  const c = prev ? last[1] - prev[1] : 0;
  return `<div class="tile"><div class="nm">장단기 금리차 (10년−3개월)</div><div class="dt">${md(last[0])}</div><div class="v n">${fmt(last[1] * 100, 0)}bp</div><div class="c n ${cls(c)}">${c > 0 ? '+' : ''}${fmt(c * 100, 1)}bp</div>${spark(pts.slice(-63).map((x) => x[1]), last[1] < 0 ? '#1c7ed6' : '#868e96')}</div>`;
}
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

VIEW.news = () => {
  $('#title').textContent = '뉴스';
  const kw = D.keywords.map((k) => `<button class="chip ${state.kw === k.w ? 'on' : ''}" data-kw="${esc(k.w)}">${esc(k.w)}<b>${k.c}</b></button>`).join('');
  const evs = D.events3d.filter((e) => !state.kw || e.items.some((x) => x.title.includes(state.kw)));
  const srcs = [...new Set(D.news.map((n) => n.src))].sort();
  const list = D.news.filter((n) => (!state.newsSrc || n.src === state.newsSrc) && (!state.kw || n.title.includes(state.kw))).slice(0, 120);
  return `
  <section class="card"><h2>화제 키워드</h2><p class="sub">최근 24시간 기사 제목에 자주 나온 말 · 누르면 그 말이 들어간 기사만</p><div class="chips">${kw || '<span class="note">자료 없음</span>'}</div></section>
  <section class="card c8"><h2>사건별로 묶은 뉴스 ${state.kw ? `<small>“${esc(state.kw)}”</small>` : ''}</h2><p class="sub">최근 3일 · 여러 매체가 다룬 순 · 매체별 원문 링크</p>${evs.slice(0, 40).map((e, i) => evRow(e, i, true)).join('') || '<p class="note">해당 기사가 없습니다.</p>'}</section>
  <section class="card c4"><h2>최신 기사</h2><div class="row"><select id="nsrc"><option value="">전체 매체</option>${srcs.map((s) => `<option ${s === state.newsSrc ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
    ${list.map((n) => `<div class="ev" style="grid-template-columns:1fr"><div class="tt" style="font-weight:500;font-size:14px"><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a></div><div class="meta" style="grid-column:1">${esc(n.src)} · ${ago(n.ts)}</div></div>`).join('')}</section>`;
};

VIEW.market = () => {
  $('#title').textContent = '시장';
  const sub = state.mkt;
  const segs = [['fg', '시장 체온·공포탐욕'], ['sector', '업종·테마'], ['movers', '급등·급락']];
  let body = '';
  if (sub === 'fg') {
    const k = D.krfg, c = D.cnn;
    const cnnComp = c?.comp ? Object.entries(c.comp).map(([key, v]) => ({ name: { market_momentum_sp500: 'S&P 500 모멘텀', market_momentum_sp125: 'S&P 125일 모멘텀', stock_price_strength: '52주 신고가·신저가', stock_price_breadth: '상승·하락 거래량', put_call_options: '풋/콜 비율', market_volatility_vix: '변동성(VIX)', market_volatility_vix_50: 'VIX 50일', junk_bond_demand: '정크본드 수요', safe_haven_demand: '안전자산 수요' }[key] || key, score: v.score })).filter((x) => x.score != null) : [];
    const bars = (arr) => `<div class="bars">${arr.map((x) => `<div class="bar"><span>${esc(x.name)}</span><span class="tr"><i style="width:${x.score}%;background:${x.score < 45 ? '#1c7ed6' : x.score > 55 ? '#d6336c' : '#adb5bd'}"></i></span><span class="n">${Math.round(x.score)}</span></div>`).join('')}</div>`;
    body = `
    <section class="card c6">${gauge(c?.score, '미국 · CNN 공포탐욕', c ? `발표 ${kstTime(c.at)}` : '', c ? `전일 ${Math.round(c.prev)} · 1주 ${Math.round(c.w1)} · 1달 ${Math.round(c.m1)} · 1년 ${Math.round(c.y1)}` : '')}<h3>구성 지표</h3>${bars(cnnComp)}<h3>최근 1년</h3>${c ? lineChart([{ name: 'CNN', color: '#d6336c', pts: c.hist }], { h: 170, band: [0, 100], yfmt: (v) => fmt(v) }) : ''}</section>
    <section class="card c6">${gauge(k?.score, '한국 · 자체 계산', k ? `기준 ${k.d}` : '', k ? `전일 ${k.prev ?? '-'} · 1주 ${k.w1 ?? '-'} · 1달 ${k.m1 ?? '-'}` : '')}<h3>구성 지표 <small>최근 250거래일 안에서의 위치(백분위)</small></h3>${k ? bars(k.comp) : ''}<h3>최근 1년</h3>${k ? lineChart([{ name: '한국', color: '#3b5bdb', pts: k.hist }], { h: 170, band: [0, 100], yfmt: (v) => fmt(v) }) : ''}
      <p class="note">한국 지수는 이 사이트가 직접 계산합니다. 주가 모멘텀(125일선 대비), 20일 변동성, 외국인 20일 순매수, 원화 강세, 코스닥 위험선호, 오른 종목 비율을 각각 최근 1년 안에서 백분위로 바꿔 평균합니다. 오른 종목 비율은 수집을 시작한 뒤부터 쌓입니다.</p></section>
    <section class="card"><h2>시장 체온</h2><p class="sub">추세·변동성·심리 요약</p><div><b>한국</b> ${D.temp.kr.map(esc).join(' · ')}</div><div style="margin-top:4px"><b>미국</b> ${D.temp.us.map(esc).join(' · ')}</div>
      <h3>VIX 최근 1년</h3>${S.VIX ? lineChart([{ name: 'VIX', color: '#e8590c', pts: S.VIX.hist }], { h: 160 }) : ''}</section>`;
  } else if (sub === 'sector') {
    const th = sortable(D.themes?.list || []), ind = sortable(D.industries?.list || []), usi = [...(D.usIndustries || [])].sort((a, b) => b.pct - a.pct);
    const etf = GROUP_SECTOR.map((k) => S[k]).filter(Boolean).sort((a, b) => b.pct - a.pct);
    const tbl = (rows, kind) => `<div class="tw"><table class="tbl"><thead><tr><th>${kind}</th><th class="r">등락</th><th class="r">오름/내림</th><th>대표 종목</th></tr></thead><tbody>${rows.map((g) => `<tr><td>${esc(g.name)} <span class="sm">${g.n}</span></td><td class="r ${cls(g.pct)}">${sgn(g.pct)}</td><td class="r"><span class="up">${g.up ?? '-'}</span>/<span class="down">${g.down ?? '-'}</span></td><td class="sm">${g.top ? g.top.slice(0, 3).map((s) => `<a href="${krLink(s.code)}" target="_blank" rel="noopener">${esc(s.name)} <span class="${cls(s.pct)}">${sgn(s.pct, 1)}</span></a>`).join(' · ') : ''}</td></tr>`).join('')}</tbody></table></div>`;
    body = `
    <section class="card c6"><h2>한국 테마</h2><p class="sub">네이버 증권 테마 분류 · ${D.themes ? kstTime(D.themes.at) : ''}</p>${tbl(th, '테마')}</section>
    <section class="card c6"><h2>한국 업종</h2><p class="sub">네이버 증권 업종 분류</p>${tbl(ind, '업종')}</section>
    <section class="card c6"><h2>미국 섹터 ETF</h2><p class="sub">SPDR 섹터 ETF · 하루 / 1주 / 1달</p><div class="tw"><table class="tbl"><thead><tr><th>섹터</th><th class="r">1일</th><th class="r">1주</th><th class="r">1달</th></tr></thead><tbody>${etf.map((s) => `<tr><td>${esc(s.name)}</td><td class="r ${cls(s.pct)}">${sgn(s.pct)}</td><td class="r ${cls(s.w1)}">${sgn(s.w1, 1)}</td><td class="r ${cls(s.m1)}">${sgn(s.m1, 1)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="card c6"><h2>미국 업종</h2><p class="sub">시가총액 상위 600종목을 업종별로 묶은 평균 등락</p><div class="tw"><table class="tbl"><thead><tr><th>업종</th><th class="r">평균 등락</th><th>가장 크게 움직인 종목</th></tr></thead><tbody>${usi.map((g) => `<tr><td>${esc(g.name)} <span class="sm">${g.n}</span></td><td class="r ${cls(g.pct)}">${sgn(g.pct)}</td><td class="sm"><a href="${usLink(g.lead.code)}" target="_blank" rel="noopener">${esc(g.lead.name)}</a> <span class="${cls(g.lead.pct)}">${sgn(g.lead.pct, 1)}</span></td></tr>`).join('')}</tbody></table></div></section>`;
  } else {
    const t = (rows, us) => `<div class="tw"><table class="tbl"><thead><tr><th>종목</th><th class="r">가격</th><th class="r">등락</th><th class="r">${us ? '시가총액' : '거래대금'}</th></tr></thead><tbody>${rows.map((r) => `<tr><td><a href="${us ? usLink(r.code) : krLink(r.code)}" target="_blank" rel="noopener"><b>${esc(r.name)}</b></a> <span class="sm">${esc(r.code)} · ${esc(us ? r.ex : r.mk)}</span>${r.limit ? '<span class="pill lim">가격제한</span>' : ''}</td><td class="r">${us ? '$' + fmt(r.price, 2) : fmt(r.price)}</td><td class="r ${cls(r.pct)}">${sgn(r.pct)}</td><td class="r">${us ? (r.cap ? '$' + fmt(r.cap / 1e9, 0) + 'B' : '-') : fmt(r.val / 100) + '억'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">자료 없음</td></tr>'}</tbody></table></div>`;
    const k = D.movers.kr || {}, u = D.movers.us || {};
    body = `
    <section class="card c6"><h2>한국 급등</h2><p class="sub">KRX 보통주 · 1,000원·거래대금 10억원 이상</p>${t(k.up || [])}</section>
    <section class="card c6"><h2>한국 급락</h2><p class="sub">같은 조건</p>${t(k.down || [])}</section>
    <section class="card c6"><h2>미국 대형주 급등</h2><p class="sub">나스닥·뉴욕 시가총액 상위 각 300종목</p>${t(u.up || [], true)}</section>
    <section class="card c6"><h2>미국 대형주 급락</h2><p class="sub">같은 조건</p>${t(u.down || [], true)}</section>
    <section class="card"><h2>한국 거래대금 상위</h2><p class="sub">보통주</p>${t(k.value || [])}</section>`;
  }
  return `<section class="card" style="padding:10px 14px"><span class="seg" id="mseg">${segs.map(([k, n]) => `<button data-s="${k}" class="${sub === k ? 'on' : ''}">${n}</button>`).join('')}</span></section>${body}`;
};
const GROUP_SECTOR = ['XLK', 'XLC', 'XLY', 'XLF', 'XLV', 'XLI', 'XLE', 'XLB', 'XLP', 'XLU', 'XLRE', 'SMH'];
function sortable(list) { return [...list].sort((a, b) => b.pct - a.pct); }

VIEW.flow = () => {
  $('#title').textContent = '매매 동향';
  const mk = (m, nm) => {
    const f = D.flows[m]; if (!f?.rows?.length) return `<section class="card c6"><h2>${nm}</h2><p class="note">자료 없음</p></section>`;
    const cum = (key) => { let s = 0; return f.rows.slice(-60).map((r) => [ymdDash(r.d), (s += r[key] || 0)]); };
    const sums = [1, 5, 20, 60].map((n) => `<tr><td>최근 ${n}일</td>${['f', 'i', 'p'].map((k) => `<td class="r ${cls(f.sum[n][k])}">${eok(f.sum[n][k])}</td>`).join('')}</tr>`).join('');
    const daily = f.rows.slice(-20).reverse().map((r) => `<tr><td class="n">${md(ymdDash(r.d))}</td>${['f', 'i', 'p'].map((k) => `<td class="r ${cls(r[k])}">${fmt(r[k])}</td>`).join('')}</tr>`).join('');
    return `<section class="card c6"><h2>${nm} 투자자별 순매수 <small>억원</small></h2><p class="sub">네이버 증권 · 최근 ${f.rows.length}거래일 보유</p>
      <div class="tw"><table class="tbl"><thead><tr><th>기간</th><th class="r">외국인</th><th class="r">기관</th><th class="r">개인</th></tr></thead><tbody>${sums}</tbody></table></div>
      <h3>60일 누적</h3>${lineChart([{ name: '외국인', color: '#e8590c', pts: cum('f') }, { name: '기관', color: '#3b5bdb', pts: cum('i') }, { name: '개인', color: '#adb5bd', pts: cum('p') }], { h: 190, zero: true, yfmt: (v) => fmt(v / 10000, 1) + '조' })}
      <h3>날짜별</h3><div class="tw"><table class="tbl"><thead><tr><th>날짜</th><th class="r">외국인</th><th class="r">기관</th><th class="r">개인</th></tr></thead><tbody>${daily}</tbody></table></div></section>`;
  };
  const cot = D.cot.map((c) => `<tr data-cot="${c.code}" style="cursor:pointer"><td><b>${esc(c.name)}</b> <span class="sm">${md(c.d)}</span></td><td class="r ${cls(c.net)}">${fmt(c.net)}</td><td class="r ${cls(c.chg)}">${c.chg == null ? '-' : (c.chg > 0 ? '+' : '') + fmt(c.chg)}</td><td class="r">${c.idx ?? '-'}</td></tr>`).join('');
  const ins = (D.insider?.rows || []).slice(0, 40).map((r) => `<tr><td class="n sm">${esc(r.trade)}</td><td><a href="${usLink(r.sym)}" target="_blank" rel="noopener"><b>${esc(r.sym)}</b></a> <span class="sm">${esc(r.co)}</span></td><td class="sm">${esc(r.title)}</td><td class="r">$${fmt(r.price, 2)}</td><td class="r up">$${fmt((r.value || 0) / 1e3, 0)}K</td><td class="r sm">${esc(r.chg)}</td></tr>`).join('');
  const br = D.breadth.map(([d, v]) => [ymdDash(d), Math.round((v.up / Math.max(1, v.up + v.down)) * 1000) / 10]);
  return `${mk('KOSPI', '코스피')}${mk('KOSDAQ', '코스닥')}
  <section class="card c6"><h2>미국 선물 포지션 (CFTC)</h2><p class="sub">투기 세력(비상업) 순매수 계약 수 · 매주 금요일 발표(화요일 기준) · 위치 = 최근 3년 범위 안 0~100 · 줄을 누르면 차트</p>
    <div class="tw"><table class="tbl"><thead><tr><th>계약</th><th class="r">순포지션</th><th class="r">전주 대비</th><th class="r">위치</th></tr></thead><tbody>${cot || '<tr><td colspan="4" class="empty">자료 없음</td></tr>'}</tbody></table></div></section>
  <section class="card c6"><h2>오른 종목 비율</h2><p class="sub">코스피+코스닥 · 수집 시작 뒤부터 쌓임</p>${lineChart([{ name: '오른 종목 %', color: '#d6336c', pts: br }], { h: 170, band: [0, 100] })}</section>
  <section class="card"><h2>미국 내부자 매수</h2><p class="sub">임원·대주주의 장내 매수 신고(SEC Form 4) 중 2.5만 달러 이상 · OpenInsider 정리 · ${D.insider ? kstTime(D.insider.at) : ''}</p>
    <div class="tw"><table class="tbl"><thead><tr><th>거래일</th><th>종목</th><th>직위</th><th class="r">가격</th><th class="r">금액</th><th class="r">보유 변화</th></tr></thead><tbody>${ins || '<tr><td colspan="6" class="empty">자료 없음</td></tr>'}</tbody></table></div></section>`;
};

VIEW.macro = () => {
  $('#title').textContent = '경제 지표';
  const tbl = (keys) => `<div class="tw"><table class="tbl"><thead><tr><th>항목</th><th class="r">값</th><th class="r">1일</th><th class="r">1주</th><th class="r">1달</th><th class="r">1년</th></tr></thead><tbody>${keys.map((k) => S[k]).filter(Boolean).map((s) => {
    const r = s.grp === 'rate', f = (v) => (r ? (v == null ? '-' : `${v > 0 ? '+' : ''}${fmt(v * 100, 0)}bp`) : sgn(v, 1));
    return `<tr data-k="${Object.keys(S).find((k) => S[k] === s)}" style="cursor:pointer"><td>${esc(s.name)} <span class="sm">${md(s.d)}</span></td><td class="r">${valText(s)}</td><td class="r ${cls(r ? s.chg : s.pct)}">${chgText(s)}</td><td class="r ${cls(s.w1)}">${f(s.w1)}</td><td class="r ${cls(s.m1)}">${f(s.m1)}</td><td class="r ${cls(s.y1)}">${f(s.y1)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
  const ratesChart = lineChart(['US3M', 'US5Y', 'US10Y', 'US30Y'].filter((k) => S[k]).map((k, i) => ({ name: S[k].name, color: ['#adb5bd', '#74c0fc', '#3b5bdb', '#1b1f24'][i], pts: S[k].hist })), { h: 200, yfmt: (v) => fmt(v, 2) + '%' });
  const t0 = todayISO();
  const econ = D.calendar.filter((r) => r.kind === 'econ' && r.d >= addDays(t0, -2));
  return `
  <section class="card c6"><h2>금리</h2><p class="sub">미국 국채 수익률 (Yahoo) · 줄을 누르면 1년 차트</p>${tbl(['US3M', 'US5Y', 'US10Y', 'US30Y'])}<h3>최근 1년</h3>${ratesChart}</section>
  <section class="card c6"><h2>환율</h2><p class="sub">Yahoo · 원/100엔은 100엔 기준</p>${tbl(['USDKRW', 'JPYKRW', 'EURKRW', 'CNYKRW', 'DXY', 'USDJPY'])}<h3>원/달러 최근 1년</h3>${S.USDKRW ? lineChart([{ name: '원/달러', color: '#3b5bdb', pts: S.USDKRW.hist }], { h: 170, yfmt: (v) => fmt(v) }) : ''}</section>
  <section class="card c6"><h2>원자재·위험 지표</h2>${tbl(['WTI', 'BRENT', 'GOLD', 'SILVER', 'COPPER', 'NATGAS', 'VIX', 'MOVE', 'HYG', 'BTC'])}</section>
  <section class="card c6"><h2>주요 경제 발표</h2><p class="sub">최근 이틀 ~ 다음 주 · 발표값·예상·이전 (Nasdaq 경제 일정)</p>${calRows(econ, { minImp: 2 })}</section>
  <section class="card"><p class="note" style="margin:0">한국 기준금리·국고채 금리와 신용융자(빚투) 잔고는 무료로 자동 수집할 수 있는 출처가 막혀 있어 넣지 못했습니다.</p></section>`;
};

VIEW.ai = () => {
  $('#title').textContent = 'AI 브리핑';
  if (!D.reports.length) return `<section class="card"><h2>AI 아침 브리핑</h2><p class="note">아직 브리핑이 없습니다. 평일 아침 6시 50분쯤 GitHub Actions에서 Claude가 이 사이트의 자료와 뉴스로 작성합니다. 바로 만들려면 저장소 Actions → <b>AI 브리핑</b> → Run workflow를 누르세요.</p></section>`;
  const r = D.reports[state.report] || D.reports[0];
  return `<section class="card"><div class="rlist">${D.reports.slice(0, 20).map((x, i) => `<button class="chip ${i === state.report ? 'on' : ''}" data-rep="${i}">${esc(x.id)}</button>`).join('')}</div><div class="md">${mdRender(r.md)}</div></section>`;
};

VIEW.cal = () => {
  $('#title').textContent = '일정';
  const kinds = [['', '전체'], ['econ', '경제 지표'], ['earn', '실적'], ['expiry', '만기']];
  const t0 = todayISO();
  const rows = D.calendar.filter((r) => r.d >= addDays(t0, -1) && (!state.calKind || r.kind === state.calKind));
  return `<section class="card"><h2>일정 <span class="seg" id="ck">${kinds.map(([k, n]) => `<button data-c="${k}" class="${state.calKind === k ? 'on' : ''}">${n}</button>`).join('')}</span></h2>
    <p class="sub">한국 시간 · <span class="imp i3"></span>매우 중요 <span class="imp i2"></span>중요 <span class="imp"></span>참고 · 실적은 시가총액 300억 달러 이상</p>${calRows(rows)}</section>`;
};

/* ── 그리기·이벤트 ── */
function render() {
  const t = state.tab;
  $$('#tabs button, #bnav button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  $('#main').innerHTML = (VIEW[t] || VIEW.home)();
  window.scrollTo(0, 0);
}
function go(t, sub) { state.tab = t; if (sub) state.mkt = sub; history.replaceState(null, '', '#' + t + (sub ? '/' + sub : '')); render(); }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]'); if (b && b.closest('nav')) return go(b.dataset.t);
  const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go, g.dataset.sub);
  const g2 = e.target.closest('[data-go2]'); if (g2) return go(g2.dataset.go2);
  const tl = e.target.closest('.tile[data-k], tr[data-k]'); if (tl) return openSeries(tl.dataset.k);
  const tg = e.target.closest('#tg button'); if (tg) { state.tileGrp = tg.dataset.g; lsSet('q.tile', state.tileGrp); return render(); }
  const thr = e.target.closest('#thr button'); if (thr) { state.thRegion = thr.dataset.r; return render(); }
  const mvr = e.target.closest('#mvr button'); if (mvr) { state.mvRegion = mvr.dataset.r; return render(); }
  const ms = e.target.closest('#mseg button'); if (ms) return go('market', ms.dataset.s);
  const kw = e.target.closest('[data-kw]'); if (kw) { state.kw = state.kw === kw.dataset.kw ? '' : kw.dataset.kw; return render(); }
  const rp = e.target.closest('[data-rep]'); if (rp) { state.report = +rp.dataset.rep; return render(); }
  const ck = e.target.closest('#ck button'); if (ck) { state.calKind = ck.dataset.c; return render(); }
  const ct = e.target.closest('tr[data-cot]'); if (ct) { const c = D.cot.find((x) => x.code === ct.dataset.cot); if (c) modal(esc(c.name) + ' <small>투기 세력 순포지션</small>', lineChart([{ name: '순포지션', color: '#3b5bdb', pts: c.hist }], { h: 240, zero: true, yfmt: (v) => fmt(v / 1000, 0) + 'K' })); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'nsrc') { state.newsSrc = e.target.value; render(); } });
$('#stamp').innerHTML = `자료 ${kstTime(D.updated)} 수집${D.failures.length ? ` · <span title="${esc(D.failures.join('\n'))}">일부 출처 실패 ${D.failures.length}</span>` : ''}`;
{ const [t, sub] = (location.hash.slice(1) || 'home').split('/'); state.tab = VIEW[t] ? t : 'home'; if (sub) state.mkt = sub; }
render();
