// 수집 자료(store) → 화면용 자료. 계산 규칙은 모두 여기 있다.
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const kstISO = () => new Date(Date.now() + 9 * 3600e3).toISOString();

/* ── 시세 요약: 최근값·전일비·석 달 선·평소 대비 크기(z) ── */
export function seriesSummary(S) {
  const out = {};
  for (const [k, meta] of Object.entries(S.seriesMeta || {})) {
    const s = S.series[k]; if (!s || s.length < 3) continue;
    const [d, c] = s.at(-1), p = s.at(-2)[1];
    const isRate = meta.grp === 'rate';
    const chg = c - p, pct = isRate ? null : (c / p - 1) * 100;
    // 최근 60일 하루 변화의 표준편차로 오늘 변화 크기를 잰다
    const diffs = []; for (let i = Math.max(1, s.length - 61); i < s.length - 1; i++) diffs.push(isRate ? s[i][1] - s[i - 1][1] : Math.log(s[i][1] / s[i - 1][1]));
    const today = isRate ? chg : Math.log(c / p), sd = std(diffs);
    const y1 = s.find((x) => x[0] >= shiftYear(d)) || s[0];
    out[k] = { ...meta, d, c, chg: round(chg, 4), pct: round(pct, 2), z: sd > 0 ? round(today / sd, 2) : null,
      w1: ret(s, 5, isRate), m1: ret(s, 21, isRate), y1: isRate ? round(c - y1[1], 3) : round((c / y1[1] - 1) * 100, 1),
      spark: s.slice(-63).map((x) => x[1]), hist: s.slice(-260) };
  }
  return out;
}
const shiftYear = (d) => `${+d.slice(0, 4) - 1}${d.slice(4)}`;
function ret(s, n, isRate) { if (s.length <= n) return null; const a = s.at(-1 - n)[1], b = s.at(-1)[1]; return isRate ? round(b - a, 3) : round((b / a - 1) * 100, 2); }

/* ── 투자자별 순매수 (억원) ── */
export function flowSummary(S) {
  const out = {};
  for (const mk of ['KOSPI', 'KOSDAQ']) {
    const rows = Object.entries(S.flows?.[mk] || {}).sort().map(([d, v]) => ({ d, ...v }));
    const sum = (n, k) => rows.slice(-n).reduce((s, r) => s + (r[k] || 0), 0);
    const f60 = rows.slice(-61, -1).map((r) => r.f), i60 = rows.slice(-61, -1).map((r) => r.i);
    const last = rows.at(-1);
    out[mk] = { rows: rows.slice(-120), last, sum: Object.fromEntries([1, 5, 20, 60].map((n) => [n, { f: sum(n, 'f'), i: sum(n, 'i'), p: sum(n, 'p') }])),
      zf: last && f60.length > 15 ? round((last.f - mean(f60)) / (std(f60) || 1), 2) : null, zi: last && i60.length > 15 ? round((last.i - mean(i60)) / (std(i60) || 1), 2) : null };
  }
  return out;
}

/* ── 한국 공포·탐욕 (자체 계산, 0~100) ──
   지표마다 최근 250거래일 안에서의 백분위를 구해 평균한다. 높을수록 탐욕.
   1 모멘텀: 코스피 / 125일 이동평균
   2 변동성: 코스피 20일 실현변동성 (높을수록 공포 → 뒤집음)
   3 외국인: 코스피+코스닥 외국인 20일 순매수 합
   4 환율: 원/달러 20일 변화율 (원화 약세 = 공포 → 뒤집음)
   5 위험선호: 코스닥 대비 코스피 20일 상대수익 (코스닥 강세 = 탐욕)
   6 시장 폭: 오른 종목 비율 10일 평균 (자료가 20일 이상 쌓이면 포함) */
export function krFearGreed(S) {
  const ks = S.series?.KOSPI || [], kq = S.series?.KOSDAQ || [], fx = S.series?.USDKRW || [];
  if (ks.length < 200) return null;
  const kqM = new Map(kq), fxM = new Map(fx);
  const fl = new Map(); for (const mk of ['KOSPI', 'KOSDAQ']) for (const [d, v] of Object.entries(S.flows?.[mk] || {})) { const k = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`; fl.set(k, (fl.get(k) || 0) + (v.f || 0)); }
  const br = new Map(Object.entries(S.breadth || {}).map(([d, v]) => [`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`, v.up / Math.max(1, v.up + v.down)]));
  const dates = ks.map((x) => x[0]), close = ks.map((x) => x[1]);
  const raw = { mom: [], vol: [], frg: [], fx: [], risk: [], breadth: [] };
  const fxLast = (d) => { let v = fxM.get(d); if (v != null) return v; for (let i = fx.length - 1; i >= 0; i--) if (fx[i][0] <= d) return fx[i][1]; return null; };
  for (let i = 0; i < ks.length; i++) {
    const d = dates[i];
    raw.mom.push(i >= 124 ? close[i] / mean(close.slice(i - 124, i + 1)) - 1 : null);
    if (i >= 20) { const r = []; for (let j = i - 19; j <= i; j++) r.push(Math.log(close[j] / close[j - 1])); raw.vol.push(-std(r) * Math.sqrt(252)); } else raw.vol.push(null);
    const fwin = dates.slice(Math.max(0, i - 19), i + 1).map((x) => fl.get(x)).filter((x) => x != null);
    raw.frg.push(fwin.length >= 15 ? fwin.reduce((s, x) => s + x, 0) : null);
    const a = fxLast(d), b = i >= 20 ? fxLast(dates[i - 20]) : null; raw.fx.push(a && b ? -(a / b - 1) : null);
    const q0 = i >= 20 ? kqM.get(dates[i - 20]) : null, q1 = kqM.get(d); raw.risk.push(q0 && q1 ? (q1 / q0) / (close[i] / close[i - 20]) - 1 : null);
    const bw = dates.slice(Math.max(0, i - 9), i + 1).map((x) => br.get(x)).filter((x) => x != null); raw.breadth.push(bw.length >= 5 ? mean(bw) : null);
  }
  const pct = (arr, i) => { const v = arr[i]; if (v == null) return null; const win = arr.slice(Math.max(0, i - 249), i + 1).filter((x) => x != null); if (win.length < 20) return null; return (win.filter((x) => x < v).length + 0.5 * win.filter((x) => x === v).length) / win.length * 100; };
  const LABEL = { mom: '주가 모멘텀', vol: '변동성(낮을수록 탐욕)', frg: '외국인 20일 순매수', fx: '원화 강세', risk: '코스닥 위험선호', breadth: '오른 종목 비율' };
  const hist = [];
  let comp = null;
  for (let i = Math.max(0, ks.length - 260); i < ks.length; i++) {
    const parts = Object.fromEntries(Object.keys(raw).map((k) => [k, pct(raw[k], i)]));
    const vals = Object.values(parts).filter((x) => x != null);
    if (vals.length >= 3) hist.push([dates[i], round(mean(vals), 1)]);
    if (i === ks.length - 1) comp = Object.entries(parts).filter(([, v]) => v != null).map(([k, v]) => ({ k, name: LABEL[k], score: round(v, 0) }));
  }
  if (!hist.length) return null;
  const score = hist.at(-1)[1];
  const back = (n) => hist.at(-1 - n)?.[1] ?? null;
  return { score, rating: rating(score), d: hist.at(-1)[0], prev: back(1), w1: back(5), m1: back(21), comp, hist };
}
export const rating = (s) => (s == null ? '' : s < 25 ? '극단적 공포' : s < 45 ? '공포' : s <= 55 ? '중립' : s <= 75 ? '탐욕' : '극단적 탐욕');

/* ── 시장 체온 (과열·침체 신호를 한 줄로) ── */
export function temperature(sum, krfg, cnn) {
  const kr = [], us = [];
  const k = sum.KOSPI, q = sum.KOSDAQ;
  if (k) { kr.push(`코스피 1주 ${sign(k.w1)}% · 1달 ${sign(k.m1)}%`); }
  if (krfg) kr.push(`공포탐욕 ${krfg.score} (${krfg.rating})`);
  if (q && k) kr.push(`코스닥/코스피 1달 상대 ${sign(round((q.m1 ?? 0) - (k.m1 ?? 0), 1))}%p`);
  const s = sum.SPX, v = sum.VIX;
  if (s) us.push(`S&P 1주 ${sign(s.w1)}% · 1달 ${sign(s.m1)}%`);
  if (v) us.push(`VIX ${v.c.toFixed(1)} (${v.c >= 30 ? '공포 구간' : v.c >= 20 ? '경계' : '안정'})`);
  if (cnn?.now) us.push(`CNN 공포탐욕 ${Math.round(cnn.now.score)}`);
  return { kr, us };
}
const sign = (x) => (x == null ? '-' : (x > 0 ? '+' : '') + x);

/* ── 평소와 크게 다른 것 ── */
export function anomalies(sum, flows) {
  const out = [];
  for (const [k, s] of Object.entries(sum)) {
    if (s.z == null || Math.abs(s.z) < 2 || s.grp === 'sector') continue;
    const move = s.grp === 'rate' ? `${s.chg > 0 ? '+' : ''}${(s.chg * 100).toFixed(0)}bp` : `${s.pct > 0 ? '+' : ''}${s.pct}%`;
    out.push({ k, name: s.name, grp: s.grp, d: s.d, text: `${s.name} ${move}`, z: s.z, note: `평소 하루 변동의 ${Math.abs(s.z).toFixed(1)}배` });
  }
  for (const mk of ['KOSPI', 'KOSDAQ']) {
    const f = flows[mk]; if (!f?.last) continue;
    for (const [key, who] of [['zf', '외국인'], ['zi', '기관']]) {
      const z = f[key], v = f.last[key === 'zf' ? 'f' : 'i'];
      if (z != null && Math.abs(z) >= 2) out.push({ k: mk + key, name: `${mk === 'KOSPI' ? '코스피' : '코스닥'} ${who}`, grp: 'flow', d: f.last.d, text: `${mk === 'KOSPI' ? '코스피' : '코스닥'} ${who} ${v > 0 ? '+' : ''}${v.toLocaleString()}억원`, z, note: `최근 60일 평균 대비 ${Math.abs(z).toFixed(1)} 표준편차` });
    }
  }
  return out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 12);
}

/* ── 뉴스 묶기: 비슷한 제목을 한 사건으로, 여러 매체가 다룬 순 ── */
const STOP = new Set('억원 조원 대비 작년 내년 최대 기업 목표 투자 지원 장중 분기 속보 단독 종합 오늘 내일 어제 이번 지난 올해 대한 관련 위해 이후 이상 미만 전망 가능성 우려 기대 확대 축소 발표 개장 마감 출발 기록 연합뉴스 뉴스 기자 사진 영상 그래픽 the a an to of in on for and is are with as at by from after over up down says said its it new news update live stocks stock market markets'.split(' '));
export const tokens = (t) => new Set((t.toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)|<[^>]*>/g, ' ').match(/[가-힣]{2,}|[a-z][a-z0-9&.]{1,}|\d+(?:\.\d+)?%?/g) || [])
  .map((w) => { const P = /(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|까지|부터|보다)$/; return w.length > 2 ? w.replace(P, '').replace(P, '') : w; }).filter((w) => w.length >= 2 && !STOP.has(w)));
function sim(a, b) { let n = 0; for (const x of a) if (b.has(x)) n++; return { n, j: n / (a.size + b.size - n || 1) }; }
export function clusterNews(news, hours = 24) {
  const since = Date.now() - hours * 3600e3;
  const items = news.filter((n) => n.ts >= since).map((n) => ({ ...n, tk: tokens(n.title) }));
  const cl = [];
  // 시황 기사(지수 마감·장중 흐름)는 시장별로 한 사건으로 모은다
  const WRAP = /(마감|하락|상승|반등|출발|보합|급락|급등|사수|약세|강세|혼조|랠리|장중|開場|개장)/;
  const wraps = { kr: { items: [], tk: new Set(['코스피']) }, us: { items: [], tk: new Set(['뉴욕증시']) } };
  for (const it of [...items]) {
    const t = it.title;
    const key = /코스피|코스닥|국내 증시|국내증시|韓증시|한국 증시/.test(t) && WRAP.test(t) ? 'kr' : /뉴욕증시|뉴욕 증시|美증시|미국 증시|나스닥|다우|S&P/.test(t) && WRAP.test(t) ? 'us' : null;
    if (key) { wraps[key].items.push(it); items.splice(items.indexOf(it), 1); }
  }
  for (const w of Object.values(wraps)) if (w.items.length) { w.wrap = true; cl.push(w); }
  for (const it of items) {
    let best = null, bs = 0;
    for (const c of cl) { if (c.wrap) continue; const s = sim(it.tk, c.tk); const score = s.j >= 0.3 || s.n >= 3 || (s.n >= 2 && s.j >= 0.2) ? s.j + s.n * 0.05 : 0; if (score > bs) { bs = score; best = c; } }
    if (best) { best.items.push(it); for (const w of it.tk) best.tk.add(w); } else cl.push({ items: [it], tk: new Set(it.tk) });
  }
  // 2단계: 같은 사건이 여러 묶음으로 갈라진 것을 다시 합친다
  for (let i = 0; i < cl.length; i++) for (let j = cl.length - 1; j > i; j--) {
    if (cl[i].wrap || cl[j].wrap) continue;
    const s = sim(cl[i].tk, cl[j].tk), a = tokens(cl[i].items[0].title), b = tokens(cl[j].items[0].title), t = sim(a, b);
    if ((t.n >= 2 && t.j >= 0.18) || (s.n >= 4 && s.j >= 0.2)) { cl[i].items.push(...cl[j].items); for (const w of cl[j].tk) cl[i].tk.add(w); cl.splice(j, 1); }
  }
  return cl.map((c) => {
    c.items.sort((a, b) => b.ts - a.ts);
    const srcs = [...new Set(c.items.map((x) => x.src))];
    const lead = c.wrap ? (c.items.find((x) => /마감/.test(x.title)) || c.items[0]) : c.items.find((x) => x.main) || c.items.reduce((a, b) => (a.title.length <= b.title.length ? a : b));
    const score = srcs.length * 2 + c.items.length + (c.items.some((x) => x.main) ? 2 : 0);
    return { title: (c.wrap ? '[시황] ' : '') + lead.title, wrap: !!c.wrap, sum: lead.sum || '', ts: Math.max(...c.items.map((x) => x.ts)), n: c.items.length, srcs, score, items: c.items.slice(0, 8).map(({ title, url, src, ts }) => ({ title, url, src, ts })) };
  }).sort((a, b) => b.score - a.score || b.ts - a.ts);
}
export function hotKeywords(news, hours = 24) {
  const since = Date.now() - hours * 3600e3, cnt = new Map();
  const kw = new Set();
  for (const n of news) if (n.ts >= since) for (const w of tokens(n.title)) if (!/^\d/.test(w) && /[가-힣]/.test(w)) { kw.add(w); cnt.set(w, (cnt.get(w) || 0) + 1); }
  return [...cnt].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([w, c]) => ({ w, c }));
}

/* ── 일정 정리 (한국 시간) ── */
// Nasdaq 경제 일정의 시각은 미국 동부 시간이다 (서머타임 반영)
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
function etToUtc(d, hh, mm) {
  const guess = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), hh, mm);
  const p = Object.fromEntries(NY.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asNY = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return guess + (guess - asNY);
}
const KEY_EVENTS = /CPI|PPI|PCE|Nonfarm|Payroll|Unemployment Rate|Jobless|FOMC|Fed |Fed's|Interest Rate|Rate Decision|GDP|Retail Sales|ISM|PMI|Consumer Confidence|Michigan|Durable|Housing Starts|Existing Home|New Home|Trade Balance|Industrial Production|JOLTS|Powell|BoJ|BOJ|ECB|Lagarde|Export|Import|Inflation|Employment|Beige Book|Treasury|Bond Auction|Crude Oil Inventories/i;
const COUNTRY = { 'United States': '미국', 'South Korea': '한국', China: '중국', Japan: '일본', 'Euro Zone': '유로존', Germany: '독일', 'United Kingdom': '영국' };
export function calendar(S) {
  const cal = S.calendar || { econ: [], earn: [] }, rows = [], seenEv = new Set();
  for (const e of cal.econ) {
    if (!COUNTRY[e.c]) continue;
    let imp = KEY_EVENTS.test(e.name) ? (/(CPI|Nonfarm|Payroll|FOMC Statement|Rate Decision|Interest Rate Decision|GDP|PCE|Powell)/i.test(e.name) ? 3 : 2) : 1;
    if (/Speaks|Speech|Testimony|GDPNow|Expectations|Auction|Minutes/i.test(e.name) && !/Powell|FOMC Minutes/i.test(e.name)) imp = 1;
    if (e.c !== 'United States' && e.c !== 'South Korea' && imp === 3) imp = 2;
    if (!['United States', 'South Korea', 'China'].includes(e.c) && !/CPI|Rate Decision|Interest Rate|GDP|BoJ|ECB|Lagarde|Ueda/i.test(e.name)) imp = 1;
    if (imp < 2 && e.c !== 'South Korea') continue;
    let kst = e.d, time = '';
    const m = /^(\d{1,2}):(\d{2})$/.exec(e.t || '');
    if (m) { const dt = new Date(etToUtc(e.d, +m[1], +m[2]) + 9 * 3600e3); kst = dt.toISOString().slice(0, 10); time = dt.toISOString().slice(11, 16); }
    const key = `${kst} ${time} ${e.c} ${e.name}`; if (seenEv.has(key)) continue; seenEv.add(key);
    const cl = (v) => String(v || '').replace(/&nbsp;|&#160;/g, ' ').trim();
    rows.push({ kind: 'econ', d: kst, time, c: COUNTRY[e.c], name: e.name, act: cl(e.act), cons: cl(e.cons), prev: cl(e.prev), imp });
  }
  const seenCo = new Set();
  for (const x of cal.earn) if (!seenCo.has(x.name) && seenCo.add(x.name)) rows.push({ kind: 'earn', d: x.d, time: x.when === 'time-pre-market' ? '장 전' : x.when === 'time-after-hours' ? '장 마감 후' : '', c: '미국', name: `${x.name} (${x.sym}) 실적`, sym: x.sym, cap: x.cap, eps: x.eps, imp: x.cap >= 3e11 ? 3 : x.cap >= 1e11 ? 2 : 1 });
  // 옵션·선물 만기
  const today = kstISO().slice(0, 10);
  for (let i = 0; i <= 31; i++) {
    const d = new Date(Date.parse(today + 'T00:00:00Z') + i * 864e5), iso = d.toISOString().slice(0, 10), day = d.getUTCDate(), wd = d.getUTCDay(), mo = d.getUTCMonth() + 1;
    if (wd === 4 && day >= 8 && day <= 14) rows.push({ kind: 'expiry', d: iso, time: '15:20', c: '한국', name: [3, 6, 9, 12].includes(mo) ? '선물·옵션 동시 만기' : '옵션 만기', imp: [3, 6, 9, 12].includes(mo) ? 3 : 2 });
    if (wd === 5 && day >= 15 && day <= 21) rows.push({ kind: 'expiry', d: iso, time: '', c: '미국', name: [3, 6, 9, 12].includes(mo) ? '쿼드러플 위칭(선물·옵션 동시 만기)' : '월간 옵션 만기', imp: [3, 6, 9, 12].includes(mo) ? 3 : 2 });
  }
  return rows.sort((a, b) => (a.d + (a.time || '99')).localeCompare(b.d + (b.time || '99')));
}

/* ── 선물 포지션 요약 ── */
export function cotSummary(S) {
  return (S.cot || []).map((c) => {
    const net = c.rows.map((r) => ({ d: r.d, net: r.long - r.short, oi: r.oi }));
    const last = net.at(-1), prev = net.at(-2);
    const win = net.slice(-156).map((x) => x.net), lo = Math.min(...win), hi = Math.max(...win);
    return { name: c.name, code: c.code, d: last?.d, net: last?.net, chg: last && prev ? last.net - prev.net : null, oi: last?.oi, idx: hi > lo ? round((last.net - lo) / (hi - lo) * 100, 0) : null, hist: net.map((x) => [x.d, x.net]) };
  });
}

/* ── FRED(미국 연준 경제 자료) 계열 ── [키, FRED id, 이름, 묶음, 종류, 단위]
   종류: pct=값 그대로(%), yoy=지수의 전년 대비 %, diff=전기 대비 변화, lvl=값 그대로 */
export const FRED = [
  ['FFU', 'DFEDTARU', '연준 기준금리(상단)', 'policy', 'pct', '%'], ['DFF', 'DFF', '실효 연방기금금리', 'policy', 'pct', '%'], ['SOFR', 'SOFR', 'SOFR(담보부 익일물)', 'policy', 'pct', '%'],
  ['SOFR30', 'SOFR30DAYAVG', 'SOFR 30일 평균', 'policy', 'pct', '%'], ['WALCL', 'WALCL', '연준 보유 자산', 'policy', 'lvl', '조달러', 1e-6],
  ['DGS2', 'DGS2', '미국 2년 국채', 'bond', 'pct', '%'], ['DGS10', 'DGS10', '미국 10년 국채', 'bond', 'pct', '%'], ['T10Y2Y', 'T10Y2Y', '장단기 금리차(10년−2년)', 'bond', 'pct', '%p'],
  ['IG', 'BAMLC0A0CM', '투자등급 회사채 가산금리', 'bond', 'pct', '%p'], ['HY', 'BAMLH0A0HYM2', '하이일드 회사채 가산금리', 'bond', 'pct', '%p'], ['MTG', 'MORTGAGE30US', '미국 30년 주택담보대출', 'bond', 'pct', '%'],
  ['KR3M', 'IR3TIB01KRM156N', '한국 3개월 금리(월간·지연)', 'kr', 'pct', '%'], ['KR10Y', 'IRLTLT01KRM156N', '한국 10년 국채(월간·지연)', 'kr', 'pct', '%'],
  ['CPI', 'CPIAUCSL', '미국 소비자물가(전년비)', 'macro', 'yoy', '%'], ['CORE', 'CPILFESL', '미국 근원 소비자물가(전년비)', 'macro', 'yoy', '%'], ['PCE', 'PCEPILFE', '미국 근원 PCE 물가(전년비)', 'macro', 'yoy', '%'],
  ['UNRATE', 'UNRATE', '미국 실업률', 'macro', 'pct', '%'], ['NFP', 'PAYEMS', '미국 비농업 고용 증감', 'macro', 'diff', '천명'], ['ICSA', 'ICSA', '신규 실업수당 청구', 'macro', 'lvl', '천건', 1e-3],
  ['GDP', 'A191RL1Q225SBEA', '미국 실질 GDP 성장률(분기, 연율)', 'macro', 'pct', '%'], ['UMCS', 'UMCSENT', '미시간대 소비자심리', 'macro', 'lvl', ''],
];
export function fredSummary(S) {
  const out = [];
  for (const [k, id, name, grp, kind, unit, mult = 1] of FRED) {
    let s = S.fred?.[k]; if (!s || s.length < 3) continue;
    if (kind === 'yoy') s = s.slice(12).map((x, i) => [x[0], (x[1] / s[i][1] - 1) * 100]);
    else if (kind === 'diff') s = s.slice(1).map((x, i) => [x[0], x[1] - s[i][1]]);
    else if (mult !== 1) s = s.map((x) => [x[0], x[1] * mult]);
    const last = s.at(-1), prev = s.at(-2), yr = s.find((x) => x[0] >= `${+last[0].slice(0, 4) - 1}${last[0].slice(4)}`) || s[0];
    out.push({ k, id, name, grp, unit, d: last[0], v: round(last[1], 2), prev: round(prev[1], 2), chg: round(last[1] - prev[1], 2), y1: round(last[1] - yr[1], 2), hist: s.slice(-260).map((x) => [x[0], round(x[1], 3)]) });
  }
  return out;
}
