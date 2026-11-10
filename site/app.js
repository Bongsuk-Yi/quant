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

/* ── 추가 화면 조각: FRED 지표, 옵션 기대 변동폭, 커뮤니티 관심, 종목 수급 ── */
const fredRows = (grp) => (D.fred || []).filter((x) => x.grp === grp);
function fredTable(grp) {
  const rows = fredRows(grp); if (!rows.length) return D.fredKey ? '<p class="note">자료를 아직 받지 못했습니다.</p>' : '<p class="warn">이 표는 FRED 무료 키가 있어야 채워집니다. fred.stlouisfed.org에서 API 키를 받아 저장소 Secret <b>FRED_API_KEY</b>로 등록하세요.</p>';
  return `<div class="tw"><table class="tbl"><thead><tr><th>항목</th><th class="r">값</th><th class="r">직전 대비</th><th class="r">1년 전 대비</th><th>기준일</th></tr></thead><tbody>${rows.map((x) => `<tr data-fred="${x.k}" style="cursor:pointer"><td>${esc(x.name)}</td><td class="r">${fmt(x.v, 2)}${esc(x.unit)}</td><td class="r ${cls(x.chg)}">${x.chg > 0 ? '+' : ''}${fmt(x.chg, 2)}</td><td class="r ${cls(x.y1)}">${x.y1 > 0 ? '+' : ''}${fmt(x.y1, 2)}</td><td class="sm n">${esc(x.d)}</td></tr>`).join('')}</tbody></table></div>`;
}
function openFred(k) { const x = (D.fred || []).find((y) => y.k === k); if (x) modal(`${esc(x.name)} <small>FRED ${esc(x.id)} · ${x.d}</small>`, lineChart([{ name: x.name, color: '#3b5bdb', pts: x.hist }], { h: 240, yfmt: (v) => fmt(v, 2) })); }
function optView() {
  const o = D.options; if (!o?.list?.length) return '<section class="card"><h2>옵션 기대 변동폭</h2><p class="note">자료를 아직 받지 못했습니다.</p></section>';
  const row = (x) => x.rows.map((r, i) => `<tr>${i === 0 ? `<td rowspan="${x.rows.length}"><a href="${usLink(x.sym)}" target="_blank" rel="noopener"><b>${esc(x.sym)}</b></a><div class="sm">${esc(x.name)}</div></td><td class="r" rowspan="${x.rows.length}">$${fmt(x.price, 2)}</td>` : ''}<td class="n sm">${md(r.exp)} <span class="muted">(${r.dte}일)</span></td><td class="r"><b>±${fmt(r.em, 1)}%</b></td><td class="r sm">$${fmt(x.price * (1 - r.em / 100), 1)} ~ $${fmt(x.price * (1 + r.em / 100), 1)}</td><td class="r">${r.iv ?? '-'}${r.iv ? '%' : ''}</td>${i === 0 ? `<td class="r" rowspan="${x.rows.length}">${x.pcrVol ?? '-'}</td><td class="r" rowspan="${x.rows.length}">${x.pcrOI ?? '-'}</td>` : ''}</tr>`).join('');
  return `<section class="card"><h2>옵션 기대 변동폭 (Expected Move)</h2><p class="sub">만기별 등가격 콜+풋 가격 ÷ 주가 = 옵션 시장이 그 만기까지 예상하는 움직임 폭 · CBOE 지연 시세 · ${kstTime(o.at)}</p>
    <div class="tw"><table class="tbl"><thead><tr><th>종목</th><th class="r">주가</th><th>만기</th><th class="r">기대 변동폭</th><th class="r">예상 범위</th><th class="r">내재변동성</th><th class="r">풋/콜 거래량</th><th class="r">풋/콜 미결제</th></tr></thead><tbody>${o.list.map(row).join('')}</tbody></table></div>
    <p class="note">풋/콜 비율이 1보다 크면 풋(하락 대비) 쪽이 더 많다는 뜻입니다. 실적 발표가 만기 전에 있으면 기대 변동폭이 커집니다.</p></section>`;
}
function commView() {
  const c = D.community || {}, us = c.us || [], kr = c.kr || [];
  const usT = us.length ? `<div class="tw"><table class="tbl"><thead><tr><th>순위</th><th>종목</th><th class="r">언급 수</th><th class="r">24시간 전</th><th class="r">변화</th><th class="r">순위 변화</th></tr></thead><tbody>${us.map((r) => { const ch = r.m0 ? (r.m / r.m0 - 1) * 100 : null, rk = r.rank0 ? r.rank0 - r.rank : null; return `<tr><td class="n">${r.rank}</td><td><a href="${usLink(r.sym)}" target="_blank" rel="noopener"><b>${esc(r.sym)}</b></a> <span class="sm">${esc(r.name)}</span></td><td class="r">${fmt(r.m)}</td><td class="r sm">${fmt(r.m0)}</td><td class="r ${cls(ch)}">${ch == null ? '-' : sgn(ch, 0)}</td><td class="r ${cls(rk)}">${rk == null ? '신규' : rk > 0 ? '▲' + rk : rk < 0 ? '▼' + -rk : '-'}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="note">자료 없음</p>';
  const krT = kr.length ? `<div class="tw"><table class="tbl"><thead><tr><th>순위</th><th>종목</th><th class="r">가격</th><th class="r">등락</th></tr></thead><tbody>${kr.map((r, i) => `<tr><td class="n">${i + 1}</td><td><a href="${krLink(r.code)}" target="_blank" rel="noopener"><b>${esc(r.name)}</b></a> <span class="sm">${esc(r.code)} · ${esc(r.mk)}</span></td><td class="r">${fmt(r.price)}</td><td class="r ${cls(r.pct)}">${sgn(r.pct)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">한국 검색 상위 자료는 받지 못했습니다. 대신 뉴스 탭의 화제 키워드를 참고하세요.</p>';
  return `<section class="card c6"><h2>미국 커뮤니티 관심</h2><p class="sub">Reddit 투자 게시판 언급 수 (ApeWisdom 집계) · ${c.at ? kstTime(c.at) : ''}</p>${usT}</section>
    <section class="card c6"><h2>한국 검색 상위 종목</h2><p class="sub">네이버 증권 검색 상위</p>${krT}
    <h3>화제 키워드</h3><div class="chips">${D.keywords.slice(0, 24).map((k) => `<button class="chip" data-kw="${esc(k.w)}" data-go="news">${esc(k.w)}<b>${k.c}</b></button>`).join('')}</div></section>`;
}
function smSectorRows(key, n, dir) {
  const f = D.smFlow; if (!f) return '';
  const val = (g) => (key === '1' ? g.f1 + g.i1 : g.f5 + g.i5);
  return [...f.sectors].sort((a, b) => dir * (val(b) - val(a))).slice(0, n).map((g) => `<div class="th"><span class="nm">${esc(g.name)} <span class="sm">${g.n}</span></span><span class="p n ${cls(val(g))}">${eok(val(g))}</span><span class="ld">외국인 ${eok(key === '1' ? g.f1 : g.f5)} · 기관 ${eok(key === '1' ? g.i1 : g.i5)}${g.lead ? ` · ${esc(g.lead.name)} ${eok(g.lead.v)}` : ''}</span></div>`).join('');
}
function smFlowCards() {
  const f = D.smFlow; if (!f) return `<section class="card"><h2>외국인·기관이 산 업종</h2><p class="note">수급분석 모니터링 사이트의 자료를 아직 받지 못했습니다.</p></section>`;
  const t = (rows) => `<div class="tw"><table class="tbl"><thead><tr><th>종목</th><th class="r">등락</th><th class="r">외국인</th><th class="r">기관</th><th class="r">합계</th></tr></thead><tbody>${rows.map((r) => `<tr><td><a href="${krLink(r.code)}" target="_blank" rel="noopener"><b>${esc(r.name)}</b></a> <span class="sm">${esc(r.sector)}</span></td><td class="r ${cls(r.pct)}">${sgn(r.pct)}</td><td class="r ${cls(r.f1)}">${fmt(r.f1)}</td><td class="r ${cls(r.i1)}">${fmt(r.i1)}</td><td class="r ${cls(r.f1 + r.i1)}"><b>${fmt(r.f1 + r.i1)}</b></td></tr>`).join('')}</tbody></table></div>`;
  const k = state.smKey;
  return `<section class="card"><h2>외국인·기관이 산 업종 <span class="seg" id="smk"><button data-k="1" class="${k === '1' ? 'on' : ''}">1일</button><button data-k="5" class="${k === '5' ? 'on' : ''}">5일</button></span></h2>
    <p class="sub">시가총액 상위 ${f.n}종목의 외국인+기관 순매수 금액을 업종별로 합산 · 기준 ${md(ymdDash(f.d))} · 수급분석 모니터링 사이트 자료</p>
    <div class="thm"><div><h3 style="margin-top:0">산 업종</h3>${smSectorRows(k, 10, 1)}</div><div><h3 style="margin-top:0">판 업종</h3>${smSectorRows(k, 10, -1)}</div></div></section>
    <section class="card c6"><h2>외국인·기관 순매수 상위 종목</h2><p class="sub">${md(ymdDash(f.d))} · 억원(추정: 순매수 수량 × 종가)</p>${t(f.buy.slice(0, 15))}</section>
    <section class="card c6"><h2>외국인·기관 순매도 상위 종목</h2><p class="sub">같은 기준</p>${t(f.sell.slice(0, 15))}</section>`;
}

/* ── 암호화된 개별 파일 읽기 (종목 상세·AI 종목 분석 본문) ── */
const PW = (() => { try { return localStorage.getItem('quant.pw') || sessionStorage.getItem('quant.pw'); } catch (_) { return null; } })();
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const keyCache = {};
function aesKey(salt, iter) {
  return (keyCache[salt] ??= (async () => {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(PW || ''), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(salt), iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  })());
}
async function load(url) {
  const r = await fetch(url + '?v=' + encodeURIComponent(D.built), { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const env = await r.json();
  let bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(env.iv) }, await aesKey(env.salt, env.iterations), b64(env.data)));
  if (env.compression === 'gzip') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}

/* ── 종목 검색·상세 ── */
const STK = Object.fromEntries((D.stocks?.list || []).map((s) => [s.code, s]));
const stockCache = {}, repCache = {};
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const cho = (s) => [...s].map((ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c <= 11171 ? CHO[Math.floor(c / 588)] : ch; }).join('');
function stockMatch(s, q) { if (!q) return true; const t = q.toLowerCase().replace(/\s/g, ''); return s.code.toLowerCase().includes(t) || s.name.toLowerCase().replace(/\s/g, '').includes(t) || s.sector.includes(q) || (/^[ㄱ-ㅎ]+$/.test(t) && cho(s.name).includes(t)); }
const STK_SORT = { cap: ['시가총액', (s) => s.cap], pct: ['등락률', (s) => s.pct], rs: ['상대강도(RS)', (s) => s.rs ?? -1], f5: ['외국인 5일', (s) => s.f5], i5: ['기관 5일', (s) => s.i5], fi1: ['외국인+기관 1일', (s) => s.f1 + s.i1], m1: ['1달 수익률', (s) => s.m1 ?? -999], vr: ['거래량 배수', (s) => s.vr ?? 0] };
function stockList() {
  $('#title').textContent = '종목';
  if (!D.stocks) return `<section class="card"><h2>종목 검색</h2><p class="note">수급분석 모니터링 사이트의 종목 자료를 아직 받지 못했습니다.</p></section>`;
  const q = state.sq.trim(), mk = state.smk, [, key] = STK_SORT[state.ssort];
  let rows = D.stocks.list.filter((s) => (!mk || s.mk === mk) && stockMatch(s, q));
  rows = [...rows].sort((a, b) => (state.sdir) * (key(b) - key(a)));
  const total = rows.length; rows = rows.slice(0, 120);
  return `<section class="card"><h2>종목 검색</h2><p class="sub">코스피 시가총액 상위 200 + 코스닥 상위 150 · 기준 ${md(ymdDash(D.stocks.list[0].d))} · 수급분석 모니터링과 같은 자료 · 이름·코드·업종·초성(ㅅㅅㅈㅈ)으로 검색</p>
    <div class="row"><input id="sq" type="search" placeholder="종목명, 코드, 업종" value="${esc(state.sq)}" autocomplete="off" style="flex:1;min-width:160px;padding:8px 12px;border:1px solid var(--line);border-radius:8px">
      <span class="seg" id="smkt">${[['', '전체'], ['코스피', '코스피'], ['코스닥', '코스닥']].map(([k, n]) => `<button data-m="${k}" class="${mk === k ? 'on' : ''}">${n}</button>`).join('')}</span>
      <select id="ssort">${Object.entries(STK_SORT).map(([k, [n]]) => `<option value="${k}" ${state.ssort === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="btn" id="sdir">${state.sdir > 0 ? '높은 순 ↓' : '낮은 순 ↑'}</button></div>
    <div class="tw" id="stbl">${stockRows(rows)}</div><p class="note">${fmt(total)}종목${total > 120 ? ' 중 120개 표시 — 검색어로 좁혀 보세요' : ''}. 줄을 누르면 상세 화면이 열립니다.</p></section>`;
}
function stockRows(rows) {
  return `<table class="tbl"><thead><tr><th>종목</th><th class="r">현재가</th><th class="r">등락</th><th class="r">1달</th><th class="r">RS</th><th class="r">외국인 5일</th><th class="r">기관 5일</th><th class="r">시가총액</th></tr></thead><tbody>${rows.map((s) => `<tr data-stock="${s.code}" style="cursor:pointer"><td><b>${esc(s.name)}</b> <span class="sm">${s.code} · ${s.mk} · ${esc(s.sector)}</span></td><td class="r">${fmt(s.price)}</td><td class="r ${cls(s.pct)}">${sgn(s.pct)}</td><td class="r ${cls(s.m1)}">${sgn(s.m1, 1)}</td><td class="r">${s.rs ?? '-'}</td><td class="r ${cls(s.f5)}">${fmt(s.f5)}</td><td class="r ${cls(s.i5)}">${fmt(s.i5)}</td><td class="r">${s.cap >= 10000 ? fmt(s.cap / 10000, 1) + '조' : fmt(s.cap) + '억'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">해당 종목이 없습니다. 목록에 없는 종목은 AI 종목 분석을 요청해 볼 수 있습니다.</td></tr>'}</tbody></table>`;
}
const sma = (a, n, i) => { if (i < n - 1) return null; let s = 0; for (let j = i - n + 1; j <= i; j++) s += a[j]; return s / n; };
function rsi14(c) { const n = 14; if (c.length <= n) return null; let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; g += Math.max(d, 0); l += Math.max(-d, 0); } g /= n; l /= n; for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; } return l === 0 ? 100 : 100 - 100 / (1 + g / l); }
function candleChart(x, show) {
  const N = x.d.length, from = Math.max(0, N - show), n = N - from;
  const W = 720, L = 8, R = 56, T = 8, PH = 250, VH = 60, GAP = 14, H = T + PH + GAP + VH + 20, iw = W - L - R;
  let lo = Infinity, hi = -Infinity, vmax = 0;
  for (let i = from; i < N; i++) { lo = Math.min(lo, x.l[i]); hi = Math.max(hi, x.h[i]); vmax = Math.max(vmax, x.v[i]); }
  const pad = (hi - lo) * 0.05 || 1; lo -= pad; hi += pad;
  const cw = iw / n, X = (i) => L + (i - from + 0.5) * cw, Y = (v) => T + (1 - (v - lo) / (hi - lo)) * PH, VY = (v) => T + PH + GAP + (1 - v / (vmax || 1)) * VH;
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4; g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${W - R + 5}" y="${Y(v) + 3}">${fmt(v)}</text>`; }
  for (const i of [from, from + Math.floor(n / 2), N - 1]) g += `<text x="${X(i)}" y="${H - 5}" text-anchor="${i === from ? 'start' : i === N - 1 ? 'end' : 'middle'}">${x.d[i].slice(2, 4)}.${x.d[i].slice(4, 6)}.${x.d[i].slice(6)}</text>`;
  const bw = Math.max(1, cw * 0.66);
  for (let i = from; i < N; i++) {
    const up = x.c[i] >= x.o[i], col = up ? '#d6336c' : '#1c7ed6', xx = X(i);
    g += `<line x1="${xx}" x2="${xx}" y1="${Y(x.h[i])}" y2="${Y(x.l[i])}" stroke="${col}" stroke-width="1"/><rect x="${xx - bw / 2}" y="${Y(Math.max(x.o[i], x.c[i]))}" width="${bw}" height="${Math.max(1, Math.abs(Y(x.o[i]) - Y(x.c[i])))}" fill="${col}"/><rect x="${xx - bw / 2}" y="${VY(x.v[i])}" width="${bw}" height="${T + PH + GAP + VH - VY(x.v[i])}" fill="${col}" opacity=".45"/>`;
  }
  const MA = [[20, '#f59f00'], [60, '#2f9e44'], [120, '#7950f2']];
  for (const [p, col] of MA) { const pts = []; for (let i = from; i < N; i++) { const m = sma(x.c, p, i); if (m != null) pts.push(`${X(i).toFixed(1)},${Y(m).toFixed(1)}`); } if (pts.length > 1) g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="1.3"/>`; }
  return `<div class="legend">${MA.map(([p, c]) => `<span><i style="background:${c}"></i>${p}일선</span>`).join('')}<span>아래 막대 = 거래량</span></div><svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
}
function stockDetail() {
  const code = state.stock, s = STK[code], x = stockCache[code];
  $('#title').textContent = s ? s.name : code;
  const reps = (D.stockReports || []).filter((r) => r.code === code);
  const repBox = `<section class="card"><h2>AI 종목 분석</h2><p class="sub">Claude가 네이버 증권 자료와 웹 검색으로 쓰는 종목 리포트</p>
    ${reps.length ? reps.map((r) => `<button class="chip" data-srep="${esc(r.id)}">${kstTime(r.created)} 리포트 <b>${fmt(r.chars)}자</b></button>`).join(' ') : '<p class="note" style="margin-top:0">이 종목의 리포트가 아직 없습니다.</p>'}
    <div class="row" style="margin-top:10px"><button class="btn" data-req="${esc(code)}">새 분석 요청</button><span class="muted">GitHub의 실행 화면이 열리고 종목 코드가 복사됩니다. Run workflow를 누르면 5~15분 뒤 여기에 나타납니다.</span></div></section>`;
  if (!s) return `<section class="card"><button class="btn" data-go="stock">‹ 종목 목록</button><p class="note">${esc(code)}는 목록(시가총액 상위 350종목)에 없는 종목입니다. AI 종목 분석은 요청할 수 있습니다.</p></section>${repBox}`;
  const head = `<section class="card"><div class="row"><button class="btn" data-go="stock">‹ 종목 목록</button><span class="muted">${s.code} · ${s.mk} · ${esc(s.sector)} · 기준 ${md(ymdDash(s.d))}</span><a class="btn" style="margin-left:auto" href="https://m.stock.naver.com/domestic/stock/${s.code}/total" target="_blank" rel="noopener noreferrer" data-ext="1">네이버 증권 ↗</a></div>
    <div class="row" style="align-items:baseline"><b class="n" style="font-size:28px">${fmt(s.price)}</b><b class="n ${cls(s.pct)}" style="font-size:16px">${tri(s.pct)} ${sgn(s.pct)}</b><span class="muted">시가총액 ${s.cap >= 10000 ? fmt(s.cap / 10000, 1) + '조원' : fmt(s.cap) + '억원'}</span></div>
    <div class="row">${[['1주', s.w1], ['1달', s.m1], ['3달', s.m3], ['1년', s.y1]].map(([l, v]) => `<span class="kv">${l} <b class="${cls(v)}">${sgn(v, 1)}</b></span>`).join(' · ')} · <span class="kv">RS <b>${s.rs ?? '-'}</b></span> · <span class="kv">52주 위치 <b>${s.pos ?? '-'}%</b></span> · <span class="kv">거래량 <b>평소의 ${s.vr ?? '-'}배</b></span></div>
    ${x ? `<div class="row"><span class="seg" id="sper">${[[60, '3달'], [120, '6달'], [250, '1년']].map(([n, l]) => `<button data-n="${n}" class="${state.sper === n ? 'on' : ''}">${l}</button>`).join('')}</span></div>${candleChart(x, state.sper)}` : `<p class="note">${state.stockErr ? '차트 자료를 불러오지 못했습니다: ' + esc(state.stockErr) : '차트 자료를 불러오는 중…'}</p>`}</section>`;
  let body = '';
  if (x) {
    const N = x.d.length, c = x.c, last = c[N - 1];
    const amt = (arr, k) => { let t = 0; for (let i = Math.max(0, N - k); i < N; i++) if (Number.isFinite(arr[i])) t += arr[i] * c[i]; return Math.round(t / 1e8); };
    const qty = (arr, k) => { let t = 0; for (let i = Math.max(0, N - k); i < N; i++) if (Number.isFinite(arr[i])) t += arr[i]; return t; };
    const ind = [20, 60, 120].map((p) => { const m = sma(c, p, N - 1); return m ? `<tr><td>${p}일 이동평균</td><td class="r">${fmt(m)}</td><td class="r ${cls(last - m)}">${sgn((last / m - 1) * 100, 1)}</td></tr>` : ''; }).join('');
    const hi = Math.max(...x.h.slice(-250)), lo = Math.min(...x.l.slice(-250)), rsi = rsi14(c.slice(-120));
    const show = Math.min(N, state.sper), cum = (arr) => { let t = 0; return x.d.slice(-show).map((d, i) => [ymdDash(d), (t += (Number.isFinite(arr[N - show + i]) ? arr[N - show + i] * c[N - show + i] : 0) / 1e8)]); };
    body = `
    <section class="card c6"><h2>기술 지표</h2><div class="tw"><table class="tbl"><thead><tr><th>항목</th><th class="r">값</th><th class="r">현재가 대비</th></tr></thead><tbody>${ind}
      <tr><td>52주 고가</td><td class="r">${fmt(hi)}</td><td class="r ${cls(last - hi)}">${sgn((last / hi - 1) * 100, 1)}</td></tr><tr><td>52주 저가</td><td class="r">${fmt(lo)}</td><td class="r ${cls(last - lo)}">${sgn((last / lo - 1) * 100, 1)}</td></tr>
      <tr><td>RSI(14)</td><td class="r">${rsi == null ? '-' : fmt(rsi, 1)}</td><td class="r sm">${rsi == null ? '' : rsi >= 70 ? '과열권' : rsi <= 30 ? '침체권' : '중립'}</td></tr>
      <tr><td>상대강도 RS</td><td class="r">${s.rs ?? '-'}</td><td class="r sm">350종목 중 백분위</td></tr></tbody></table></div>
      <p class="note">RS는 최근 3·6·9·12개월 수익률(최근 3개월 가중 2배)을 350종목 안에서 1~99로 줄 세운 값입니다.</p></section>
    <section class="card c6"><h2>외국인·기관 수급</h2><p class="sub">금액은 순매수 수량 × 그날 종가로 추정 (억원)</p><div class="tw"><table class="tbl"><thead><tr><th>기간</th><th class="r">외국인</th><th class="r">기관</th><th class="r">외국인(주)</th><th class="r">기관(주)</th></tr></thead><tbody>
      ${[1, 5, 20, 60].map((k) => `<tr><td>최근 ${k}일</td><td class="r ${cls(amt(x.frg, k))}">${fmt(amt(x.frg, k))}</td><td class="r ${cls(amt(x.org, k))}">${fmt(amt(x.org, k))}</td><td class="r sm">${fmt(qty(x.frg, k))}</td><td class="r sm">${fmt(qty(x.org, k))}</td></tr>`).join('')}</tbody></table></div>
      <h3>누적 순매수 (${show}일)</h3>${lineChart([{ name: '외국인', color: '#e8590c', pts: cum(x.frg) }, { name: '기관', color: '#3b5bdb', pts: cum(x.org) }], { h: 180, zero: true, yfmt: (v) => fmt(v) })}</section>
    <section class="card c6"><h2>날짜별 시세·수급</h2><div class="tw"><table class="tbl"><thead><tr><th>날짜</th><th class="r">종가</th><th class="r">등락</th><th class="r">거래량</th><th class="r">외국인(주)</th><th class="r">기관(주)</th></tr></thead><tbody>
      ${Array.from({ length: Math.min(15, N - 1) }, (_, k) => N - 1 - k).map((i) => { const p = (c[i] / c[i - 1] - 1) * 100; return `<tr><td class="n">${md(ymdDash(x.d[i]))}</td><td class="r">${fmt(c[i])}</td><td class="r ${cls(p)}">${sgn(p)}</td><td class="r sm">${fmt(x.v[i])}</td><td class="r ${cls(x.frg[i])}">${Number.isFinite(x.frg[i]) ? fmt(x.frg[i]) : '-'}</td><td class="r ${cls(x.org[i])}">${Number.isFinite(x.org[i]) ? fmt(x.org[i]) : '-'}</td></tr>`; }).join('')}</tbody></table></div></section>`;
  }
  const peers = D.stocks.list.filter((p) => p.sector === s.sector && p.code !== code).slice(0, 8);
  const news = D.news.filter((n) => n.title.includes(s.name)).slice(0, 8);
  return `${head}${body}
    <section class="card c6"><h2>같은 업종 종목</h2><p class="sub">${esc(s.sector)} · 시가총액 순</p>${peers.length ? `<div class="tw">${stockRows(peers)}</div>` : '<p class="note">목록 안에 같은 업종 종목이 없습니다.</p>'}
      <h3>관련 뉴스</h3>${news.length ? news.map((n) => `<div class="ev" style="grid-template-columns:1fr"><div class="tt" style="font-weight:500;font-size:14px"><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a></div><div class="meta" style="grid-column:1">${esc(n.src)} · ${ago(n.ts)}</div></div>`).join('') : '<p class="note">최근 3일 기사 제목에 이 종목 이름이 없습니다.</p>'}</section>${repBox}`;
}
function viewStock() {
  if (!state.stock) return stockList();
  const code = state.stock;
  if (STK[code] && !stockCache[code] && !state.stockErr) load(`s/${code}.enc.json`).then((x) => { stockCache[code] = x; }).catch((e) => { state.stockErr = e.message; }).then(() => { if (state.tab === 'stock' && state.stock === code) { const y = window.scrollY; render(); window.scrollTo(0, y); } });
  return stockDetail();
}
async function openStockReport(id) {
  const m = (D.stockReports || []).find((r) => r.id === id); if (!m) return;
  try { const r = (repCache[id] ??= await load(`ar/${id}.enc.json`)); modal(`${esc(m.name)} (${esc(m.code)}) <small>${kstTime(m.created)}</small>`, `<div class="md">${mdRender(r.md)}</div>`); }
  catch (e) { toast('리포트를 열지 못했습니다: ' + e.message); }
}
function requestReport(code) {
  code = String(code || '').trim().toUpperCase(); if (!code) return toast('종목 코드를 입력하세요');
  try { navigator.clipboard.writeText(code); } catch (_) {}
  toast(`코드 ${code} 복사됨 — Run workflow에 붙여 넣으세요`);
  window.open(`https://github.com/${D.repo}/actions/workflows/stock-report.yml`, '_blank', 'noopener');
}
function stockReportList() {
  const rows = D.stockReports || [];
  return `<section class="card"><h2>AI 종목 분석</h2><p class="sub">요청해서 만든 종목 리포트 · 줄을 누르면 본문이 열립니다</p>
    <div class="row"><input id="rq" placeholder="종목 코드 (예: 005930, NVDA)" autocomplete="off" style="padding:8px 12px;border:1px solid var(--line);border-radius:8px;min-width:200px"><button class="btn" id="rqb">새 분석 요청</button></div>
    <p class="note" style="margin:0 0 10px">요청을 누르면 GitHub 실행 화면이 열립니다(코드는 자동 복사). 한국 6자리 코드와 미국 티커 모두 가능하고, 5~15분 뒤 이 목록에 나타납니다. Claude 구독 사용량을 씁니다.</p>
    <div class="tw"><table class="tbl"><thead><tr><th>작성</th><th>종목</th><th class="r">분량</th><th>모델</th></tr></thead><tbody>${rows.map((r) => `<tr data-srep="${esc(r.id)}" style="cursor:pointer"><td class="n sm">${kstTime(r.created)}</td><td><b>${esc(r.name)}</b> <span class="sm">${esc(r.code)} · ${esc(r.market)}</span></td><td class="r">${fmt(r.chars)}자</td><td class="sm">${esc(r.model)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">아직 만든 리포트가 없습니다.</td></tr>'}</tbody></table></div></section>`;
}

/* ── 화면 ── */
const VIEW = {};
VIEW.stock = viewStock;
const state = { tab: 'home', tileGrp: lsGet('q.tile', 'kr'), mvRegion: 'kr', thRegion: 'kr', mkt: 'fg', rscope: 'all', mcat: '', smKey: '1', stock: null, stockErr: '', sq: '', smk: '', ssort: 'cap', sdir: 1, sper: 120, aiSub: 'mkt', newsSrc: '', kw: '', report: 0, calKind: '' };

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
    ${rep ? repCard(rep) : '<p class="note">아직 브리핑이 없습니다. 평일 아침 6시 50분쯤 자동으로 만들어집니다.</p>'}</section>
  <section class="card c6"><h2>평소와 크게 다른 것</h2><p class="sub">최근 거래일 하루 변화가 지난 60일 평소 변동의 2배를 넘은 것 · 지수·금리·환율·원자재·수급</p>${an}</section>
  <section class="card c6"><h2>시장 기분 <button class="more" data-go="market" data-sub="fg">자세히 ›</button></h2><p class="sub">0에 가까울수록 공포, 100에 가까울수록 탐욕</p>
    <div class="gauges">${gauge(cnn?.score, '미국 · CNN 공포탐욕', cnn ? `1주 전 ${Math.round(cnn.w1)} · 1달 전 ${Math.round(cnn.m1)}` : '')}${gauge(krfg?.score, '한국 · 자체 계산', krfg ? `1주 전 ${krfg.w1 ?? '-'} · 1달 전 ${krfg.m1 ?? '-'}` : '')}</div>
    <h3>시장 체온</h3><div class="sm"><b>한국</b> ${D.temp.kr.map(esc).join(' · ')}</div><div class="sm" style="margin-top:4px"><b>미국</b> ${D.temp.us.map(esc).join(' · ')}</div></section>
  <section class="card"><h2>시장 숫자 <span class="seg" id="tg">${GROUPS.map(([g, n]) => `<button data-g="${g}" class="${state.tileGrp === g ? 'on' : ''}">${n}</button>`).join('')}</span></h2><p class="sub">칸마다 오른쪽 위 날짜가 그 값의 거래일 · 선은 최근 석 달 · 누르면 1년 차트</p>
    <div class="tiles">${(GROUPS.find((x) => x[0] === state.tileGrp) || GROUPS[0])[2].map(tile).join('')}${state.tileGrp === 'kr' ? krExtraTiles() : ''}${state.tileGrp === 'rate' ? spreadTile() : ''}</div></section>
  <section class="card c6"><h2>오늘 많이 오른·내린 ${state.thRegion === 'kr' ? '테마' : '업종'} <span class="seg" id="thr"><button data-r="kr" class="${state.thRegion === 'kr' ? 'on' : ''}">한국</button><button data-r="us" class="${state.thRegion === 'us' ? 'on' : ''}">미국</button></span><button class="more" data-go="market" data-sub="sector">업종 전체 ›</button></h2>
    <p class="sub">${state.thRegion === 'kr' ? '하루 등락 · 작은 글씨는 그날 가장 크게 움직인 대표 종목' : '미국 시가총액 상위 600종목을 업종별로 묶은 평균 등락'}</p>
    <div class="thm"><div>${thSorted.slice(0, 6).map(themeRow).join('')}</div><div>${thSorted.slice(-6).reverse().map(themeRow).join('')}</div></div></section>
  ${D.smFlow ? `<section class="card"><h2>외국인·기관이 산 업종 <button class="more" data-go="flow">업종 자금 흐름 ›</button></h2><p class="sub">시가총액 상위 ${D.smFlow.n}종목 기준 · ${md(ymdDash(D.smFlow.d))} · 외국인+기관 순매수 금액</p><div class="thm"><div>${smSectorRows('1', 5, 1)}</div><div>${smSectorRows('1', 5, -1)}</div></div></section>` : ''}
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
  const segs = [['fg', '시장 체온·공포탐욕'], ['sector', '업종·테마'], ['movers', '급등·급락'], ['comm', '커뮤니티 관심'], ['opt', '옵션 기대 변동폭']];
  let body = '';
  if (sub === 'fg') {
    const k = D.krfg, c = D.cnn;
    const CNNL = { market_momentum_sp500: 'S&P 500 모멘텀', market_momentum_sp125: 'S&P 125일 모멘텀', stock_price_strength: '52주 신고가·신저가', stock_price_breadth: '상승·하락 거래량', put_call_options: '풋/콜 비율', market_volatility_vix: '변동성(VIX)', market_volatility_vix_50: 'VIX 50일', junk_bond_demand: '정크본드 수요', safe_haven_demand: '안전자산 수요' };
    const cnnComp = c?.comp ? Object.entries(c.comp).filter(([key, v]) => CNNL[key] && v.score != null).map(([key, v]) => ({ name: CNNL[key], score: v.score })) : [];
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
  } else if (sub === 'comm') { body = commView();
  } else if (sub === 'opt') { body = optView();
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
  return `${mk('KOSPI', '코스피')}${mk('KOSDAQ', '코스닥')}${smFlowCards()}
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
  <section class="card c6"><h2>기준금리·SOFR 단기금리</h2><p class="sub">미국 연준 경제 자료(FRED) · 줄을 누르면 차트</p>${fredTable('policy')}<h3>한국 금리</h3>${fredTable('kr')}</section>
  <section class="card c6"><h2>국채·회사채</h2><p class="sub">가산금리 = 같은 만기 국채 대비 더 얹어 주는 금리. 커질수록 신용 불안</p>${fredTable('bond')}</section>
  <section class="card"><h2>FOMC 거시 지표</h2><p class="sub">연준이 금리를 정할 때 보는 물가·고용·성장 지표 · 최신 발표값</p>${fredTable('macro')}</section>
  <section class="card"><p class="note" style="margin:0">한국 금리는 OECD 월간 자료라 한두 달 늦습니다. 한국 기준금리·국고채 일별 금리, 신용융자 잔고, 공매도는 무료 인증키(한국은행 ECOS, KRX)가 있어야 받을 수 있습니다.</p></section>`;
};

/* ── AI 일일 리포트 (v2: 전체/글로벌/한국, 핵심 3줄, 볼 것, 근거 번호) ── */
const SEC_G = [['g_market', '글로벌 경제·금융 시장'], ['g_trend', '글로벌 사회 관심사·트렌드'], ['g_insight', '글로벌 투자자·비즈니스 시사점']];
const SEC_K = [['k_market', '한국 경제·금융 시장'], ['k_trend', '한국 사회 관심사·트렌드'], ['k_insight', '한국 투자자·비즈니스 시사점']];
const MCAT = [['', '전체'], ['idx', '주가 지수'], ['fx', '환율'], ['cmd', '원자재'], ['rate', '채권 수익률'], ['risk', '위험·암호화폐'], ['sector', '미국 섹터 ETF'], ['flow', '수급'], ['fg', '심리']];
const mcatOf = (g) => (['kr', 'us', 'asia', 'fut'].includes(g) ? 'idx' : g);
function refChips(refs) {
  return (refs || []).map((id) => `<button class="ref ${id[0] === 'M' ? 'm' : 'nw'}" data-ref="${esc(id)}">${id[0] === 'M' ? '지표' : '뉴스'} ${esc(id)}</button>`).join('');
}
const repItems = (arr) => `<ul class="rep">${(arr || []).map((x) => `<li>${esc(x.text)} ${refChips(x.refs)}</li>`).join('')}</ul>`;
function mood(rep) {
  const M = Object.fromEntries(rep.metrics.map((m) => [m.k, m]));
  const card = (title, sub, label, tone) => `<div class="mood ${tone}"><div class="nm">${title}</div><div class="lb">${label}</div><div class="sm">${sub}</div></div>`;
  const out = [];
  const vix = M.VIX ? parseFloat(M.VIX.val.replace(/,/g, '')) : null, fg = M.CNNFG ? +M.CNNFG.val : null, kfg = M.KRFG ? +M.KRFG.val : null;
  if (vix != null || fg != null) { const sc = fg ?? (vix >= 30 ? 15 : vix >= 20 ? 40 : 60); out.push(card('투자 심리', `VIX ${M.VIX?.val ?? '-'} · CNN ${fg ?? '-'} · 한국 ${kfg ?? '-'}`, sc < 25 ? '극단적 공포' : sc < 45 ? '공포' : sc <= 55 ? '중립' : sc <= 75 ? '탐욕' : '극단적 탐욕', sc < 45 ? 'cold' : sc > 55 ? 'hot' : '')); }
  const by = (m, hi, lo, a, b, c) => (m.n >= hi ? [a, 'hot'] : m.n <= lo ? [c, 'cold'] : [b, '']);
  if (M.DXY) { const [l, t] = by(M.DXY, 0.3, -0.3, '달러 강세', '보합', '달러 약세'); out.push(card('달러 강세도', `달러인덱스 ${M.DXY.val} (${M.DXY.chg})`, l, t)); }
  if (M.GOLD) { const [l, t] = by(M.GOLD, 0.5, -0.5, '원자재 상승', '보합', '원자재 하락'); out.push(card('원자재 흐름', `금 ${M.GOLD.val} (${M.GOLD.chg})${M.WTI ? ` · WTI ${M.WTI.chg}` : ''}`, l, t)); }
  if (M.BTC) { const [l, t] = by(M.BTC, 2, -2, '위험 선호', '중립', '위험 회피'); out.push(card('암호화폐 심리', `비트코인 ${M.BTC.val} (${M.BTC.chg})`, l, t)); }
  if (M.US10Y) { const bp = M.US10Y.n * 100; out.push(card('채권 시장', `미국 10년 ${M.US10Y.val} (${M.US10Y.chg})`, bp >= 5 ? '금리 상승' : bp <= -5 ? '금리 하락' : '안정', bp >= 5 ? 'hot' : bp <= -5 ? 'cold' : '')); }
  return `<div class="moods">${out.join('')}</div>`;
}
function repCard(r) {   // 홈 요약
  if (!r.rep) return `<div class="md fade">${mdRender(r.md)}</div>`;
  const p = r.rep;
  return `<blockquote class="one">${esc(p.oneLine)}</blockquote><h3>오늘의 핵심 3줄</h3>${repItems(p.key3)}<h3>오늘·이번 주 볼 것</h3>${repItems(p.watch.slice(0, 3))}`;
}
const aiSeg = () => `<section class="card" style="padding:10px 14px"><span class="seg" id="aiseg"><button data-s="mkt" class="${state.aiSub === 'mkt' ? 'on' : ''}">AI 시장 리포트</button><button data-s="stk" class="${state.aiSub === 'stk' ? 'on' : ''}">AI 종목 분석</button></span></section>`;
VIEW.ai = () => aiSeg() + (state.aiSub === 'stk' ? (($('#title').textContent = 'AI 종목 분석'), stockReportList()) : aiMarket());
function aiMarket() {
  $('#title').textContent = 'AI 시장 리포트';
  if (!D.reports.length) return `<section class="card"><h2>AI 시장 리포트</h2><p class="note">아직 리포트가 없습니다. 평일 아침 6시 50분쯤 GitHub Actions에서 Claude가 이 사이트의 자료와 뉴스로 작성합니다. 바로 만들려면 저장소 Actions → <b>AI 브리핑</b> → Run workflow를 누르세요.</p></section>`;
  const i = Math.min(state.report, D.reports.length - 1), r = D.reports[i];
  const d = new Date(r.id + 'T00:00:00Z'), dl = `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WD[d.getUTCDay()]})`;
  const nav = `<div class="rnav"><button class="btn" data-rnav="1" ${i >= D.reports.length - 1 ? 'disabled' : ''}>‹ 이전</button><b>${dl}</b><button class="btn" data-rnav="-1" ${i <= 0 ? 'disabled' : ''}>다음 ›</button><button class="btn" data-rnav="0" ${i === 0 ? 'disabled' : ''}>최신</button></div>`;
  if (!r.rep) return `<section class="card"><h2>일일 리포트 - ${dl}</h2>${nav}<p class="note">이 날짜는 이전 형식으로 작성된 리포트입니다.</p><div class="md">${mdRender(r.md)}</div></section>`;
  const p = r.rep, sc = state.rscope;
  const secs = [...(sc !== 'kr' ? SEC_G : []), ...(sc !== 'g' ? SEC_K : [])];
  const cat = state.mcat, ms = p.metrics.filter((m) => !cat || mcatOf(m.grp) === cat);
  const cnt = (c) => p.metrics.filter((m) => !c || mcatOf(m.grp) === c).length;
  const used = new Set([...p.key3, ...p.watch, ...Object.values(p.sections).flat(), ...(p.signals?.good || []), ...(p.signals?.bad || [])].flatMap((x) => x.refs));
  const newsAll = [...p.news, ...(p.web || [])];
  return `
  <section class="card"><h2>일일 리포트 - ${dl}</h2><p class="sub">${kstTime(p.created)} 작성 · 문장 옆 번호를 누르면 근거로 쓴 기사·지표로 이동</p>
    ${nav}<div class="row"><span class="seg" id="rsc">${[['all', '전체'], ['g', '글로벌'], ['kr', '한국']].map(([k, n]) => `<button data-s="${k}" class="${sc === k ? 'on' : ''}">${n}</button>`).join('')}</span></div>
    <h3>오늘의 한 줄</h3><blockquote class="one">${esc(p.oneLine)}</blockquote>
    <h3>오늘의 핵심 3줄</h3>${repItems(p.key3)}
    <h3>오늘·이번 주 볼 것</h3>${repItems(p.watch)}
    ${secs.map(([k, n]) => `<h3>${n}</h3>${repItems(p.sections[k])}`).join('')}
    ${p.signals && (p.signals.good.length || p.signals.bad.length) ? `<h3>AI가 찾은 호재·악재</h3><div class="thm"><div><b class="up">호재</b>${repItems(p.signals.good)}</div><div><b class="down">악재</b>${repItems(p.signals.bad)}</div></div>` : ''}
    ${p.summary ? `<h3>정리</h3><p>${esc(p.summary)}</p>` : ''}
    <p class="note">Claude가 자동 작성한 참고 자료이며 투자 권유가 아닙니다. 숫자는 근거 지표·원문 기사에서 확인하세요.</p></section>
  <section class="card"><h2>시장 심리</h2><p class="sub">${r.id} 리포트 작성 시점 기준</p>${mood(p)}
    <h3>경제 동향 한 줄 요약</h3><div class="idx">${['USDKRW', 'SPX', 'KOSPI', 'GOLD', 'WTI', 'US10Y', 'BTC'].map((k) => p.metrics.find((m) => m.k === k)).filter(Boolean).map((m) => `<div style="border-left-color:${m.n >= 0 ? '#d6336c' : '#1c7ed6'}"><div class="nm">${esc(m.name)}</div><div class="v n" style="font-size:16px">${esc(m.val)}</div><div class="n ${cls(m.n)}">${esc(m.chg)} ${m.n > 0 ? '상승' : m.n < 0 ? '하락' : ''}</div></div>`).join('')}</div></section>
  <section class="card" id="refs-m"><h2>글로벌 경제 지표</h2><p class="sub">리포트가 근거로 쓴 지표 · 번호는 본문 인용 번호</p>
    <div class="chips" id="mcat" style="margin-bottom:10px">${MCAT.filter(([c]) => cnt(c)).map(([c, n]) => `<button class="chip ${cat === c ? 'on' : ''}" data-c="${c}">${n}<b>${cnt(c)}</b></button>`).join('')}</div>
    <div class="tw"><table class="tbl"><thead><tr><th>번호</th><th>항목</th><th class="r">값</th><th class="r">변동</th><th class="r">1주</th><th class="r">1달</th><th>거래일</th></tr></thead><tbody>${ms.map((m) => `<tr id="ref-${m.id}" class="${used.has(m.id) ? 'used' : ''}"><td class="sm n">${m.id}</td><td>${esc(m.name)}</td><td class="r">${esc(m.val)}</td><td class="r ${cls(m.n)}">${esc(m.chg)}</td><td class="r">${esc(m.w1 || '')}</td><td class="r">${esc(m.m1 || '')}</td><td class="sm n">${md(m.d)}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="card" id="refs-n"><h2>근거 뉴스</h2><p class="sub">본문에 인용된 기사는 굵게 표시 · 제목을 누르면 원문</p>
    ${newsAll.map((n) => `<div class="nref ${used.has(n.id) ? 'used' : ''}" id="ref-${n.id}"><span class="sm n">${n.id}</span><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a><span class="sm">${esc(n.src)}${n.n > 1 ? ` 외 ${n.n - 1}건` : ''}</span></div>`).join('')}</section>`;
}
function jumpRef(id) {
  if (id[0] === 'M' && state.mcat) { state.mcat = ''; render(); }
  const el = document.getElementById('ref-' + id); if (!el) return toast('근거를 찾지 못했습니다');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2200);
}

VIEW.cal = () => {
  $('#title').textContent = '일정';
  const kinds = [['', '전체'], ['econ', '경제 지표'], ['earn', '실적'], ['expiry', '만기']];
  const t0 = todayISO();
  const rows = D.calendar.filter((r) => r.d >= addDays(t0, -1) && (!state.calKind || r.kind === state.calKind));
  return `<section class="card"><h2>일정 <span class="seg" id="ck">${kinds.map(([k, n]) => `<button data-c="${k}" class="${state.calKind === k ? 'on' : ''}">${n}</button>`).join('')}</span></h2>
    <p class="sub">한국 시간 · <span class="imp i3"></span>매우 중요 <span class="imp i2"></span>중요 <span class="imp"></span>참고 · 실적은 시가총액 300억 달러 이상(홈에는 1,000억 달러 이상만)</p>${calRows(rows)}</section>`;
};

/* ── 그리기·이벤트 ── */
function render() {
  const t = state.tab;
  $$('#tabs button, #bnav button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  $('#main').innerHTML = (VIEW[t] || VIEW.home)();
  window.scrollTo(0, 0);
}
function go(t, sub) { state.tab = t; if (t === 'stock') { state.stock = sub || null; state.stockErr = ''; } else if (t === 'ai') { if (sub) state.aiSub = sub; } else if (sub) state.mkt = sub; history.replaceState(null, '', '#' + t + (sub ? '/' + sub : '')); render(); }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]'); if (b && b.closest('nav')) return go(b.dataset.t);
  const nv = e.target.closest('a[href^="https://m.stock.naver.com/domestic/stock/"]'); if (nv && !nv.dataset.ext) { const code = nv.getAttribute('href').split('/stock/')[1].split('/')[0]; if (STK[code]) { e.preventDefault(); return go('stock', code); } }
  const sr = e.target.closest('[data-srep]'); if (sr) return openStockReport(sr.dataset.srep);
  const rq = e.target.closest('[data-req]'); if (rq) return requestReport(rq.dataset.req);
  if (e.target.id === 'rqb') return requestReport($('#rq').value);
  const stt = e.target.closest('tr[data-stock]'); if (stt) return go('stock', stt.dataset.stock);
  const smt = e.target.closest('#smkt button'); if (smt) { state.smk = smt.dataset.m; return render(); }
  if (e.target.id === 'sdir') { state.sdir *= -1; return render(); }
  const spr = e.target.closest('#sper button'); if (spr) { state.sper = +spr.dataset.n; const y = window.scrollY; render(); return window.scrollTo(0, y); }
  const ais = e.target.closest('#aiseg button'); if (ais) return go('ai', ais.dataset.s);
  const g = e.target.closest('[data-go]'); if (g) { if (g.dataset.kw) state.kw = g.dataset.kw; return go(g.dataset.go, g.dataset.sub); }
  const g2 = e.target.closest('[data-go2]'); if (g2) return go(g2.dataset.go2);
  const tl = e.target.closest('.tile[data-k], tr[data-k]'); if (tl) return openSeries(tl.dataset.k);
  const tg = e.target.closest('#tg button'); if (tg) { state.tileGrp = tg.dataset.g; lsSet('q.tile', state.tileGrp); return render(); }
  const thr = e.target.closest('#thr button'); if (thr) { state.thRegion = thr.dataset.r; return render(); }
  const mvr = e.target.closest('#mvr button'); if (mvr) { state.mvRegion = mvr.dataset.r; return render(); }
  const ms = e.target.closest('#mseg button'); if (ms) return go('market', ms.dataset.s);
  const kw = e.target.closest('[data-kw]'); if (kw) { state.kw = state.kw === kw.dataset.kw ? '' : kw.dataset.kw; return render(); }
  const rf = e.target.closest('[data-ref]'); if (rf) { if (state.tab !== 'ai') { state.tab = 'ai'; state.report = 0; render(); } return jumpRef(rf.dataset.ref); }
  const rn = e.target.closest('[data-rnav]'); if (rn) { const k = +rn.dataset.rnav; state.report = k === 0 ? 0 : Math.max(0, Math.min(D.reports.length - 1, state.report + k)); return render(); }
  const rs = e.target.closest('#rsc button'); if (rs) { state.rscope = rs.dataset.s; const y = window.scrollY; render(); return window.scrollTo(0, y); }
  const mc = e.target.closest('#mcat button'); if (mc) { state.mcat = mc.dataset.c; const y = window.scrollY; render(); return window.scrollTo(0, y); }
  const fr = e.target.closest('tr[data-fred]'); if (fr) return openFred(fr.dataset.fred);
  const sk = e.target.closest('#smk button'); if (sk) { state.smKey = sk.dataset.k; const y = window.scrollY; render(); return window.scrollTo(0, y); }
  const ck = e.target.closest('#ck button'); if (ck) { state.calKind = ck.dataset.c; return render(); }
  const ct = e.target.closest('tr[data-cot]'); if (ct) { const c = D.cot.find((x) => x.code === ct.dataset.cot); if (c) modal(esc(c.name) + ' <small>투기 세력 순포지션</small>', lineChart([{ name: '순포지션', color: '#3b5bdb', pts: c.hist }], { h: 240, zero: true, yfmt: (v) => fmt(v / 1000, 0) + 'K' })); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'nsrc') { state.newsSrc = e.target.value; render(); } });
document.addEventListener('change', (e) => { if (e.target.id === 'ssort') { state.ssort = e.target.value; render(); } });
document.addEventListener('input', (e) => {   // 검색: 입력 칸은 그대로 두고 표만 다시 그린다
  if (e.target.id !== 'sq') return; state.sq = e.target.value;
  const [, key] = STK_SORT[state.ssort]; const rows = D.stocks.list.filter((s) => (!state.smk || s.mk === state.smk) && stockMatch(s, state.sq.trim())).sort((a, b) => state.sdir * (key(b) - key(a))).slice(0, 120);
  $('#stbl').innerHTML = stockRows(rows);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'rq') requestReport(e.target.value); });
$('#stamp').innerHTML = `자료 ${kstTime(D.updated)} 수집${D.failures.length ? ` · <span title="${esc(D.failures.join('\n'))}">일부 출처 실패 ${D.failures.length}</span>` : ''}`;
{ const [t, sub] = (location.hash.slice(1) || 'home').split('/'); state.tab = VIEW[t] ? t : 'home'; if (state.tab === 'stock') state.stock = sub || null; else if (state.tab === 'ai') { if (sub) state.aiSub = sub; } else if (sub) state.mkt = sub; }
render();
