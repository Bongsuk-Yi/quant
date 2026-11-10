// 시장 자료 수집 → store.enc.json (이전 자료에 이어 붙임)
//   node scripts/collect.mjs store.enc.json
// 출처: 네이버 증권(국내 지수·수급·업종·테마·종목·뉴스·해외 대형주), Yahoo Finance(해외 지수·금리·환율·원자재),
//       CNN 공포탐욕, Nasdaq(경제 일정·실적 일정), CFTC(선물 포지션), OpenInsider(미국 내부자 매수), 언론사 RSS
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sitePassword, encrypt, decryptNode } from './gate.mjs';
import { FRED } from './analyze.mjs';
import { get, tryGet, failures, num, sleep, kstNow, kstDate, ymd, dash, addDays, weekday, parseRss, xlsxRows } from './lib.mjs';

const FILE = process.argv[2] || 'store.enc.json';
const pw = sitePassword();
const S = existsSync(FILE) ? JSON.parse(decryptNode(JSON.parse(readFileSync(FILE, 'utf8')), pw)) : {};
S.series ??= {}; S.flows ??= { KOSPI: {}, KOSDAQ: {} }; S.breadth ??= {}; S.news ??= [];
const M = 'https://m.stock.naver.com/api';
const today = kstDate();
const log = (...a) => console.log(...a);

/* ── 1. 시세 시계열 ───────────────────────────────── */
const YAHOO = [
  // [키, 심볼, 이름, 그룹, 배수]
  ['SPX', '^GSPC', 'S&P 500', 'us'], ['NDX', '^IXIC', '나스닥', 'us'], ['DJI', '^DJI', '다우', 'us'], ['RUT', '^RUT', '러셀 2000', 'us'], ['SOX', '^SOX', '필라델피아 반도체', 'us'],
  ['ES', 'ES=F', 'S&P 선물', 'fut'], ['NQ', 'NQ=F', '나스닥 선물', 'fut'],
  ['N225', '^N225', '닛케이', 'asia'], ['SSEC', '000001.SS', '상해종합', 'asia'], ['HSI', '^HSI', '항셍', 'asia'], ['TWII', '^TWII', '대만 가권', 'asia'],
  ['US3M', '^IRX', '미국 3개월', 'rate'], ['US5Y', '^FVX', '미국 5년', 'rate'], ['US10Y', '^TNX', '미국 10년', 'rate'], ['US30Y', '^TYX', '미국 30년', 'rate'],
  ['USDKRW', 'KRW=X', '원/달러', 'fx'], ['JPYKRW', 'JPYKRW=X', '원/100엔', 'fx', 100], ['EURKRW', 'EURKRW=X', '원/유로', 'fx'], ['CNYKRW', 'CNYKRW=X', '원/위안', 'fx'],
  ['DXY', 'DX-Y.NYB', '달러인덱스', 'fx'], ['USDJPY', 'JPY=X', '엔/달러', 'fx'],
  ['VIX', '^VIX', 'VIX', 'risk'], ['MOVE', '^MOVE', 'MOVE(채권 변동성)', 'risk'], ['HYG', 'HYG', '하이일드 채권 ETF', 'risk'], ['BTC', 'BTC-USD', '비트코인', 'risk'],
  ['WTI', 'CL=F', 'WTI 원유', 'cmd'], ['BRENT', 'BZ=F', '브렌트유', 'cmd'], ['GOLD', 'GC=F', '금', 'cmd'], ['SILVER', 'SI=F', '은', 'cmd'], ['COPPER', 'HG=F', '구리', 'cmd'], ['NATGAS', 'NG=F', '천연가스', 'cmd'],
  ['XLK', 'XLK', '기술', 'sector'], ['XLC', 'XLC', '커뮤니케이션', 'sector'], ['XLY', 'XLY', '경기소비재', 'sector'], ['XLF', 'XLF', '금융', 'sector'], ['XLV', 'XLV', '헬스케어', 'sector'],
  ['XLI', 'XLI', '산업재', 'sector'], ['XLE', 'XLE', '에너지', 'sector'], ['XLB', 'XLB', '소재', 'sector'], ['XLP', 'XLP', '필수소비재', 'sector'], ['XLU', 'XLU', '유틸리티', 'sector'],
  ['XLRE', 'XLRE', '부동산', 'sector'], ['SMH', 'SMH', '반도체', 'sector'],
];
const NAVER_IDX = [['KOSPI', 'KOSPI', '코스피', 'kr'], ['KOSDAQ', 'KOSDAQ', '코스닥', 'kr'], ['KPI200', 'KPI200', '코스피 200', 'kr']];

async function yahoo(sym, mult = 1) {
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2y&interval=1d`);
  const r = j.chart.result[0], q = r.indicators.quote[0], tz = r.meta.exchangeTimezoneName || 'UTC';
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const map = new Map();
  (r.timestamp || []).forEach((ts, i) => { const c = q.close[i]; if (c != null) map.set(fmt.format(new Date(ts * 1000)), +(c * mult).toPrecision(8)); });
  const last = r.meta.regularMarketPrice, lt = r.meta.regularMarketTime;
  if (last != null && lt) map.set(fmt.format(new Date(lt * 1000)), +(last * mult).toPrecision(8));
  return [...map].sort().map(([d, c]) => [d, c]);
}
async function naverIdx(sym) {
  const xml = await get(`https://fchart.stock.naver.com/sise.nhn?symbol=${sym}&timeframe=day&count=520&requestType=0`, { encoding: 'euc-kr' });
  return [...xml.matchAll(/data="(\d{8})\|([^"]+)"/g)].map(([, d, rest]) => [dash(d), num(rest.split('|')[3])]).filter((x) => x[1] > 0);
}
log('▶ 시계열');
S.seriesMeta = {};
for (const [k, sym, name, grp, mult] of YAHOO) {
  try { S.series[k] = await yahoo(sym, mult); S.seriesMeta[k] = { name, grp, src: 'Yahoo' }; } catch (e) { failures.push(`yahoo ${k}: ${e.message}`); if (S.series[k]) S.seriesMeta[k] = { name, grp, src: 'Yahoo', stale: true }; }
  await sleep(250);
}
for (const [k, sym, name, grp] of NAVER_IDX) {
  try { S.series[k] = await naverIdx(sym); S.seriesMeta[k] = { name, grp, src: '네이버' }; } catch (e) { failures.push(`naver idx ${k}: ${e.message}`); }
}
log('  계열', Object.keys(S.seriesMeta).length);

/* ── 2. 국내 지수 상세·투자자별 순매수(억원) ──────────── */
log('▶ 국내 지수·수급');
S.kr = {};
for (const mk of ['KOSPI', 'KOSDAQ']) {
  const b = await tryGet(`${mk} basic`, `${M}/index/${mk}/basic`);
  const ig = await tryGet(`${mk} integ`, `${M}/index/${mk}/integration`);
  const info = {}; for (const x of ig?.totalInfos || []) info[x.code] = x.value;
  S.kr[mk] = b ? { close: num(b.closePrice), chg: num(b.compareToPreviousClosePrice), pct: num(b.fluctuationsRatio), at: b.localTradedAt, status: b.marketStatus, value: info.accumulatedTradingValue, high52: num(info.highPriceOf52Weeks), low52: num(info.lowPriceOf52Weeks) } : S.kr?.[mk];
  // 날짜별 투자자 순매수: 오늘 + 없는 날짜 채우기(최근 90 거래일)
  const have = S.flows[mk];
  const days = []; for (let i = 0, d = today; days.length < 90 && i < 140; i++, d = addDays(today, -i)) { const w = weekday(d); if (w && w < 6) days.push(d); }
  let fetched = 0;
  for (const d of days) {
    const key = ymd(d);
    if (have[key] && d < addDays(today, -2)) continue;   // 최근 이틀은 확정치가 바뀔 수 있어 다시 받는다
    const t = await tryGet(`${mk} flow ${key}`, `${M}/index/${mk}/trend?bizdate=${key}`, { tries: 2 });
    if (t?.bizdate === key) { have[key] = { p: num(t.personalValue), f: num(t.foreignValue), i: num(t.institutionalValue) }; fetched++; }
    await sleep(120);
  }
  log(`  ${mk} 수급 새로 받음 ${fetched}일, 보유 ${Object.keys(have).length}일`);
}

/* ── 3. 업종·테마 (오른·내린 종목 수 = 시장 폭) ─────────── */
log('▶ 업종·테마');
async function groups(kind) {
  const out = [];
  for (let p = 1; p <= 5; p++) {
    const j = await tryGet(`${kind} p${p}`, `${M}/stocks/${kind}?page=${p}&pageSize=100`);
    const g = j?.groups || []; out.push(...g.map((x) => ({ no: x.no, name: x.name, n: x.totalCount, pct: num(x.changeRate), up: x.riseCount, down: x.fallCount, flat: x.steadyCount })));
    if (g.length < 100) break;
  }
  return out;
}
const industries = await groups('industry'), themes = await groups('theme');
async function leaders(list, kind) {   // 상위·하위 그룹마다 그날 가장 크게 움직인 종목
  const sorted = [...list].sort((a, b) => b.pct - a.pct);
  const pick = [...sorted.slice(0, 12), ...sorted.slice(-12)];
  for (const g of pick) {
    const j = await tryGet(`${kind} ${g.no}`, `${M}/stocks/${kind}/${g.no}?page=1&pageSize=60`);
    const st = (j?.stocks || []).map((s) => ({ code: s.itemCode, name: s.stockName, pct: num(s.fluctuationsRatio), val: num(s.accumulatedTradingValue) }));
    if (!st.length) continue;
    const dir = g.pct >= 0 ? 1 : -1;
    st.sort((a, b) => dir * (b.pct - a.pct));
    g.lead = st[0]; g.top = st.slice(0, 5);
    await sleep(120);
  }
}
if (industries.length) { await leaders(industries, 'industry'); S.industries = { at: new Date().toISOString(), list: industries }; }
if (themes.length) { await leaders(themes, 'theme'); S.themes = { at: new Date().toISOString(), list: themes }; }
if (industries.length) {
  const up = industries.reduce((s, g) => s + (g.up || 0), 0), down = industries.reduce((s, g) => s + (g.down || 0), 0), flat = industries.reduce((s, g) => s + (g.flat || 0), 0);
  const bd = S.kr.KOSPI?.at ? ymd(S.kr.KOSPI.at.slice(0, 10)) : ymd(today);
  S.breadth[bd] = { up, down, flat };
  log(`  업종 ${industries.length} · 테마 ${themes.length} · 오름 ${up} 내림 ${down}`);
}

/* ── 4. 움직인 종목 ──────────────────────────────── */
log('▶ 급등·급락');
const isCommon = (s) => s.stockEndType === 'stock' && !/우[A-C]?$|\d우|스팩|SPAC/.test(s.stockName);
const krRow = (s, mk) => ({ code: s.itemCode, name: s.stockName, mk, price: num(s.closePrice), pct: num(s.fluctuationsRatio), val: num(s.accumulatedTradingValue), cap: num(s.marketValue), limit: /LIMIT/.test(s.compareToPreviousPrice?.name || '') });
S.movers = { kr: { up: [], down: [], value: [] }, us: { up: [], down: [] } };
for (const mk of ['KOSPI', 'KOSDAQ']) {
  for (const [dir, path] of [['up', 'up'], ['down', 'down'], ['value', 'quantTop']]) {
    const j = await tryGet(`${mk} ${path}`, `${M}/stocks/${path}/${mk}?page=1&pageSize=100`);
    for (const s of j?.stocks || []) if (isCommon(s)) S.movers.kr[dir].push(krRow(s, mk === 'KOSPI' ? '코스피' : '코스닥'));
  }
}
const krOk = (r) => r.price >= 1000 && r.val >= 1000;   // 1,000원·거래대금 10억원(=1,000백만원) 이상
S.movers.kr.up = S.movers.kr.up.filter(krOk).sort((a, b) => b.pct - a.pct).slice(0, 30);
S.movers.kr.down = S.movers.kr.down.filter(krOk).sort((a, b) => a.pct - b.pct).slice(0, 30);
S.movers.kr.value = S.movers.kr.value.sort((a, b) => b.val - a.val).slice(0, 30);
// 미국: 거래소별 시가총액 상위 300 종목 중 등락 큰 순
const usBig = [];
for (const ex of ['NASDAQ', 'NYSE']) {
  for (let p = 1; p <= 3; p++) {
    const j = await tryGet(`${ex} cap p${p}`, `https://api.stock.naver.com/stock/exchange/${ex}/marketValue?page=${p}&pageSize=100`);
    for (const s of j?.stocks || []) usBig.push({ code: s.symbolCode, name: s.stockName, eng: s.stockNameEng, ex, price: num(s.closePrice), pct: num(s.fluctuationsRatio), cap: num(s.marketValue), ind: s.industryCodeType?.industryGroupKor || '' });
    await sleep(150);
  }
}
if (usBig.length) {
  const ok = usBig.filter((r) => r.pct != null);
  S.movers.us.up = [...ok].sort((a, b) => b.pct - a.pct).slice(0, 30);
  S.movers.us.down = [...ok].sort((a, b) => a.pct - b.pct).slice(0, 30);
  // 미국 업종(네이버 분류) 평균 등락
  const by = {}; for (const r of ok) { (by[r.ind] ??= []).push(r); }
  S.usIndustries = Object.entries(by).filter(([k, v]) => k && v.length >= 3).map(([name, v]) => { v.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)); return { name, n: v.length, pct: v.reduce((s, r) => s + r.pct, 0) / v.length, lead: v[0] }; });
  S.usBigAt = new Date().toISOString();
  log(`  미국 대형주 ${usBig.length}`);
}

/* ── 5. 공포·탐욕 (CNN) ───────────────────────────── */
log('▶ CNN 공포탐욕');
const fg = await tryGet('cnn', 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata', { headers: { Origin: 'https://edition.cnn.com', Referer: 'https://edition.cnn.com/' } });
if (fg?.fear_and_greed) {
  const comp = {};
  for (const [k, v] of Object.entries(fg)) if (v && typeof v === 'object' && 'score' in v && k !== 'fear_and_greed') comp[k] = { score: v.score, rating: v.rating };
  S.cnn = { now: fg.fear_and_greed, comp, hist: (fg.fear_and_greed_historical?.data || []).map((p) => [new Date(p.x).toISOString().slice(0, 10), Math.round(p.y * 10) / 10]) };
}

/* ── 6. 뉴스 (제목·링크만) ────────────────────────── */
log('▶ 뉴스');
const news = [];
for (const cat of ['mainnews', 'flashnews']) {
  for (let p = 1; p <= 3; p++) {
    const arr = await tryGet(`naver ${cat} ${p}`, `${M}/news/list?category=${cat}&page=${p}&pageSize=20`);
    for (const n of Array.isArray(arr) ? arr : []) {
      const dt = String(n.dt || ''); const ts = Date.parse(`${dash(dt.slice(0, 8))}T${dt.slice(8, 10)}:${dt.slice(10, 12)}:00+09:00`);
      news.push({ title: String(n.tit || '').replace(/<[^>]+>/g, '').trim(), url: `https://n.news.naver.com/mnews/article/${n.oid}/${n.aid}`, src: n.ohnm || '네이버', ts, sum: String(n.subcontent || '').slice(0, 140), main: cat === 'mainnews' });
    }
  }
}
const RSS = [
  ['연합뉴스', 'https://www.yna.co.kr/rss/economy.xml'], ['연합뉴스', 'https://www.yna.co.kr/rss/market.xml'], ['연합인포맥스', 'https://news.einfomax.co.kr/rss/allArticle.xml'],
  ['매일경제', 'https://www.mk.co.kr/rss/50200011/'], ['매일경제', 'https://www.mk.co.kr/rss/30100041/'], ['CNBC', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664'],
  ['CNBC', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258'],
  ['구글뉴스', 'https://news.google.com/rss/search?q=%EC%A6%9D%EC%8B%9C+OR+%EC%BD%94%EC%8A%A4%ED%94%BC+OR+%EB%89%B4%EC%9A%95%EC%A6%9D%EC%8B%9C+when:1d&hl=ko&gl=KR&ceid=KR:ko'],
];
for (const [src, url] of RSS) {
  const xml = await tryGet(`rss ${src}`, url, { json: false });
  if (xml) news.push(...parseRss(xml, src).map((x) => ({ ...x, src: x.src.replace(/\s*-\s*$/, '') })));
}
const keep = Date.now() - 72 * 3600e3;
const seen = new Set(); const merged = [];
for (const n of [...news, ...S.news]) {
  if (!n.title || n.ts < keep) continue;
  const k = n.title.replace(/[\s\p{P}]/gu, '').slice(0, 40);
  if (seen.has(k)) continue; seen.add(k); merged.push(n);
}
S.news = merged.sort((a, b) => b.ts - a.ts).slice(0, 600);
log(`  기사 ${S.news.length}`);

/* ── 7. 일정 (경제지표·실적·만기) ─────────────────── */
log('▶ 일정');
const NQH = { Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' };
const econ = [], earn = [];
for (let i = -1; i <= 8; i++) {
  const d = addDays(today, i);
  const e = await tryGet(`econ ${d}`, `https://api.nasdaq.com/api/calendar/economicevents?date=${d}`, { headers: NQH });
  for (const r of e?.data?.rows || []) econ.push({ d, t: r.gmt, c: r.country, name: r.eventName, act: (r.actual || '').trim(), cons: (r.consensus || '').trim(), prev: (r.previous || '').trim() });
  if (i >= 0 && weekday(d) && weekday(d) < 6) {
    const x = await tryGet(`earn ${d}`, `https://api.nasdaq.com/api/calendar/earnings?date=${d}`, { headers: NQH });
    for (const r of x?.data?.rows || []) { const cap = num(r.marketCap); if (cap >= 3e10) earn.push({ d, sym: r.symbol, name: r.name, cap, when: r.time, eps: r.epsForecast }); }
  }
  await sleep(200);
}
if (econ.length || earn.length) S.calendar = { at: new Date().toISOString(), econ, earn };
log(`  경제 일정 ${econ.length} · 대형 실적 ${earn.length}`);

/* ── 8. 선물 포지션 (CFTC, 주간) ─────────────────── */
log('▶ CFTC');
const COT = { '13874A': 'S&P 500 E-mini', '209742': '나스닥 100 E-mini', '043602': '미국 10년물 국채', '088691': '금', '067651': 'WTI 원유', '097741': '일본 엔', '099741': '유로', '098662': '달러인덱스', '133741': '비트코인', '1170E1': 'VIX' };
const cot = await tryGet('cftc', `https://publicreporting.cftc.gov/resource/6dca-aqww.json?$where=${encodeURIComponent(`cftc_contract_market_code in(${Object.keys(COT).map((c) => `'${c}'`).join(',')})`)}&$order=report_date_as_yyyy_mm_dd DESC&$limit=1200`);
if (Array.isArray(cot) && cot.length) {
  const by = {};
  for (const r of cot) {
    const c = r.cftc_contract_market_code; (by[c] ??= []).push({ d: r.report_date_as_yyyy_mm_dd.slice(0, 10), long: num(r.noncomm_positions_long_all), short: num(r.noncomm_positions_short_all), oi: num(r.open_interest_all) });
  }
  S.cot = Object.entries(by).map(([code, rows]) => ({ code, name: COT[code], rows: rows.sort((a, b) => (a.d < b.d ? -1 : 1)).slice(-104) }));
  log(`  계약 ${S.cot.length}`);
}

/* ── 9. 미국 내부자 매수 (OpenInsider, SEC Form 4 정리) ─── */
log('▶ 내부자');
const oi = await tryGet('openinsider', 'http://openinsider.com/latest-insider-purchases-25k', { json: false });
if (oi) {
  const tb = oi.match(/<table[^>]*class="tinytable"[\s\S]*?<\/table>/);
  const rows = [];
  for (const tr of (tb?.[0] || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const td = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    if (td.length >= 13) rows.push({ filed: td[1], trade: td[2], sym: td[3], co: td[4], who: td[5], title: td[6], type: td[7], price: num(td[8]), qty: num(td[9]), own: td[10], chg: td[11], value: num(td[12]) });
  }
  if (rows.length) S.insider = { at: new Date().toISOString(), rows: rows.slice(0, 80) };
  log(`  내부자 매수 ${rows.length}`);
}

/* ── 10. 금리·거시 지표 ──
   (가) 뉴욕 연준 공개 API(키 없음): SOFR, 실효 연방기금금리, 기준금리 목표 상단 — 매번
   (나) FRED 공식 API(무료 키 FRED_API_KEY 필요): 국채·회사채 가산금리·거시 지표 — 6시간마다
        ※ 키 없는 FRED CSV 주소는 GitHub Actions에서 응답하지 않아 쓰지 않는다 */
log('▶ 금리(뉴욕 연준)'); S.fred ??= {};
for (const [k, path] of [['SOFR', 'secured/sofr'], ['DFF', 'unsecured/effr']]) {
  const j = await tryGet(`nyfed ${k}`, `https://markets.newyorkfed.org/api/rates/${path}/last/400.json`, { tries: 2 });
  const rows = (j?.refRates || []).map((r) => [r.effectiveDate, num(r.percentRate), num(r.targetRateTo)]).filter((r) => r[1] != null).sort();
  if (rows.length > 2) { S.fred[k] = rows.map((r) => [r[0], r[1]]); if (k === 'DFF' && rows.some((r) => r[2] != null)) S.fred.FFU = rows.filter((r) => r[2] != null).map((r) => [r[0], r[2]]); }
}
const FKEY = (process.env.FRED_API_KEY || '').trim();
S.fredKey = !!FKEY;
if (FKEY && (!S.fredAt || Date.now() - Date.parse(S.fredAt) > 6 * 3600e3)) {
  log('▶ FRED'); let ok = 0, bad = 0;
  for (const [k, id] of FRED) {
    if (bad >= 3 && !ok) break;   // 처음부터 계속 실패하면 그만둔다
    let j = null;
    try { j = await get(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FKEY}&file_type=json&observation_start=${addDays(today, -1500)}`, { tries: 2, timeout: 20000 }); }
    catch (e) { failures.push(`fred ${id}: ${String(e.message).replace(FKEY, '***').slice(-60)}`); }
    const rows = (j?.observations || []).map((o) => [o.date, parseFloat(o.value)]).filter((x) => Number.isFinite(x[1]));
    if (rows.length > 2) { S.fred[k] = rows; ok++; } else bad++;
    await sleep(250);
  }
  if (ok) S.fredAt = new Date().toISOString();
  log(`  FRED 계열 ${ok}/${FRED.length}`);
}

/* ── 11. 옵션 기대 변동폭 (CBOE 지연 시세, 3시간마다) ── */
if (!S.options?.at || Date.now() - Date.parse(S.options.at) > 3 * 3600e3) {
  log('▶ 옵션');
  const OPT = [['SPY', 'S&P 500 ETF'], ['QQQ', '나스닥 100 ETF'], ['IWM', '러셀 2000 ETF'], ['NVDA', '엔비디아'], ['AAPL', '애플'], ['MSFT', '마이크로소프트'], ['AMZN', '아마존'], ['GOOGL', '알파벳'], ['META', '메타'], ['TSLA', '테슬라'], ['AMD', 'AMD'], ['AVGO', '브로드컴'], ['MU', '마이크론'], ['PLTR', '팔란티어'], ['TSM', 'TSMC']];
  const list = [];
  for (const [sym, name] of OPT) {
    const j = await tryGet(`cboe ${sym}`, `https://cdn.cboe.com/api/global/delayed_quotes/options/${sym}.json`, { tries: 2, timeout: 60000 });
    const d = j?.data; const price = num(d?.current_price) ?? num(d?.close);
    if (!d?.options?.length || !price) continue;
    const exps = {}; let cv = 0, pv = 0, co = 0, po = 0;
    for (const o of d.options) {
      const m = /^([A-Z.]+)(\d{6})([CP])(\d{8})$/.exec(o.option || ''); if (!m) continue;
      const exp = `20${m[2].slice(0, 2)}-${m[2].slice(2, 4)}-${m[2].slice(4)}`, K = +m[4] / 1000, bid = num(o.bid), ask = num(o.ask);
      const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : num(o.last_trade_price);
      if (m[3] === 'C') { cv += o.volume || 0; co += o.open_interest || 0; } else { pv += o.volume || 0; po += o.open_interest || 0; }
      ((exps[exp] ??= {})[K] ??= {})[m[3]] = { mid, iv: num(o.iv) };
    }
    const usToday = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
    const dte = (e) => Math.round((Date.parse(e) - Date.parse(usToday)) / 864e5);
    const keys = Object.keys(exps).sort().filter((e) => dte(e) >= 1);
    const pick = [keys[0], keys.find((e) => dte(e) >= 6), keys.find((e) => dte(e) >= 25)].filter((e, i, a) => e && a.indexOf(e) === i);
    const rows = [];
    for (const e of pick) {
      const ks = Object.keys(exps[e]).map(Number).filter((K) => exps[e][K].C?.mid > 0 && exps[e][K].P?.mid > 0).sort((a, b) => Math.abs(a - price) - Math.abs(b - price));
      if (!ks.length) continue; const K = ks[0], st = exps[e][K].C.mid + exps[e][K].P.mid;
      rows.push({ exp: e, dte: dte(e), K, straddle: +st.toFixed(2), em: +(st / price * 100).toFixed(2), iv: exps[e][K].C.iv ? +(((exps[e][K].C.iv + (exps[e][K].P.iv || exps[e][K].C.iv)) / 2) * 100).toFixed(1) : null });
    }
    if (rows.length) list.push({ sym, name, price, pct: num(d.percent_change) ?? num(d.price_change_percent), iv30: num(d.iv30), rows, pcrVol: cv ? +(pv / cv).toFixed(2) : null, pcrOI: co ? +(po / co).toFixed(2) : null, vol: cv + pv });
    await sleep(300);
  }
  if (list.length) S.options = { at: new Date().toISOString(), list };
  log(`  옵션 ${list.length}/${OPT.length}`);
}

/* ── 12. 커뮤니티 관심 (미국: ApeWisdom의 Reddit 언급 집계 / 한국: 네이버 검색 상위) ── */
log('▶ 커뮤니티');
{
  const ape = await tryGet('apewisdom', 'https://apewisdom.io/api/v1.0/filter/all-stocks/page/1', { tries: 2 });
  const us = (ape?.results || []).slice(0, 40).map((r) => ({ sym: r.ticker, name: String(r.name || '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'"), m: +r.mentions, m0: +r.mentions_24h_ago || 0, rank: +r.rank, rank0: +r.rank_24h_ago || null, up: +r.upvotes }));
  const kr = [];
  for (const mk of ['KOSPI', 'KOSDAQ']) {
    const j = await tryGet(`naver searchTop ${mk}`, `${M}/stocks/searchTop/${mk}?page=1&pageSize=20`, { tries: 1 });
    for (const st of j?.stocks || []) kr.push({ code: st.itemCode, name: st.stockName, mk, price: num(st.closePrice), pct: num(st.fluctuationsRatio) });
  }
  if (us.length || kr.length) S.community = { at: new Date().toISOString(), us: us.length ? us : S.community?.us || [], kr: kr.length ? kr : S.community?.kr || [] };
  log(`  미국 ${us.length} · 한국 ${kr.length}`);
}

/* ── 13. 외국인·기관이 산 업종·종목 (수급분석 모니터링 사이트의 수집 자료 재사용) ── */
log('▶ 종목 수급(stock-monitoring)');
try {
  const env = await get('https://raw.githubusercontent.com/Bongsuk-Yi/stock-monitoring/data/store.enc.json', { timeout: 90000 });
  const X = JSON.parse(decryptNode(env, pw)), st = Object.values(X.stocks || {}).filter((x) => x.d?.length > 6 && x.frg && x.org);
  const lastD = st.map((x) => x.d.at(-1)).sort().at(-1);
  const rows = [];
  for (const x of st) {
    if (x.d.at(-1) !== lastD) continue; const n = x.d.length;
    const amt = (arr, i) => (Number.isFinite(arr[i]) ? arr[i] * x.c[i] / 1e8 : 0), sum5 = (arr) => { let s = 0; for (let i = n - 5; i < n; i++) s += amt(arr, i); return s; };
    if (!Number.isFinite(x.frg[n - 1]) && !Number.isFinite(x.org[n - 1])) continue;
    rows.push({ code: x.code, name: x.name, sector: x.sector || '기타', pct: +((x.c[n - 1] / x.c[n - 2] - 1) * 100).toFixed(2), f1: Math.round(amt(x.frg, n - 1)), i1: Math.round(amt(x.org, n - 1)), f5: Math.round(sum5(x.frg)), i5: Math.round(sum5(x.org)) });
  }
  const by = {};
  for (const r of rows) { const g = (by[r.sector] ??= { name: r.sector, n: 0, f1: 0, i1: 0, f5: 0, i5: 0, st: [] }); g.n++; g.f1 += r.f1; g.i1 += r.i1; g.f5 += r.f5; g.i5 += r.i5; g.st.push(r); }
  const sectors = Object.values(by).map((g) => { g.st.sort((a, b) => Math.abs(b.f1 + b.i1) - Math.abs(a.f1 + a.i1)); const { st: list, ...rest } = g; return { ...rest, lead: list[0] && { name: list[0].name, code: list[0].code, v: list[0].f1 + list[0].i1 } }; });
  const tot = (r) => r.f1 + r.i1;
  if (rows.length > 50) S.smFlow = { at: X.updated, d: lastD, n: rows.length, sectors, buy: [...rows].sort((a, b) => tot(b) - tot(a)).slice(0, 25), sell: [...rows].sort((a, b) => tot(a) - tot(b)).slice(0, 25) };
  log(`  종목 ${rows.length} · 업종 ${sectors.length} · 기준 ${lastD}`);
} catch (e) { failures.push(`stock-monitoring 자료: ${e.message}`); log('  ✗', e.message); }

/* ── 14. ETF 자금 흐름 ── 자금 흐름 = 상장좌수 증감 × 순자산가치(NAV)
   한국: 네이버 ETF 목록(가격·NAV·시가총액) → 좌수 = 시가총액 ÷ 가격. 거래가 있는 날 스냅숏을 쌓는다 (45일 보관)
         + 시가총액 상위 40개 ETF의 투자자별 순매수(네이버 종목 수급)
   미국: SPDR 계열은 운용사(SSGA) NAV 이력 파일(좌수·순자산 과거 이력 포함)
         그 외는 Nasdaq 요약의 순자산 스냅숏 → 순자산 변화 − 가격 변동분 (추정) */
log('▶ ETF 자금 흐름');
S.etf ??= {}; S.etf.kr ??= { meta: {}, snap: {}, trend: {} }; S.etf.us ??= { ssga: {}, nq: {} };
{
  const E = S.etf.kr, txt = await tryGet('naver etf 목록', 'https://finance.naver.com/api/sise/etfItemList.nhn?etfType=0&targetColumn=market_sum&sortOrder=desc', { encoding: 'euc-kr', tries: 2, headers: { Referer: 'https://finance.naver.com/sise/etf.naver' } });
  let list = []; try { list = JSON.parse(txt || '{}').result?.etfItemList || []; } catch (_) {}
  const kDate = S.kr?.KOSPI?.at?.slice(0, 10);
  if (list.length > 100) {
    E.meta = {}; for (const it of list) E.meta[it.itemcode] = { name: it.itemname, tab: it.etfTabCode, price: it.nowVal, pct: it.changeRate, mcap: it.marketSum };
    if (kDate === today || !Object.keys(E.snap).length) {   // 오늘 장이 열렸을 때만 그날 스냅숏으로 기록(처음 한 번은 기준점으로 저장)
      const snap = {}; for (const it of list) if (it.nowVal > 0 && it.marketSum >= 50) snap[it.itemcode] = [Math.round(it.marketSum * 1e8 / it.nowVal), it.nav || it.nowVal, it.marketSum];
      E.snap[kDate || today] = snap;
      for (const d of Object.keys(E.snap).sort().slice(0, -45)) delete E.snap[d];
    }
    if (!E.trendAt || Date.now() - Date.parse(E.trendAt) > 3 * 3600e3) {
      const top = [...list].sort((a, b) => b.marketSum - a.marketSum).slice(0, 40); let ok = 0;
      for (const it of top) {
        const arr = await tryGet(`etf 수급 ${it.itemcode}`, `${M}/stock/${it.itemcode}/trend?pageSize=30`, { tries: 2 });
        if (Array.isArray(arr) && arr.length) { E.trend[it.itemcode] = arr.map((x) => ({ d: String(x.bizdate), f: num(x.foreignerPureBuyQuant), o: num(x.organPureBuyQuant), p: num(x.individualPureBuyQuant), c: num(x.closePrice) })).sort((a, b) => (a.d < b.d ? -1 : 1)); ok++; }
        await sleep(120);
      }
      for (const c of Object.keys(E.trend)) if (!top.some((t) => t.itemcode === c)) delete E.trend[c];
      if (ok) E.trendAt = new Date().toISOString();
    }
  }
  log(`  한국 ETF ${list.length} · 스냅숏 ${Object.keys(E.snap).length}일 · 투자자별 ${Object.keys(E.trend).length}`);
}
{
  const U = S.etf.us;
  const SSGA = ['SPY', 'XLK', 'XLF', 'XLV', 'XLY', 'XLC', 'XLI', 'XLE', 'XLP', 'XLU', 'XLB', 'XLRE', 'XBI', 'KRE', 'XOP', 'XHB', 'XME', 'MDY', 'DIA'];
  if (U.ssgaV !== 2) { U.ssgaAt = null; U.ssga = {}; U.ssgaV = 2; }   // 숫자 읽기 방식을 고친 뒤 다시 받기
  if (!U.ssgaAt || Date.now() - Date.parse(U.ssgaAt) > 6 * 3600e3) {
    let ok = 0, shown = false;
    for (const t of SSGA) {
      try {
        const rows = xlsxRows(await get(`https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/navhist-us-en-${t.toLowerCase()}.xlsx`, { buffer: true, tries: 2, timeout: 60000 }));
        const hi = rows.findIndex((r) => r.some((c) => /^nav$/i.test(String(c || '').trim())) && r.some((c) => /shares outstanding/i.test(String(c || ''))));
        if (hi < 0) throw new Error('머리글(NAV·Shares Outstanding)을 찾지 못함: ' + JSON.stringify(rows.slice(0, 6)).slice(0, 300));
        const H = rows[hi].map((c) => String(c || '').trim()), ci = (re) => H.findIndex((c) => re.test(c));
        const cD = Math.max(0, ci(/date/i)), cN = ci(/^nav$/i), cS = ci(/shares outstanding/i), cA = ci(/total net assets/i);
        if (!shown) { log('  SSGA 머리글:', JSON.stringify(H), '첫 줄:', JSON.stringify(rows[hi + 1])); shown = true; }
        const toDate = (v) => { const n = Number(v); const ms = Number.isFinite(n) && n > 20000 ? Date.UTC(1899, 11, 30) + n * 864e5 : Date.parse(String(v) + ' UTC'); return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null; };
        const nf = (v) => { const n = Number(String(v ?? '').replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : null; };   // 1.05E9 같은 지수 표기도 읽는다
        const data = rows.slice(hi + 1).map((r) => [toDate(r[cD]), nf(r[cN]), nf(r[cS]), cA >= 0 ? nf(r[cA]) : null]).filter((r) => r[0] && r[1] > 0 && r[2] > 0).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-300);
        if (data.length > 5) { U.ssga[t] = data; ok++; } else throw new Error('자료 줄이 없음');
      } catch (e) { failures.push(`ssga ${t}: ${String(e.message).slice(0, 200)}`); log('  ✗ ssga', t, String(e.message).slice(0, 300)); if (!ok && failures.filter((f) => f.startsWith('ssga')).length >= 3) break; }
      await sleep(300);
    }
    if (ok) U.ssgaAt = new Date().toISOString();
    log(`  미국 SPDR ${ok}/${SSGA.length}`);
  }
  const NQ = ['QQQ', 'IVV', 'VOO', 'VTI', 'IWM', 'EFA', 'EEM', 'EWY', 'EWJ', 'FXI', 'KWEB', 'INDA', 'TLT', 'IEF', 'SHY', 'LQD', 'HYG', 'AGG', 'GLD', 'SLV', 'USO', 'SMH', 'SOXX', 'ARKK', 'IBIT', 'VNQ'];
  if (!U.nqAt || Date.now() - Date.parse(U.nqAt) > 3 * 3600e3) {
    let ok = 0; const NQH2 = { Accept: 'application/json, text/plain, */*', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' };
    for (const t of NQ) {
      const j = await tryGet(`nasdaq etf ${t}`, `https://api.nasdaq.com/api/quote/${t}/summary?assetclass=etf`, { headers: NQH2, tries: 2 });
      const sd = j?.data?.summaryData, aum = num(sd?.AUM?.value), px = num(sd?.PreviousClose?.value);
      if (aum > 0 && px > 0) { const arr = (U.nq[t] ??= []), last = arr.at(-1); if (!last || last[1] !== aum * 1000) arr.push([new Date().toISOString().slice(0, 10), aum * 1000, px]); if (arr.length > 90) arr.splice(0, arr.length - 90); ok++; }
      await sleep(200);
    }
    if (ok) U.nqAt = new Date().toISOString();
    log(`  미국 기타 ${ok}/${NQ.length}`);
  }
}

S.updated = new Date().toISOString();
S.failures = failures.slice(0, 60);
writeFileSync(FILE, JSON.stringify(encrypt(JSON.stringify(S), pw)));
log(`\n완료 — 실패 ${failures.length}건`); if (failures.length) log(failures.slice(0, 40).join('\n'));
