// 시장 자료 수집 → store.enc.json (이전 자료에 이어 붙임)
//   node scripts/collect.mjs store.enc.json
// 출처: 네이버 증권(국내 지수·수급·업종·테마·종목·뉴스·해외 대형주), Yahoo Finance(해외 지수·금리·환율·원자재),
//       CNN 공포탐욕, Nasdaq(경제 일정·실적 일정), CFTC(선물 포지션), OpenInsider(미국 내부자 매수), 언론사 RSS
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { sitePassword, encrypt, decryptNode } from './gate.mjs';
import { get, tryGet, failures, num, sleep, kstNow, kstDate, ymd, dash, addDays, weekday, parseRss } from './lib.mjs';

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

S.updated = new Date().toISOString();
S.failures = failures.slice(0, 60);
writeFileSync(FILE, JSON.stringify(encrypt(JSON.stringify(S), pw)));
log(`\n완료 — 실패 ${failures.length}건`); if (failures.length) log(failures.slice(0, 40).join('\n'));
