/**
 * app/api/stock/route.ts
 * GET /api/stock?ticker=AAPL
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  우선순위 체인                                                       │
 * │  1. Alpha Vantage  (STOCK_API_KEY)  — 일 25회, 분당 5회            │
 * │     └→ Rate Limit / 오류 발생 시                                    │
 * │  2. Finnhub        (FINNHUB_API_KEY) — 분당 60회, 실질적 무제한     │
 * │     └→ 실패 시                                                       │
 * │  3. Seed 기반 Mock 데이터 폴백                                        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * 반환 타입: StockData (lib/types.ts)
 */

import type { NextRequest } from 'next/server';
import {
  COMPANY_DB,
  GenerateMockData,
  START_PRICES,
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
 * ② FINNHUB  (Alpha Vantage 사용량 초과 / 오류 시 자동 전환)
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
interface FHCandle {
  c?: number[]; h?: number[]; l?: number[]; o?: number[];
  t?: number[]; v?: number[];
  s: string;   // 'ok' | 'no_data'
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

function mapFinnhub(
  ticker: string,
  quote: FHQuote,
  candle: FHCandle,
  profile: FHProfile,
  metrics: FHMetric,
  fb: CompanyFundamentals | undefined,
  avErr: string,
): StockData {
  if (candle.s !== 'ok' || !candle.c?.length) {
    throw new Error('FH: candle data 없음');
  }

  const len  = candle.c.length;
  const bars = Array.from({ length: len }, (_, i) => {
    const d = new Date((candle.t![i]) * 1000);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return {
      date:   `${mm}/${dd}`,
      open:   Math.round((candle.o![i]) * 100) / 100,
      high:   Math.round((candle.h![i]) * 100) / 100,
      low:    Math.round((candle.l![i]) * 100) / 100,
      close:  Math.round((candle.c![i]) * 100) / 100,
      volume: Math.round(candle.v![i] ?? 0),
    };
  });

  const { rows: allRows, allCloses } = buildChartRows(bars);
  const lastIdx = allRows.length - 1;
  const m = metrics.metric;

  // Finnhub quote의 현재가 사용 (캔들 마지막 값보다 최신)
  const currentPrice = quote.c > 0 ? quote.c : bars[bars.length - 1].close;
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
    volume:    fmtVol(bars[bars.length - 1].volume),
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
    note:      `Alpha Vantage 사용량 초과 (${avErr}). Finnhub 실시간 데이터로 자동 전환됨.`,
  };
}

/* Finnhub 4개 엔드포인트 병렬 호출 */
async function fetchFromFinnhub(ticker: string, key: string, avErr: string, fb: CompanyFundamentals | undefined): Promise<StockData> {
  // 캔들: 최근 ~150 캘린더일 (≈100 거래일)
  const to   = Math.floor(Date.now() / 1000);
  const from = to - 150 * 24 * 60 * 60;

  const [quote, candle, profile, metrics] = await Promise.all([
    fhFetch<FHQuote>(`/quote?symbol=${encodeURIComponent(ticker)}`, key, 60),
    fhFetch<FHCandle>(`/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=D&from=${from}&to=${to}`, key, 300),
    fhFetch<FHProfile>(`/stock/profile2?symbol=${encodeURIComponent(ticker)}`, key, 3600),
    fhFetch<FHMetric>(`/stock/metric?symbol=${encodeURIComponent(ticker)}&metric=all`, key, 3600),
  ]);

  return mapFinnhub(ticker, quote, candle, profile, metrics, fb, avErr);
}

/* ═══════════════════════════════════════════════════════════════════════
 * ③ Mock 폴백
 * ═══════════════════════════════════════════════════════════════════════ */
function buildMockData(ticker: string, note?: string): StockData {
  const fb   = COMPANY_DB[ticker];
  const mock = GenerateMockData(ticker, START_PRICES[ticker] ?? 100);

  if (!fb) {
    const closes = mock.allPrices;
    const base: CompanyFundamentals = {
      ticker, name: ticker, sector: 'N/A', industry: 'N/A', exchange: 'N/A',
      employees: 'N/A', description: `"${ticker}" Mock 데이터.`,
      currentPrice: closes.at(-1) ?? 100, change: 0, changePercent: 0,
      volume: 'N/A', marketCap: 'N/A',
      week52High: Math.max(...closes), week52Low: Math.min(...closes),
      fcf: 1_000, shares: 100, netDebt: 0,
      defaultGrowthRate: 0.08, defaultWACC: 0.09, defaultTerminalGrowth: 0.03,
      per: 20, industryPer: 20, pbr: 3, industryPbr: 3,
      roe: 15, industryRoe: 15, evEbitda: 15, industryEvEbitda: 15,
      dividendYield: 0, debtToEquity: 0.5, currentRatio: 1.5,
      grossMargin: 30, operatingMargin: 15, netMargin: 10,
    };
    return { ...base, ...mock, source: 'mock', provider: 'mock', fetchedAt: new Date().toISOString(), note };
  }
  return { ...fb, ...mock, source: 'mock', provider: 'mock', fetchedAt: new Date().toISOString(), note };
}

/* ═══════════════════════════════════════════════════════════════════════
 * Route Handler
 * ═══════════════════════════════════════════════════════════════════════ */
export async function GET(request: NextRequest): Promise<Response> {
  const ticker = (request.nextUrl.searchParams.get('ticker') ?? 'AAPL')
    .toUpperCase().trim().replace(/[^A-Z0-9.-]/g, '');

  if (!ticker) {
    return Response.json(
      { error: '티커가 비어 있습니다.', ticker: '', fetchedAt: new Date().toISOString() },
      { status: 400 },
    );
  }

  const avKey = process.env.STOCK_API_KEY;
  const fhKey = process.env.FINNHUB_API_KEY;

  /* ── 키 없음 → Mock ──────────────────────── */
  if ((!avKey || avKey === 'your_api_key_here') && (!fhKey || fhKey === 'your_finnhub_key_here')) {
    return Response.json(
      buildMockData(ticker, 'API 키가 설정되지 않았습니다. Mock 데이터를 표시합니다.'),
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  }

  const fb = COMPANY_DB[ticker];

  /* ── 1순위: Alpha Vantage ───────────────── */
  if (avKey && avKey !== 'your_api_key_here') {
    try {
      const [ts, ov] = await Promise.all([avTimeSeries(ticker, avKey), avOverview(ticker, avKey)]);
      return Response.json(
        mapAV(ticker, ts, ov, fb),
        { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
      );
    } catch (avErr) {
      const avMsg = avErr instanceof Error ? avErr.message : String(avErr);
      const isRateLimit = avMsg.includes('AV_RATE_LIMIT') || avMsg.includes('rate limit');

      /* ── 2순위: Finnhub (AV 한도 초과 or 오류) ── */
      if (fhKey && fhKey !== 'your_finnhub_key_here') {
        try {
          const data = await fetchFromFinnhub(ticker, fhKey, avMsg, fb);
          return Response.json(data, {
            headers: { 'Cache-Control': `public, max-age=${isRateLimit ? 60 : 30}, stale-while-revalidate=120` },
          });
        } catch (fhErr) {
          const fhMsg = fhErr instanceof Error ? fhErr.message : String(fhErr);
          /* ── 3순위: Mock ─────────────────────── */
          return Response.json(
            buildMockData(ticker, `AV 실패(${avMsg}), Finnhub 실패(${fhMsg}). Mock 폴백.`),
            { headers: { 'Cache-Control': 'public, max-age=30' } },
          );
        }
      }

      /* AV 실패 + Finnhub 키 없음 → Mock */
      return Response.json(
        buildMockData(ticker, `Alpha Vantage 실패(${avMsg}). FINNHUB_API_KEY를 설정하면 자동 전환됩니다.`),
        { headers: { 'Cache-Control': 'public, max-age=30' } },
      );
    }
  }

  /* ── AV 키 없고 Finnhub 키만 있는 경우 ─── */
  if (fhKey && fhKey !== 'your_finnhub_key_here') {
    try {
      const data = await fetchFromFinnhub(ticker, fhKey, 'AV 키 없음', fb);
      // note 제거 (AV 오류가 아니므로)
      return Response.json(
        { ...data, note: undefined, provider: 'finnhub' as const },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } },
      );
    } catch (fhErr) {
      const fhMsg = fhErr instanceof Error ? fhErr.message : String(fhErr);
      return Response.json(
        buildMockData(ticker, `Finnhub 실패(${fhMsg}). Mock 폴백.`),
        { headers: { 'Cache-Control': 'public, max-age=30' } },
      );
    }
  }

  return Response.json(buildMockData(ticker));
}
