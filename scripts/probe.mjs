// (임시) ETF 자금 흐름 출처 확인
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const T = {
  nvEtfListPC: 'https://finance.naver.com/api/sise/etfItemList.nhn?etfType=0&targetColumn=market_sum&sortOrder=desc',
  nvEtfM1: 'https://m.stock.naver.com/api/stocks/etf?page=1&pageSize=5',
  nvEtfM2: 'https://m.stock.naver.com/api/stocks/etf/ALL?page=1&pageSize=5',
  nvEtfM3: 'https://m.stock.naver.com/api/etf/list?page=1&pageSize=5',
  nvEtfBasic: 'https://m.stock.naver.com/api/stock/069500/basic',
  nvEtfInteg: 'https://m.stock.naver.com/api/stock/069500/integration',
  nvEtfTrend: 'https://m.stock.naver.com/api/stock/069500/trend?pageSize=3',
  nvEtfAnalysis: 'https://m.stock.naver.com/api/etf/069500/analysis',
  nvUsEtfBasic: 'https://api.stock.naver.com/etf/SPY/basic',
  nvUsEtfBasic2: 'https://api.stock.naver.com/stock/SPY/basic',
  nvUsEtfInteg: 'https://api.stock.naver.com/etf/SPY/integration',
  nasdaqSummary: 'https://api.nasdaq.com/api/quote/SPY/summary?assetclass=etf',
  nasdaqInfo: 'https://api.nasdaq.com/api/quote/SPY/info?assetclass=etf',
  ssgaNavHist: 'https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/navhist-us-en-spy.xlsx',
  ishares: 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/1467271812596.ajax?fileType=csv&fileName=IVV_holdings&dataType=fund',
  stockanalysis: 'https://stockanalysis.com/etf/spy/',
  yahooQS: 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/SPY?modules=defaultKeyStatistics,summaryDetail',
  yahooTS: 'https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/SPY?type=trailingMarketCap&period1=1750000000&period2=1800000000',
  farside: 'https://farside.co.uk/bitcoin-etf-flow-all-data/',
};
for (const [k, u] of Object.entries(T)) {
  try {
    const h = { 'User-Agent': UA, Accept: '*/*', 'Accept-Language': 'ko,en;q=0.8' };
    if (u.includes('naver')) h.Referer = 'https://m.stock.naver.com/';
    if (u.includes('nasdaq')) { h.Origin = 'https://www.nasdaq.com'; h.Referer = 'https://www.nasdaq.com/'; h.Accept = 'application/json, text/plain, */*'; }
    const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(25000) });
    const buf = Buffer.from(await r.arrayBuffer());
    let t = u.includes('etfItemList') ? new TextDecoder('euc-kr').decode(buf) : buf.toString('utf8');
    if (k === 'stockanalysis') t = (t.match(/Shares Out[\s\S]{0,300}/) || [''])[0] + ' || ' + (t.match(/Assets[\s\S]{0,200}/) || [''])[0];
    if (k === 'ssgaNavHist') t = `xlsx magic=${buf.subarray(0, 2).toString()} ct=${r.headers.get('content-type')}`;
    console.log(`\n### ${k} ${r.status} ${buf.length}B\n${t.replace(/\s+/g, ' ').slice(0, 1100)}`);
  } catch (e) { console.log(`\n### ${k} ERR ${e.message}`); }
}
