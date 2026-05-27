/**
 * app/api/stock/route.ts
 * GET /api/stock?ticker=AAPL
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  우선순위 체인                                                       │
 * │  1. Alpha Vantage  (STOCK_API_KEY)  — 일 25회, 분당 5회            │
 * │     └→ Rate Limit / 오류 발생 시                                    │
 * │  2. Finnhub        (FINNHUB_API_KEY) — 분당 60회, 실질적 무제한     │
 * │     └→ 실패 시 (한국 주식 등 403 응답 포함)                          │
 * │  3. Yahoo Finance  (키 불필요) — 차트 + 기본 펀더멘털               │
 * │     └→ 실패 시                                                       │
 * │  4. 503 에러 응답                                                    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * 반환 타입: StockData (lib/types.ts)
 */

import type { NextRequest } from 'next/server';
import {
  COMPANY_DB,
  type CompanyFundamentals,
  type ChartRow,
} from '@/lib/mockData';
import { calculateSMA, calculateRSI, calculateMACD } from '@/lib/analysis';
import type { StockData } from '@/lib/types';

/* ─────────────────────────────────────────────
 * 공통 수치 파싱 헬퍼
 * ───────────────────────────────────────────── */
function sf(v: string | number | undefined | null, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return isNaN(n) ? fallback : n;
}
function si(v: string | number | undefined | null, fallback = 0): number {
  const n = typeof v === 'number' ? Math.round(v) : parseInt(String(v ?? ''), 10);
  return isNaN(n) ? fallback : n;
}

/* ─────────────────────────────────────────────
 * 공통 포맷 헬퍼
 * ───────────────────────────────────────────── */
function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n}`;
}
function fmtCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  return         `$${(n / 1e6).toFixed(0)}M`;
}

/* ─────────────────────────────────────────────
 * 기술지표 계산 (SMA / RSI / MACD)
 * ───────────────────────────────────────────── */
function buildChartRows(bars: {
  date: string; open: number; high: number; low: number; close: number; volume: number;
}[]): { rows: ChartRow[]; allCloses: number[] } {
  const closes = bars.map(b => b.close);
  const sma20  = calculateSMA(closes, 20);
  const sma60  = calculateSMA(closes, 60);
  const rsi14  = calculateRSI(closes, 14);
  const macd   = calculateMACD(closes, 12, 26, 9);
  const rows: ChartRow[] = bars.map((b, i) => ({
    ...b,
    sma20:      sma20[i],
    sma60:      sma60[i],
    rsi:        rsi14[i],
    macdLine:   macd[i].macdLine,
    signalLine: macd[i].signalLine,
    histogram:  macd[i].histogram,
  }));
  return { rows, allCloses: closes };
}

/* ═══════════════════════════════════════════════════════════════════════
 * ① ALPHA VANTAGE
 * ═══════════════════════════════════════════════════════════════════════ */
const AV = 'https://www.alphavantage.co/query';

interface AVTimeSeries {
  'Time Series (Daily)'?: Record<string, {
    '1. open': string; '2. high': string; '3. low': string;
    '4. close': string; '5. volume': string;
  }>;
  Note?: string; Information?: string; 'Error Message'?: string;
}
interface AVOverview {
  Name?: string; Description?: string; Exchange?: string;
  Sector?: string; Industry?: string; FullTimeEmployees?: string;
  MarketCapitalization?: string; EBITDA?: string;
  PERatio?: string; PriceToBookRatio?: string; ReturnOnEquityTTM?: string;
  EVToEBITDA?: string; DividendYield?: string; OperatingMarginTTM?: string;
  ProfitMargin?: string; GrossProfitTTM?: string; RevenueTTM?: string;
  SharesOutstanding?: string; '52WeekHigh'?: string; '52WeekLow'?: string;
  QuarterlyRevenueGrowthYOY?: string;
  Note?: string; Information?: string; 'Error Message'?: string;
}

async function avTimeSeries(ticker: string, key: string): Promise<AVTimeSeries> {
  const url = `${AV}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(ticker)}&outputsize=compact&apikey=${key}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`AV HTTP ${res.status}`);
  const d: AVTimeSeries = await res.json();
  if (d.Note)            throw new Error('AV_RATE_LIMIT');
  if (d.Information)     throw new Error('AV_RATE_LIMIT');
  if (d['Error Message']) throw new Error(`AV_ERROR: ${d['Error Message']}`);
  return d;
}

async function avOverview(ticker: string, key: string): Promise<AVOverview> {
  const url = `${AV}?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${key}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`AV HTTP ${res.status}`);
  const d: AVOverview = await res.json();
  if (d.Note)            throw new Error('AV_RATE_LIMIT');
  if (d.Information)     throw new Error('AV_RATE_LIMIT');
  if (d['Error Message']) throw new Error(`AV_ERROR: ${d['Error Message']}`);
  return d;
}

function mapAV(
  ticker: string,
  ts: AVTimeSeries,
  ov: AVOverview,
  fb: CompanyFundamentals | undefined,
): StockData {
  const rawSeries = ts['Time Series (Daily)'];
  if (!rawSeries) throw new Error('AV: Time Series 없음');

  const bars = Object.entries(rawSeries)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-100)
    .map(([date, d]) => {
      const [, mm, dd] = date.split('-');
      return {
        date: `${mm}/${dd}`,
        open:   Math.round(sf(d['1. open'])  * 100) / 100,
        high:   Math.round(sf(d['2. high'])  * 100) / 100,
        low:    Math.round(sf(d['3. low'])   * 100) / 100,
        close:  Math.round(sf(d['4. close']) * 100) / 100,
        volume: si(d['5. volume']),
      };
    });

  const { rows: allRows, allCloses } = buildChartRows(bars);
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2] ?? last;
  const lastIdx = allRows.length - 1;

  const change  = Math.round((last.close - prev.close) * 100) / 100;
  const changePct = Math.round((change / prev.close) * 10000) / 100;

  const sharesM   = si(ov.SharesOutstanding) > 0 ? Math.round(si(ov.SharesOutstanding) / 1e6) : (fb?.shares ?? 1000);
  const capRaw    = si(ov.MarketCapitalization);
  const gp        = sf(ov.GrossProfitTTM);
  const rev       = sf(ov.RevenueTTM);
  const grossM    = gp > 0 && rev > 0 ? Math.round((gp / rev) * 1000) / 10 : (fb?.grossMargin ?? 30);

  return {
    ticker,
    name:        ov.Name        || fb?.name        || ticker,
    sector:      ov.Sector      || fb?.sector      || 'N/A',
    industry:    ov.Industry    || fb?.industry    || 'N/A',
    exchange:    ov.Exchange    || fb?.exchange    || 'N/A',
    employees:   si(ov.FullTimeEmployees) > 0
                   ? si(ov.FullTimeEmployees).toLocaleString()
                   : (fb?.employees ?? 'N/A'),
    description: ov.Description || fb?.description || '',
    currentPrice: last.close,
    change,
    changePercent: changePct,
    volume:    fmtVol(last.volume),
    marketCap: capRaw > 0 ? fmtCap(capRaw) : (fb?.marketCap ?? 'N/A'),
    week52High: sf(ov['52WeekHigh'],  fb?.week52High  ?? last.close * 1.2),
    week52Low:  sf(ov['52WeekLow'],   fb?.week52Low   ?? last.close * 0.8),
    fcf:     fb?.fcf    ?? Math.round(sf(ov.EBITDA) / 1e6 * 0.6),
    shares:  sharesM,
    netDebt: fb?.netDebt ?? 0,
    defaultGrowthRate:     fb?.defaultGrowthRate    ?? Math.min(Math.max(sf(ov.QuarterlyRevenueGrowthYOY, 0.08), 0.02), 0.40),
    defaultWACC:           fb?.defaultWACC          ?? 0.09,
    defaultTerminalGrowth: fb?.defaultTerminalGrowth ?? 0.03,
    per:     sf(ov.PERatio,          fb?.per     ?? 20),
    pbr:     sf(ov.PriceToBookRatio, fb?.pbr     ?? 3),
    roe:     sf(ov.ReturnOnEquityTTM) > 0 ? Math.round(sf(ov.ReturnOnEquityTTM) * 1000) / 10 : (fb?.roe ?? 15),
    evEbitda: sf(ov.EVToEBITDA,       fb?.evEbitda ?? 15),
    dividendYield: sf(ov.DividendYield) > 0 ? Math.round(sf(ov.DividendYield) * 10000) / 100 : (fb?.dividendYield ?? 0),
    industryPer:      fb?.industryPer      ?? 22,
    industryPbr:      fb?.industryPbr      ?? 4,
    industryRoe:      fb?.industryRoe      ?? 20,
    industryEvEbitda: fb?.industryEvEbitda ?? 15,
    grossMargin:     grossM,
    operatingMargin: sf(ov.OperatingMarginTTM) > 0 ? Math.round(sf(ov.OperatingMarginTTM) * 1000) / 10 : (fb?.operatingMargin ?? 15),
    netMargin:       sf(ov.ProfitMargin)       > 0 ? Math.round(sf(ov.ProfitMargin)        * 1000) / 10 : (fb?.netMargin       ?? 10),
    debtToEquity: fb?.debtToEquity ?? 0.5,
    currentRatio: fb?.currentRatio ?? 1.5,
    chartRows:   allRows.slice(-90),
    allPrices:   allCloses,
    latestRSI:   calculateRSI(allCloses, 14)[lastIdx],
    latestSMA20: calculateSMA(allCloses, 20)[lastIdx],
    latestSMA60: calculateSMA(allCloses, 60)[lastIdx],
    source:    'live',
    provider:  'alphavantage',
    fetchedAt: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * ② FINNHUB (현재가 + 펀더멘털)  +  Yahoo Finance (OHLCV 차트)
 *
 * Finnhub 무료 플랜은 /stock/candle을 지원하지 않음(403).
 * 대신 Yahoo Finance 비공식 차트 API(키 불필요)로 OHLCV를 조회한다.
 * ═══════════════════════════════════════════════════════════════════════ */
const FH = 'https://finnhub.io/api/v1';

interface FHQuote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // percent change
  h: number;   // day high
  l: number;   // day low
  o: number;   // day open
  pc: number;  // previous close
  t: number;   // timestamp
}
interface FHProfile {
  name?: string;
  country?: string;
  currency?: string;
  exchange?: string;
  finnhubIndustry?: string;
  ipo?: string;
  logo?: string;
  marketCapitalization?: number; // millions
  shareOutstanding?: number;     // millions
  ticker?: string;
  weburl?: string;
}
interface FHMetric {
  metric: {
    peBasicExclExtraTTM?: number;
    pbAnnual?: number;
    roeTTM?: number;
    grossMarginTTM?: number;
    operatingMarginTTM?: number;
    netProfitMarginTTM?: number;
    currentRatioAnnual?: number;
    dividendYieldIndicatedAnnual?: number;
    '52WeekHigh'?: number;
    '52WeekLow'?: number;
    'totalDebt/totalEquityAnnual'?: number;
    'ev/ebitdaAnnual'?: number;
    beta?: number;
  };
}

/** Yahoo Finance 차트 API 응답 */
interface YFChartResponse {
  chart: {
    result?: Array<{
      meta: {
        currency?: string;
        symbol?: string;
        exchangeName?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        regularMarketVolume?: number;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open:   (number | null)[];
          high:   (number | null)[];
          low:    (number | null)[];
          close:  (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

/** Yahoo Finance quoteSummary API 응답 (키 불필요) */
interface YFQuoteSummaryResponse {
  quoteSummary: {
    result?: Array<{
      assetProfile?: {
        sector?: string;
        industry?: string;
        fullTimeEmployees?: number;
        longBusinessSummary?: string;
      };
      price?: {
        longName?: string;
        shortName?: string;
        marketCap?: { raw?: number };
        currency?: string;
        exchangeName?: string;
      };
      defaultKeyStatistics?: {
        trailingPE?:        { raw?: number };
        priceToBook?:       { raw?: number };
        enterpriseToEbitda?: { raw?: number };
        sharesOutstanding?: { raw?: number };
      };
      financialData?: {
        currentRatio?:    { raw?: number };
        debtToEquity?:    { raw?: number };  // % 단위 (150 = 1.5배)
        grossMargins?:    { raw?: number };  // 소수 (0.30 = 30%)
        operatingMargins?: { raw?: number };
        profitMargins?:   { raw?: number };
        returnOnEquity?:  { raw?: number };  // 소수
        freeCashflow?:    { raw?: number };  // 절대값 (원 단위)
      };
      summaryDetail?: {
        marketCap?:        { raw?: number };
        dividendYield?:    { raw?: number };  // 소수 (0.02 = 2%)
        fiftyTwoWeekHigh?: { raw?: number };
        fiftyTwoWeekLow?:  { raw?: number };
      };
    }>;
    error?: null | { code: string; description: string };
  };
}

async function fhFetch<T>(path: string, key: string, revalidate = 300): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${FH}${path}${sep}token=${key}`;
  const res = await fetch(url, { next: { revalidate } });
  if (res.status === 429) throw new Error('FH_RATE_LIMIT');
  if (!res.ok) throw new Error(`FH HTTP ${res.status}`);
  const d = await res.json() as T & { error?: string };
  if ('error' in d && d.error) throw new Error(`FH: ${d.error}`);
  return d;
}

/** Yahoo Finance: 최근 6개월 일봉 (키 불필요, 무료) */
async function fetchYFCandles(ticker: string): Promise<{
  date: string; open: number; high: number; low: number; close: number; volume: number;
}[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=6mo`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`YF HTTP ${res.status}`);
  const data: YFChartResponse = await res.json();
  const result = data.chart.result?.[0];
  if (!result) throw new Error('YF: 데이터 없음');

  const { timestamp, indicators } = result;
  const q = indicators.quote[0];

  return timestamp
    .map((ts, i) => {
      const d  = new Date(ts * 1000);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return {
        date:   `${mm}/${dd}`,
        open:   Math.round((q.open[i]   ?? 0) * 100) / 100,
        high:   Math.round((q.high[i]   ?? 0) * 100) / 100,
        low:    Math.round((q.low[i]    ?? 0) * 100) / 100,
        close:  Math.round((q.close[i]  ?? 0) * 100) / 100,
        volume: Math.round(q.volume[i]  ?? 0),
      };
    })
    .filter(b => b.close > 0);
}

function mapFinnhub(
  ticker: string,
  quote: FHQuote,
  yfBars: { date: string; open: number; high: number; low: number; close: number; volume: number }[],
  profile: FHProfile,
  metrics: FHMetric,
  fb: CompanyFundamentals | undefined,
  avErr: string,
  isAvFallback: boolean,
): StockData {
  if (!yfBars.length) throw new Error('YF: 차트 데이터 없음');

  const { rows: allRows, allCloses } = buildChartRows(yfBars);
  const lastIdx = allRows.length - 1;
  const m = metrics.metric;

  // Finnhub quote의 현재가 사용 (Yahoo 마지막 봉보다 최신)
  const currentPrice = quote.c > 0 ? quote.c : yfBars[yfBars.length - 1].close;
  const change       = Math.round(quote.d * 100) / 100;
  const changePct    = Math.round(quote.dp * 100) / 100;

  // 시가총액: profile.marketCapitalization은 million 단위
  const capMillions  = sf(profile.marketCapitalization);
  const sharesM      = sf(profile.shareOutstanding) > 0
    ? Math.round(sf(profile.shareOutstanding))
    : (fb?.shares ?? 1000);

  // D/E: Finnhub은 % 단위 → 소수로 변환
  const deToRaw = sf(m['totalDebt/totalEquityAnnual']);
  const deRatio  = deToRaw > 0 ? Math.round(deToRaw) / 100 : (fb?.debtToEquity ?? 0.5);

  // 52주 고저 (metrics 우선, quote fallback)
  const w52h = sf(m['52WeekHigh'], quote.h > 0 ? quote.h : (fb?.week52High ?? currentPrice * 1.2));
  const w52l = sf(m['52WeekLow'],  quote.l > 0 ? quote.l : (fb?.week52Low  ?? currentPrice * 0.8));

  return {
    ticker,
    name:        profile.name       || fb?.name        || ticker,
    sector:      fb?.sector         || profile.finnhubIndustry || 'N/A',
    industry:    profile.finnhubIndustry || fb?.industry || 'N/A',
    exchange:    profile.exchange   || fb?.exchange    || 'N/A',
    employees:   fb?.employees      ?? 'N/A',
    description: fb?.description    ?? '',
    currentPrice,
    change,
    changePercent: changePct,
    volume:    fmtVol(yfBars[yfBars.length - 1].volume),
    marketCap: capMillions > 0 ? fmtCap(capMillions * 1e6) : (fb?.marketCap ?? 'N/A'),
    week52High: w52h,
    week52Low:  w52l,
    fcf:     fb?.fcf    ?? 1000,
    shares:  sharesM,
    netDebt: fb?.netDebt ?? 0,
    defaultGrowthRate:     fb?.defaultGrowthRate    ?? 0.08,
    defaultWACC:           fb?.defaultWACC          ?? 0.09,
    defaultTerminalGrowth: fb?.defaultTerminalGrowth ?? 0.03,
    per:     sf(m.peBasicExclExtraTTM, fb?.per     ?? 20),
    pbr:     sf(m.pbAnnual,            fb?.pbr     ?? 3),
    roe:     sf(m.roeTTM,              fb?.roe     ?? 15),
    evEbitda: sf(m['ev/ebitdaAnnual'], fb?.evEbitda ?? 15),
    dividendYield: sf(m.dividendYieldIndicatedAnnual, fb?.dividendYield ?? 0),
    industryPer:      fb?.industryPer      ?? 22,
    industryPbr:      fb?.industryPbr      ?? 4,
    industryRoe:      fb?.industryRoe      ?? 20,
    industryEvEbitda: fb?.industryEvEbitda ?? 15,
    grossMargin:     sf(m.grossMarginTTM,     fb?.grossMargin     ?? 30),
    operatingMargin: sf(m.operatingMarginTTM, fb?.operatingMargin ?? 15),
    netMargin:       sf(m.netProfitMarginTTM, fb?.netMargin       ?? 10),
    debtToEquity:    deRatio,
    currentRatio:    sf(m.currentRatioAnnual, fb?.currentRatio ?? 1.5),
    chartRows:   allRows.slice(-90),
    allPrices:   allCloses,
    latestRSI:   calculateRSI(allCloses, 14)[lastIdx],
    latestSMA20: calculateSMA(allCloses, 20)[lastIdx],
    latestSMA60: calculateSMA(allCloses, 60)[lastIdx],
    source:    'live',
    provider:  'finnhub',
    fetchedAt: new Date().toISOString(),
    note:      isAvFallback
      ? `Alpha Vantage 사용량 초과 (${avErr}). Finnhub + Yahoo Finance 데이터로 자동 전환됨.`
      : undefined,
  };
}

/**
 * Finnhub(현재가·펀더멘털) + Yahoo Finance(OHLCV 차트) 병렬 호출
 */
async function fetchFromFinnhub(
  ticker: string,
  key: string,
  avErr: string,
  fb: CompanyFundamentals | undefined,
  isAvFallback: boolean,
): Promise<StockData> {
  const [quote, yfBars, profile, metrics] = await Promise.all([
    fhFetch<FHQuote>(`/quote?symbol=${encodeURIComponent(ticker)}`, key, 60),
    fetchYFCandles(ticker),
    fhFetch<FHProfile>(`/stock/profile2?symbol=${encodeURIComponent(ticker)}`, key, 3600),
    fhFetch<FHMetric>(`/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all`, key, 3600),
  ]);

  return mapFinnhub(ticker, quote, yfBars, profile, metrics, fb, avErr, isAvFallback);
}

/* ═══════════════════════════════════════════════════════════════════════
 * ③ Yahoo Finance 단독 경로 (Finnhub 불가 종목 — 한국 주식 등)
 *
 * chart API  → OHLCV 봉 + 현재가(meta)
 * quoteSummary API → 섹터·업종·직원 수·PER·PBR·ROE 등 펀더멘털
 * 두 API 모두 인증 키 불필요
 * ═══════════════════════════════════════════════════════════════════════ */
async function fetchFromYahooFinance(
  ticker: string,
  fb: CompanyFundamentals | undefined,
  prevErrMsg: string,
): Promise<StockData> {
  // 차트 + 펀더멘털 + 종목명 병렬 호출
  const [chartRes, summaryRes, quoteNameRes] = await Promise.allSettled([
    fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=6mo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } },
    ),
    fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
        `?modules=assetProfile,price,defaultKeyStatistics,financialData,summaryDetail`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } },
    ),
    // v1 search — quoteSummary가 종목명을 반환하지 않을 때(한국 주식 등) 보완용
    fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=1&newsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } },
    ),
  ]);

  /* ── 차트 파싱 (필수) ─────────────────────── */
  if (chartRes.status === 'rejected') throw new Error(`YF 차트 요청 실패: ${chartRes.reason}`);
  if (!chartRes.value.ok) throw new Error(`YF HTTP ${chartRes.value.status}`);
  const chartData: YFChartResponse = await chartRes.value.json();
  const chartResult = chartData.chart.result?.[0];
  if (!chartResult) {
    const e = chartData.chart.error;
    throw new Error(`YF: ${e?.description ?? '차트 데이터 없음'}`);
  }

  const { meta, timestamp, indicators } = chartResult;
  const q = indicators.quote[0];
  const bars = timestamp
    .map((ts, i) => {
      const d  = new Date(ts * 1000);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return {
        date:   `${mm}/${dd}`,
        open:   Math.round((q.open[i]   ?? 0) * 100) / 100,
        high:   Math.round((q.high[i]   ?? 0) * 100) / 100,
        low:    Math.round((q.low[i]    ?? 0) * 100) / 100,
        close:  Math.round((q.close[i]  ?? 0) * 100) / 100,
        volume: Math.round(q.volume[i]  ?? 0),
      };
    })
    .filter(b => b.close > 0);

  if (!bars.length) throw new Error('YF: 유효한 봉 데이터 없음');

  const { rows: allRows, allCloses } = buildChartRows(bars);
  const lastIdx = allRows.length - 1;
  const lastBar = bars[bars.length - 1];

  const currentPrice = (meta.regularMarketPrice ?? 0) > 0
    ? Math.round((meta.regularMarketPrice ?? 0) * 100) / 100
    : lastBar.close;
  const prevClose = (meta.chartPreviousClose ?? 0) > 0
    ? (meta.chartPreviousClose ?? 0)
    : (bars[bars.length - 2]?.close ?? lastBar.close);
  const change    = Math.round((currentPrice - prevClose) * 100) / 100;
  const changePct = Math.round((change / prevClose) * 10000) / 100;

  // 52주 고저: 봉 데이터에서 계산
  const computedHigh = Math.max(...bars.map(b => b.high));
  const computedLow  = Math.min(...bars.map(b => b.low));

  /* ── quoteSummary 파싱 (선택) ─────────────── */
  // raw 값 추출 헬퍼
  const raw = (obj: { raw?: number } | undefined | null, fallback: number): number =>
    (obj?.raw !== undefined && obj.raw !== null) ? obj.raw : fallback;

  type QSResult = NonNullable<YFQuoteSummaryResponse['quoteSummary']['result']>[number];
  let qs: QSResult = {};
  try {
    if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
      const summaryData: YFQuoteSummaryResponse = await summaryRes.value.json();
      qs = summaryData.quoteSummary?.result?.[0] ?? {};
    }
  } catch { /* quoteSummary는 선택적 — 실패해도 계속 진행 */ }

  const ap = qs.assetProfile;
  const pr = qs.price;
  const ks = qs.defaultKeyStatistics;
  const fd = qs.financialData;
  const sd = qs.summaryDetail;

  // v1 search에서 종목명 추출 (quoteSummary가 한국 주식명을 못 반환할 때 보완)
  let searchName: string | undefined;
  try {
    if (quoteNameRes.status === 'fulfilled' && quoteNameRes.value.ok) {
      const sd2 = await quoteNameRes.value.json() as YFSearchResponse;
      const hit = sd2.quotes?.[0];
      searchName = hit?.longname || hit?.longName || hit?.shortname || hit?.shortName;
    }
  } catch { /* 종목명 폴백 실패 — 무시 */ }

  const name        = searchName || pr?.longName || pr?.shortName || fb?.name || ticker;
  const sector      = ap?.sector   || fb?.sector    || 'N/A';
  const industry    = ap?.industry || fb?.industry  || 'N/A';
  const exchange    = pr?.exchangeName || meta.exchangeName || fb?.exchange || 'N/A';
  const employees   = ap?.fullTimeEmployees
    ? ap.fullTimeEmployees.toLocaleString()
    : (fb?.employees ?? 'N/A');
  const description = ap?.longBusinessSummary || fb?.description || '';

  const marketCapRaw = raw(sd?.marketCap ?? pr?.marketCap, 0);
  const sharesRaw    = raw(ks?.sharesOutstanding, 0);
  const sharesM      = sharesRaw > 0 ? Math.round(sharesRaw / 1e6) : (fb?.shares ?? 1000);

  const w52h = raw(sd?.fiftyTwoWeekHigh, computedHigh);
  const w52l = raw(sd?.fiftyTwoWeekLow,  computedLow);

  // 퍼센트 단위 변환이 필요한 항목들 (YF는 소수, 내부 표현은 %)
  const roeDec  = raw(fd?.returnOnEquity,  -1);
  const gmDec   = raw(fd?.grossMargins,    -1);
  const omDec   = raw(fd?.operatingMargins,-1);
  const nmDec   = raw(fd?.profitMargins,   -1);
  const divDec  = raw(sd?.dividendYield,   -1);
  // debtToEquity: YF는 % 단위 (150 = D/E 1.5)
  const deRaw   = raw(fd?.debtToEquity, 0);
  const deRatio = deRaw > 0 ? deRaw / 100 : (fb?.debtToEquity ?? 0.5);

  const fcfRaw = raw(fd?.freeCashflow, 0);

  return {
    ticker,
    name,
    sector,
    industry,
    exchange,
    employees,
    description,
    currentPrice,
    change,
    changePercent: changePct,
    volume:    fmtVol(lastBar.volume),
    marketCap: marketCapRaw > 0 ? fmtCap(marketCapRaw) : (fb?.marketCap ?? 'N/A'),
    week52High: w52h,
    week52Low:  w52l,
    fcf:     fcfRaw > 0 ? Math.round(fcfRaw / 1e6) : (fb?.fcf ?? 1000),
    shares:  sharesM,
    netDebt: fb?.netDebt ?? 0,
    defaultGrowthRate:     fb?.defaultGrowthRate     ?? 0.08,
    defaultWACC:           fb?.defaultWACC           ?? 0.09,
    defaultTerminalGrowth: fb?.defaultTerminalGrowth ?? 0.03,
    per:     raw(ks?.trailingPE,        fb?.per     ?? 20),
    pbr:     raw(ks?.priceToBook,       fb?.pbr     ?? 3),
    roe:     roeDec  > 0 ? Math.round(roeDec  * 1000) / 10 : (fb?.roe     ?? 15),
    evEbitda: raw(ks?.enterpriseToEbitda, fb?.evEbitda ?? 15),
    dividendYield: divDec  > 0 ? Math.round(divDec  * 10000) / 100 : (fb?.dividendYield ?? 0),
    industryPer:      fb?.industryPer      ?? 22,
    industryPbr:      fb?.industryPbr      ?? 4,
    industryRoe:      fb?.industryRoe      ?? 20,
    industryEvEbitda: fb?.industryEvEbitda ?? 15,
    grossMargin:     gmDec  > 0 ? Math.round(gmDec  * 1000) / 10 : (fb?.grossMargin     ?? 30),
    operatingMargin: omDec  > 0 ? Math.round(omDec  * 1000) / 10 : (fb?.operatingMargin ?? 15),
    netMargin:       nmDec  > 0 ? Math.round(nmDec  * 1000) / 10 : (fb?.netMargin       ?? 10),
    debtToEquity:    deRatio,
    currentRatio:    raw(fd?.currentRatio, fb?.currentRatio ?? 1.5),
    chartRows:   allRows.slice(-90),
    allPrices:   allCloses,
    latestRSI:   calculateRSI(allCloses, 14)[lastIdx],
    latestSMA20: calculateSMA(allCloses, 20)[lastIdx],
    latestSMA60: calculateSMA(allCloses, 60)[lastIdx],
    source:    'live',
    provider:  'yahoo',
    fetchedAt: new Date().toISOString(),
    note: prevErrMsg ? `${prevErrMsg}. Yahoo Finance 데이터로 자동 전환됨.` : undefined,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * 심볼 자동 변환 — 한국 종목명 룩업 + Yahoo Finance Search
 * "삼성전자" / "005930" / "Tesla" / "AAPL" → 표준 YF 티커
 * ═══════════════════════════════════════════════════════════════════════ */

/** 한국 종목 이름/약칭 → Yahoo Finance 표준 심볼 */
const KR_TICKER_MAP: Record<string, string> = {
  '삼성전자': '005930.KS', 'samsung': '005930.KS', '삼성': '005930.KS',
  'sk하이닉스': '000660.KS', 'SK하이닉스': '000660.KS', '하이닉스': '000660.KS',
  '카카오': '035720.KQ', 'kakao': '035720.KQ',
  '네이버': '035420.KS', 'naver': '035420.KS',
  '현대자동차': '005380.KS', '현대차': '005380.KS', 'hyundai': '005380.KS',
  '기아': '000270.KS', '기아자동차': '000270.KS', 'kia': '000270.KS',
  'lg전자': '066570.KS', 'LG전자': '066570.KS',
  'lg화학': '051910.KS', 'LG화학': '051910.KS',
  '삼성sdi': '006400.KS', '삼성SDI': '006400.KS',
  '셀트리온': '068270.KQ', 'celltrion': '068270.KQ',
  '현대모비스': '012330.KS', 'mobis': '012330.KS',
  'kb금융': '105560.KS', 'KB금융': '105560.KS',
  '신한지주': '055550.KS', '신한': '055550.KS',
  '포스코': '005490.KS', 'posco': '005490.KS',
  'posco홀딩스': '005490.KS', 'POSCO홀딩스': '005490.KS',
  '카카오뱅크': '323410.KQ', '카카오페이': '377300.KQ',
  '한국전력': '015760.KS', 'kepco': '015760.KS',
  '하나금융': '086790.KS', '우리금융': '316140.KS',
  '크래프톤': '259960.KQ', 'krafton': '259960.KQ',
  '삼성바이오로직스': '207940.KS', '카카오게임즈': '293490.KQ',
  '한화에어로스페이스': '012450.KS', '두산에너빌리티': '034020.KS',
};

interface YFSearchQuote {
  symbol:     string;
  quoteType?: string;
  shortname?: string;
  longname?:  string;
  shortName?: string;  // 일부 응답에서 camelCase
  longName?:  string;
}
interface YFSearchResponse {
  quotes?: YFSearchQuote[];
}

async function yfSearch(q: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=5&newsCount=0`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data: YFSearchResponse = await res.json();
    const equity = data.quotes?.find(q => q.quoteType === 'EQUITY');
    return equity?.symbol ?? data.quotes?.[0]?.symbol ?? null;
  } catch {
    return null;
  }
}

async function resolveSymbol(query: string): Promise<string> {
  const q = query.trim();

  // ① 한국어 이름 룩업 (대소문자 무시)
  const krMatch = KR_TICKER_MAP[q] ?? KR_TICKER_MAP[q.toLowerCase()];
  if (krMatch) return krMatch;

  // ② 6자리 숫자 코드 → YF Search로 .KS / .KQ 자동 판별
  if (/^\d{5,6}$/.test(q)) {
    const hit = await yfSearch(q);
    if (hit) return hit;
    return `${q.padStart(6, '0')}.KS`; // 폴백
  }

  // ③ 영문 회사명·티커 → YF Search
  const found = await yfSearch(q);
  if (found) return found;

  // ④ ASCII 정리 후 그대로 사용 (직접 입력한 표준 티커)
  return q.toUpperCase().replace(/[^A-Z0-9.-]/g, '') || 'AAPL';
}

/* ═══════════════════════════════════════════════════════════════════════
 * Route Handler
 *
 * 우선순위: Alpha Vantage → Finnhub → Yahoo Finance → 503
 * Yahoo Finance는 키 없이도 동작하므로 최종 안전망 역할
 * ═══════════════════════════════════════════════════════════════════════ */
export async function GET(request: NextRequest): Promise<Response> {
  const rawQuery = (request.nextUrl.searchParams.get('ticker') ?? 'AAPL').trim();

  if (!rawQuery) {
    return Response.json(
      { error: '티커가 비어 있습니다.', ticker: '', fetchedAt: new Date().toISOString() },
      { status: 400 },
    );
  }

  // Yahoo Finance Search로 표준 심볼 변환 (삼성전자 → 005930.KS 등)
  const ticker = await resolveSymbol(rawQuery);

  const avKey = process.env.STOCK_API_KEY;
  const fhKey = process.env.FINNHUB_API_KEY;
  const fb    = COMPANY_DB[ticker];

  const errors: string[] = [];

  /* ── 1순위: Alpha Vantage ───────────────── */
  if (avKey && avKey !== 'your_api_key_here') {
    try {
      const [ts, ov] = await Promise.all([avTimeSeries(ticker, avKey), avOverview(ticker, avKey)]);
      return Response.json(
        mapAV(ticker, ts, ov, fb),
        { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
      );
    } catch (avErr) {
      errors.push(`Alpha Vantage 실패(${avErr instanceof Error ? avErr.message : avErr})`);
    }
  }

  /* ── 2순위: Finnhub ─────────────────────── */
  if (fhKey && fhKey !== 'your_finnhub_key_here') {
    try {
      const data = await fetchFromFinnhub(ticker, fhKey, errors[0] ?? '', fb, errors.length > 0);
      return Response.json(data, {
        headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
      });
    } catch (fhErr) {
      errors.push(`Finnhub 실패(${fhErr instanceof Error ? fhErr.message : fhErr})`);
    }
  }

  /* ── 3순위: Yahoo Finance (키 불필요) ───── */
  try {
    const data = await fetchFromYahooFinance(ticker, fb, errors.join(', '));
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    });
  } catch (yfErr) {
    errors.push(`Yahoo Finance 실패(${yfErr instanceof Error ? yfErr.message : yfErr})`);
  }

  /* ── 모든 경로 실패 → 503 ─────────────── */
  return Response.json(
    {
      error: `데이터를 가져올 수 없습니다. (${errors.join(' / ')}) 잠시 후 다시 시도해 주세요.`,
      ticker,
      fetchedAt: new Date().toISOString(),
    },
    { status: 503 },
  );
}
