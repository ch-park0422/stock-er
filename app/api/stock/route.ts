/**
 * app/api/stock/route.ts
 * GET /api/stock?ticker=AAPL
 *
 * 1순위: Alpha Vantage 실시간 데이터 (STOCK_API_KEY 설정 시)
 * 2순위: Seed 기반 Mock 데이터 폴백 (키 미설정 · Rate Limit · 네트워크 오류)
 *
 * 반환 타입: StockData (lib/types.ts)
 *
 * 캐시 전략 (Next.js 16 Data Cache):
 *   TIME_SERIES_DAILY → revalidate: 300s  (시세 5분 캐시)
 *   OVERVIEW          → revalidate: 3600s (재무 1시간 캐시)
 */

import type { NextRequest } from 'next/server';
import {
  COMPANY_DB,
  GenerateMockData,
  START_PRICES,
  type CompanyFundamentals,
  type ChartRow,
} from '@/lib/mockData';
import {
  calculateSMA,
  calculateRSI,
  calculateMACD,
} from '@/lib/analysis';
import type { StockData } from '@/lib/types';

/* ─────────────────────────────────────────────
 * Alpha Vantage 응답 원시 타입
 * ───────────────────────────────────────────── */
interface AVTimeSeries {
  'Meta Data'?: Record<string, string>;
  'Time Series (Daily)'?: Record<string, {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  }>;
  Note?: string;
  Information?: string;
  'Error Message'?: string;
}

interface AVOverview {
  Symbol?: string;
  Name?: string;
  Description?: string;
  Exchange?: string;
  Sector?: string;
  Industry?: string;
  FullTimeEmployees?: string;
  MarketCapitalization?: string;
  EBITDA?: string;
  PERatio?: string;
  PriceToBookRatio?: string;
  ReturnOnEquityTTM?: string;
  EVToEBITDA?: string;
  DividendYield?: string;
  OperatingMarginTTM?: string;
  ProfitMargin?: string;
  GrossProfitTTM?: string;
  RevenueTTM?: string;
  SharesOutstanding?: string;
  '52WeekHigh'?: string;
  '52WeekLow'?: string;
  QuarterlyRevenueGrowthYOY?: string;
  Note?: string;
  Information?: string;
  'Error Message'?: string;
}

/* ─────────────────────────────────────────────
 * 수치 파싱 헬퍼
 * ───────────────────────────────────────────── */
function sf(v: string | undefined, fallback = 0): number {
  const n = parseFloat(v ?? '');
  return isNaN(n) ? fallback : n;
}
function si(v: string | undefined, fallback = 0): number {
  const n = parseInt(v ?? '', 10);
  return isNaN(n) ? fallback : n;
}

/* ─────────────────────────────────────────────
 * 숫자 포맷 헬퍼
 * ───────────────────────────────────────────── */
function fmtVolume(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n}`;
}

function fmtMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n}`;
}

function fmtEmployees(raw: string | undefined): string {
  const n = si(raw);
  if (!n) return 'N/A';
  return n.toLocaleString();
}

/* ─────────────────────────────────────────────
 * Alpha Vantage Fetcher
 * ───────────────────────────────────────────── */
const AV = 'https://www.alphavantage.co/query';

async function fetchTimeSeries(ticker: string, apiKey: string): Promise<AVTimeSeries> {
  const url = `${AV}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(ticker)}&outputsize=compact&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const data: AVTimeSeries = await res.json();
  if (data.Note)            throw new Error('AV rate limit (Note)');
  if (data.Information)     throw new Error('AV rate limit (Information)');
  if (data['Error Message']) throw new Error(data['Error Message']);
  return data;
}

async function fetchOverview(ticker: string, apiKey: string): Promise<AVOverview> {
  const url = `${AV}?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const data: AVOverview = await res.json();
  if (data.Note)            throw new Error('AV rate limit (Note)');
  if (data.Information)     throw new Error('AV rate limit (Information)');
  if (data['Error Message']) throw new Error(data['Error Message']);
  return data;
}

/* ─────────────────────────────────────────────
 * Alpha Vantage 응답 → StockData 매핑
 * ───────────────────────────────────────────── */
function mapLiveData(
  ticker: string,
  ts: AVTimeSeries,
  ov: AVOverview,
  fb: CompanyFundamentals | undefined,
): StockData {
  /* ── 가격 시계열 파싱 ──────────────────────── */
  const rawSeries = ts['Time Series (Daily)'];
  if (!rawSeries) throw new Error('Time Series 데이터 없음');

  // 날짜 오름차순 정렬 후 최근 100 거래일
  const bars = Object.entries(rawSeries)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-100)
    .map(([date, d]) => {
      const [, mm, dd] = date.split('-');
      return {
        date:   `${mm}/${dd}`,
        open:   Math.round(sf(d['1. open'])  * 100) / 100,
        high:   Math.round(sf(d['2. high'])  * 100) / 100,
        low:    Math.round(sf(d['3. low'])   * 100) / 100,
        close:  Math.round(sf(d['4. close']) * 100) / 100,
        volume: si(d['5. volume']),
      };
    });

  const closes    = bars.map(b => b.close);
  const latestBar = bars[bars.length - 1];
  const prevBar   = bars[bars.length - 2] ?? latestBar;

  const currentPrice  = latestBar.close;
  const change        = Math.round((currentPrice - prevBar.close) * 100) / 100;
  const changePercent = Math.round((change / prevBar.close) * 10000) / 100;

  /* ── 기술지표 계산 (서버 사이드) ─────────── */
  const sma20 = calculateSMA(closes, 20);
  const sma60 = calculateSMA(closes, 60);
  const rsi14 = calculateRSI(closes, 14);
  const macd  = calculateMACD(closes, 12, 26, 9);

  const allRows: ChartRow[] = bars.map((bar, i) => ({
    ...bar,
    sma20:      sma20[i],
    sma60:      sma60[i],
    rsi:        rsi14[i],
    macdLine:   macd[i].macdLine,
    signalLine: macd[i].signalLine,
    histogram:  macd[i].histogram,
  }));

  const lastIdx = allRows.length - 1;

  /* ── 기업 개요 파싱 ────────────────────────── */
  const sharesRaw    = si(ov.SharesOutstanding);
  const sharesMillions = sharesRaw > 0 ? Math.round(sharesRaw / 1e6) : (fb?.shares ?? 1000);
  const marketCapRaw = si(ov.MarketCapitalization);

  // gross margin: GrossProfitTTM / RevenueTTM
  const grossProfit = sf(ov.GrossProfitTTM);
  const revenue     = sf(ov.RevenueTTM);
  const grossMarginCalc = grossProfit > 0 && revenue > 0
    ? Math.round((grossProfit / revenue) * 1000) / 10
    : (fb?.grossMargin ?? 30);

  // FCF 추정: EBITDA × 0.6 (CASH_FLOW 엔드포인트 없이 근사치)
  //   COMPANY_DB에 있으면 더 정확한 값 사용
  const fcfCalc = fb?.fcf ?? Math.round(sf(ov.EBITDA) / 1e6 * 0.6);

  // 성장률: QuarterlyRevenueGrowthYOY 또는 COMPANY_DB 기본값
  const growthCalc = fb?.defaultGrowthRate
    ?? Math.min(Math.max(sf(ov.QuarterlyRevenueGrowthYOY, 0.08), 0.02), 0.40);

  return {
    /* ── 기업 정보 ── */
    ticker,
    name:        ov.Name        || fb?.name        || ticker,
    sector:      ov.Sector      || fb?.sector      || 'N/A',
    industry:    ov.Industry    || fb?.industry    || 'N/A',
    exchange:    ov.Exchange    || fb?.exchange    || 'N/A',
    employees:   fmtEmployees(ov.FullTimeEmployees) !== 'N/A'
                   ? fmtEmployees(ov.FullTimeEmployees)
                   : (fb?.employees ?? 'N/A'),
    description: ov.Description || fb?.description || '',

    /* ── 가격 스냅샷 ── */
    currentPrice,
    change,
    changePercent,
    volume:    fmtVolume(latestBar.volume),
    marketCap: marketCapRaw > 0 ? fmtMarketCap(marketCapRaw) : (fb?.marketCap ?? 'N/A'),
    week52High: sf(ov['52WeekHigh'],  fb?.week52High  ?? currentPrice * 1.2),
    week52Low:  sf(ov['52WeekLow'],   fb?.week52Low   ?? currentPrice * 0.8),

    /* ── DCF 입력값 ── */
    fcf:     fcfCalc,
    shares:  sharesMillions,
    netDebt: fb?.netDebt ?? 0,
    defaultGrowthRate:     growthCalc,
    defaultWACC:           fb?.defaultWACC           ?? 0.09,
    defaultTerminalGrowth: fb?.defaultTerminalGrowth ?? 0.03,

    /* ── 밸류에이션 지표 ── */
    per:     sf(ov.PERatio,          fb?.per     ?? 20),
    pbr:     sf(ov.PriceToBookRatio, fb?.pbr     ?? 3),
    // ReturnOnEquityTTM은 소수 (0.147 = 14.7%)
    roe: (() => {
      const raw = sf(ov.ReturnOnEquityTTM) * 100;
      return raw > 0 ? Math.round(raw * 10) / 10 : (fb?.roe ?? 15);
    })(),
    evEbitda:     sf(ov.EVToEBITDA,          fb?.evEbitda     ?? 15),
    dividendYield: sf(ov.DividendYield) > 0
      ? Math.round(sf(ov.DividendYield) * 10000) / 100 // 소수 → %
      : (fb?.dividendYield ?? 0),

    /* ── 업종 평균 (정적 기준값 사용) ── */
    industryPer:      fb?.industryPer      ?? 22,
    industryPbr:      fb?.industryPbr      ?? 4,
    industryRoe:      fb?.industryRoe      ?? 20,
    industryEvEbitda: fb?.industryEvEbitda ?? 15,

    /* ── 수익성 지표 ── */
    grossMargin:     grossMarginCalc,
    operatingMargin: sf(ov.OperatingMarginTTM) > 0
      ? Math.round(sf(ov.OperatingMarginTTM) * 1000) / 10
      : (fb?.operatingMargin ?? 15),
    netMargin: sf(ov.ProfitMargin) > 0
      ? Math.round(sf(ov.ProfitMargin) * 1000) / 10
      : (fb?.netMargin ?? 10),
    debtToEquity: fb?.debtToEquity ?? 0.5,
    currentRatio: fb?.currentRatio ?? 1.5,

    /* ── 차트 (최근 90일 표시 + 전체 기술지표) ── */
    chartRows:   allRows.slice(-90),
    allPrices:   closes,
    latestRSI:   rsi14[lastIdx],
    latestSMA20: sma20[lastIdx],
    latestSMA60: sma60[lastIdx],

    /* ── 메타데이터 ── */
    source:    'live',
    fetchedAt: new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────
 * Mock 폴백 빌더
 * ───────────────────────────────────────────── */
function buildMockData(ticker: string, noteMsg?: string): StockData {
  const fb         = COMPANY_DB[ticker];
  const startPrice = START_PRICES[ticker] ?? 100;
  const mock       = GenerateMockData(ticker, startPrice);

  /* COMPANY_DB에 없는 티커 → 기본값으로 채움 */
  if (!fb) {
    const closes = mock.allPrices;
    const base: CompanyFundamentals = {
      ticker,
      name:        ticker,
      sector:      'N/A',
      industry:    'N/A',
      exchange:    'N/A',
      employees:   'N/A',
      description: `"${ticker}" 티커에 대한 Mock 데이터입니다. 실제 데이터 없음.`,
      currentPrice: closes.at(-1) ?? 100,
      change:       0,
      changePercent: 0,
      volume:       'N/A',
      marketCap:    'N/A',
      week52High:   Math.max(...closes),
      week52Low:    Math.min(...closes),
      fcf: 1_000, shares: 100, netDebt: 0,
      defaultGrowthRate: 0.08, defaultWACC: 0.09, defaultTerminalGrowth: 0.03,
      per: 20, industryPer: 20, pbr: 3, industryPbr: 3,
      roe: 15, industryRoe: 15, evEbitda: 15, industryEvEbitda: 15,
      dividendYield: 0, debtToEquity: 0.5, currentRatio: 1.5,
      grossMargin: 30, operatingMargin: 15, netMargin: 10,
    };
    return {
      ...base,
      ...mock,
      source:    'mock',
      fetchedAt: new Date().toISOString(),
      note:      noteMsg ?? `"${ticker}" 티커를 데이터베이스에서 찾을 수 없어 Mock 데이터로 표시합니다.`,
    };
  }

  return {
    ...fb,
    ...mock,
    source:    'mock',
    fetchedAt: new Date().toISOString(),
    note:      noteMsg,
  };
}

/* ─────────────────────────────────────────────
 * Route Handler
 * ───────────────────────────────────────────── */
export async function GET(request: NextRequest): Promise<Response> {
  const ticker = (request.nextUrl.searchParams.get('ticker') ?? 'AAPL')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9.-]/g, ''); // 알파벳·숫자·점·하이픈만 허용

  if (!ticker) {
    return Response.json(
      { error: '티커가 비어 있습니다.', ticker: '', fetchedAt: new Date().toISOString() },
      { status: 400 },
    );
  }

  const apiKey = process.env.STOCK_API_KEY;

  /* ── API 키 없음 → 즉시 Mock ────────────── */
  if (!apiKey || apiKey === 'your_api_key_here') {
    const data = buildMockData(
      ticker,
      'STOCK_API_KEY가 설정되지 않았습니다. Mock 데이터를 표시합니다. .env.local 파일을 확인해 주세요.',
    );
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  }

  /* ── 실시간 데이터 시도 ─────────────────── */
  try {
    const [tsData, ovData] = await Promise.all([
      fetchTimeSeries(ticker, apiKey),
      fetchOverview(ticker, apiKey),
    ]);

    const stockData = mapLiveData(ticker, tsData, ovData, COMPANY_DB[ticker]);
    return Response.json(stockData, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    /* ── 오류 → Mock 폴백 ───────────────────── */
    const reason = err instanceof Error ? err.message : String(err);
    const fallback = buildMockData(
      ticker,
      `실시간 데이터 조회 실패 (${reason}). Mock 데이터로 폴백합니다.`,
    );
    return Response.json(fallback, {
      status:  200, // 클라이언트는 항상 200으로 받음 (note 필드로 이유 확인)
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
    });
  }
}
