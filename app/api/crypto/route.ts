/**
 * app/api/crypto/route.ts
 * GET /api/crypto?ticker=BTC-USD
 *
 * Yahoo Finance 공개 API(키 불필요)를 통해 크립토 차트 데이터와
 * 온체인 지표 근사치(NVT / MVRV Z-Score / Puell Multiple)를 반환합니다.
 *
 * ※ NVT·MVRV·Puell 은 실제 온체인 데이터가 아닌 야후 파이낸스
 *    거래량 데이터를 활용한 시뮬레이션 근사치입니다.
 */

import type { NextRequest } from 'next/server';
import type { CryptoData, CryptoChartRow, CryptoMetric } from '@/lib/types';

/* ─────────────────────────────────────────────
 * 포맷 헬퍼
 * ───────────────────────────────────────────── */
function fmtVol(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  return         `$${(n / 1e6).toFixed(0)}M`;
}

/* ─────────────────────────────────────────────
 * 티커 자동 해석
 * ───────────────────────────────────────────── */
const CRYPTO_MAP: Record<string, string> = {
  bitcoin: 'BTC-USD', btc: 'BTC-USD',
  ethereum: 'ETH-USD', eth: 'ETH-USD',
  solana: 'SOL-USD', sol: 'SOL-USD',
  binance: 'BNB-USD', bnb: 'BNB-USD',
  ripple: 'XRP-USD', xrp: 'XRP-USD',
  cardano: 'ADA-USD', ada: 'ADA-USD',
  dogecoin: 'DOGE-USD', doge: 'DOGE-USD',
  avalanche: 'AVAX-USD', avax: 'AVAX-USD',
  polkadot: 'DOT-USD', dot: 'DOT-USD',
  chainlink: 'LINK-USD', link: 'LINK-USD',
  litecoin: 'LTC-USD', ltc: 'LTC-USD',
  uniswap: 'UNI-USD', uni: 'UNI-USD',
  polygon: 'MATIC-USD', matic: 'MATIC-USD',
  tron: 'TRX-USD', trx: 'TRX-USD',
  stellar: 'XLM-USD', xlm: 'XLM-USD',
  'shiba inu': 'SHIB-USD', shib: 'SHIB-USD',
  ton: 'TON-USD',
  near: 'NEAR-USD',
  atom: 'ATOM-USD', cosmos: 'ATOM-USD',
  sui: 'SUI-USD', sei: 'SEI-USD',
  aptos: 'APT-USD', apt: 'APT-USD',
};

function resolveSymbol(q: string): string {
  const lower = q.toLowerCase().trim();
  if (CRYPTO_MAP[lower]) return CRYPTO_MAP[lower];
  // 이미 -USD 포함 or .BTC 형태
  if (q.includes('-') || q.includes('.')) return q.toUpperCase();
  // 단순 코인 코드 → -USD 붙이기
  return `${q.toUpperCase()}-USD`;
}

/* ─────────────────────────────────────────────
 * 기술 지표 계산
 * ───────────────────────────────────────────── */

/** EMA (Exponential Moving Average) — 초기값은 단순 평균 */
function calcEMA(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = Array(prices.length).fill(null);
  if (prices.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  let ema = sum / period;
  result[period - 1] = Math.round(ema * 100) / 100;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result[i] = Math.round(ema * 100) / 100;
  }
  return result;
}

/** RSI (Wilder 스무딩) */
function calcRSI(prices: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = Array(prices.length).fill(null);
  if (prices.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) avgGain += d;
    else avgLoss += Math.abs(d);
  }
  avgGain /= period;
  avgLoss /= period;

  const rsi = (ag: number, al: number) =>
    al === 0 ? 100 : Math.round((100 - 100 / (1 + ag / al)) * 100) / 100;
  result[period] = rsi(avgGain, avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? Math.abs(d) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = rsi(avgGain, avgLoss);
  }
  return result;
}

/** Stochastic RSI — %K (raw) 와 %D (3-period SMA of %K) */
function calcStochRSI(
  rsis: (number | null)[],
  stochPeriod = 14,
  signalPeriod = 3,
): { stochK: (number | null)[]; stochD: (number | null)[] } {
  const n = rsis.length;
  const stochK: (number | null)[] = Array(n).fill(null);
  const stochD: (number | null)[] = Array(n).fill(null);

  for (let i = stochPeriod - 1; i < n; i++) {
    const window: number[] = [];
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      if (rsis[j] !== null) window.push(rsis[j] as number);
    }
    if (window.length < stochPeriod) continue;

    const cur = rsis[i];
    if (cur === null) continue;
    const lo = Math.min(...window);
    const hi = Math.max(...window);
    stochK[i] = hi === lo ? 50 : Math.round(((cur - lo) / (hi - lo)) * 10000) / 100;
  }

  for (let i = signalPeriod - 1; i < n; i++) {
    const kWin: number[] = [];
    for (let j = i - signalPeriod + 1; j <= i; j++) {
      if (stochK[j] !== null) kWin.push(stochK[j] as number);
    }
    if (kWin.length === signalPeriod) {
      stochD[i] = Math.round((kWin.reduce((a, b) => a + b, 0) / signalPeriod) * 100) / 100;
    }
  }
  return { stochK, stochD };
}

/* ─────────────────────────────────────────────
 * 온체인 지표 근사치 계산
 * ───────────────────────────────────────────── */

/**
 * NVT 비율 (Network Value to Transactions)
 * 근사식: 현재 시가총액 / 28일 평균 달러 거래량
 *
 * 낮을수록 ← 거래 활동 대비 저평가
 * 높을수록 → 투기적 과열 가능성
 */
function calcNVT(
  closes: number[],
  volumes: number[],
  marketCapRaw: number,
  currentPrice: number,
): CryptoMetric {
  const n = closes.length;

  if (n < 28 || currentPrice <= 0 || marketCapRaw <= 0) {
    return { value: 50, signal: 'normal', barPct: 33 };
  }

  const dollarVols = closes.map((c, i) => c * volumes[i]);
  const last28 = dollarVols.slice(-28);
  const avg28 = last28.reduce((a, b) => a + b, 0) / 28;

  if (avg28 <= 0) return { value: 50, signal: 'normal', barPct: 33 };

  const nvt = marketCapRaw / avg28;
  const signal: CryptoMetric['signal'] =
    nvt < 15  ? 'cold' :
    nvt < 50  ? 'normal' :
    nvt < 100 ? 'caution' : 'hot';
  const barPct = Math.min(100, Math.max(0, (nvt / 150) * 100));

  return { value: Math.round(nvt * 10) / 10, signal, barPct };
}

/**
 * MVRV Z-스코어 (Market Value to Realized Value)
 * 근사식: (현재가 − 90일 평균가) / 90일 표준편차
 *
 * <−1  → 과매도/누적 구간
 * 0~1.5 → 공정 가치
 * 1.5~3 → 주의 구간
 * >3   → 극단적 과열
 */
function calcMVRV(closes: number[]): CryptoMetric {
  const n = closes.length;
  const period = Math.min(90, n);

  if (period < 20) return { value: 0, signal: 'normal', barPct: 38 };

  const recent = closes.slice(-period);
  const mean = recent.reduce((a, b) => a + b, 0) / period;
  const variance = recent.reduce((a, v) => a + (v - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);

  const z = std > 0 ? (closes[n - 1] - mean) / std : 0;
  const signal: CryptoMetric['signal'] =
    z < -1  ? 'cold' :
    z < 1.5 ? 'normal' :
    z < 3   ? 'caution' : 'hot';

  // z=-3 → 0%, z=+5 → 100%
  const barPct = Math.min(100, Math.max(0, ((z + 3) / 8) * 100));
  return { value: Math.round(z * 100) / 100, signal, barPct };
}

/**
 * 퓨엘 멀티플 (Puell Multiple)
 * 근사식: 당일 달러 거래량 / 90일 평균 달러 거래량
 *
 * <0.5 → 채굴자 수익 극저 (매수 기회)
 * 0.5~1.5 → 정상 범주
 * 1.5~3  → 주의
 * >3     → 과열/분배 구간
 */
function calcPuell(closes: number[], volumes: number[]): CryptoMetric {
  const n = closes.length;
  const period = Math.min(90, n - 1);

  if (period < 10) return { value: 1, signal: 'normal', barPct: 20 };

  const dollarVols = closes.map((c, i) => c * volumes[i]);
  const historical = dollarVols.slice(-period - 1, -1);
  const avg = historical.reduce((a, b) => a + b, 0) / historical.length;
  const puell = avg > 0 ? dollarVols[n - 1] / avg : 1;

  const signal: CryptoMetric['signal'] =
    puell < 0.5 ? 'cold' :
    puell < 1.5 ? 'normal' :
    puell < 3   ? 'caution' : 'hot';
  const barPct = Math.min(100, Math.max(0, (puell / 5) * 100));

  return { value: Math.round(puell * 100) / 100, signal, barPct };
}

/* ─────────────────────────────────────────────
 * Yahoo Finance 응답 타입
 * ───────────────────────────────────────────── */
interface YFChartResult {
  meta: {
    currency?: string;
    symbol?: string;
    shortName?: string;
    longName?: string;
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
}
interface YFChartResponse {
  chart: {
    result?: YFChartResult[];
    error?: { code: string; description: string } | null;
  };
}
interface YFSummaryResponse {
  quoteSummary: {
    result?: Array<{
      price?: {
        shortName?: string;
        longName?: string;
        marketCap?: { raw?: number };
        regularMarketVolume?: { raw?: number };
      };
      summaryDetail?: {
        marketCap?: { raw?: number };
      };
    }>;
    error?: null | { code: string; description: string };
  };
}

/* ─────────────────────────────────────────────
 * Route Handler
 * ───────────────────────────────────────────── */
export async function GET(request: NextRequest): Promise<Response> {
  const rawQuery = (request.nextUrl.searchParams.get('ticker') ?? 'BTC-USD').trim();

  if (!rawQuery) {
    return Response.json(
      { error: '티커를 입력하세요. 예: BTC-USD, ETH-USD', fetchedAt: new Date().toISOString() },
      { status: 400 },
    );
  }

  const ticker = resolveSymbol(rawQuery);

  try {
    /* ── 차트(1년) + quoteSummary 병렬 호출 ───────────────── */
    const [chartRes, summaryRes] = await Promise.allSettled([
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } },
      ),
      fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=price,summaryDetail`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } },
      ),
    ]);

    /* ── 차트 파싱 (필수) ────────────────────────────────── */
    if (chartRes.status === 'rejected' || !chartRes.value.ok) {
      const code = chartRes.status === 'rejected' ? 'NETWORK_ERROR' : chartRes.value.status;
      throw new Error(`차트 요청 실패 (${code})`);
    }
    const chartData: YFChartResponse = await chartRes.value.json();
    const chartResult = chartData.chart.result?.[0];
    if (!chartResult) {
      const e = chartData.chart.error;
      throw new Error(e?.description ?? '차트 데이터 없음. 지원되지 않는 티커일 수 있습니다.');
    }

    const { meta, timestamp, indicators } = chartResult;
    const q = indicators.quote[0];

    const bars = timestamp
      .map((ts, i) => {
        const d = new Date(ts * 1000);
        return {
          date:   `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`,
          open:   Math.round((q.open[i]   ?? 0) * 100) / 100,
          high:   Math.round((q.high[i]   ?? 0) * 100) / 100,
          low:    Math.round((q.low[i]    ?? 0) * 100) / 100,
          close:  Math.round((q.close[i]  ?? 0) * 100) / 100,
          volume: Math.round(q.volume[i]  ?? 0),
        };
      })
      .filter(b => b.close > 0);

    if (!bars.length) throw new Error('유효한 봉 데이터가 없습니다.');

    const closes  = bars.map(b => b.close);
    const volumes = bars.map(b => b.volume);
    const last    = bars[bars.length - 1];
    const prev    = bars[bars.length - 2] ?? last;
    const lastIdx = bars.length - 1;

    const currentPrice = (meta.regularMarketPrice ?? 0) > 0 ? meta.regularMarketPrice! : last.close;
    const prevClose    = (meta.chartPreviousClose ?? 0) > 0 ? meta.chartPreviousClose! : prev.close;
    const change       = Math.round((currentPrice - prevClose) * 100) / 100;
    const changePct    = Math.round((change / prevClose) * 10000) / 100;

    const week52High = Math.max(...bars.map(b => b.high));
    const week52Low  = Math.min(...bars.map(b => b.low));

    /* ── quoteSummary 파싱 (선택) ────────────────────────── */
    let name        = ticker;
    let marketCapRaw = 0;
    try {
      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const sd: YFSummaryResponse = await summaryRes.value.json();
        const r = sd.quoteSummary?.result?.[0];
        if (r) {
          name = r.price?.shortName || r.price?.longName || ticker;
          marketCapRaw = r.summaryDetail?.marketCap?.raw ?? r.price?.marketCap?.raw ?? 0;
        }
      }
    } catch { /* optional — quoteSummary is best-effort */ }

    /* ── 기술 지표 계산 ────────────────────────────────────── */
    const ema20  = calcEMA(closes, 20);
    const ema50  = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, 200);
    const rsiArr = calcRSI(closes, 14);
    const { stochK, stochD } = calcStochRSI(rsiArr, 14, 3);

    /* ── 차트 행 빌드 ──────────────────────────────────────── */
    const allRows: CryptoChartRow[] = bars.map((b, i) => ({
      ...b,
      ema20:  ema20[i],
      ema50:  ema50[i],
      ema200: ema200[i],
      rsi:    rsiArr[i],
      stochK: stochK[i],
      stochD: stochD[i],
    }));

    /* ── 온체인 지표 근사치 ─────────────────────────────────── */
    const nvt   = calcNVT(closes, volumes, marketCapRaw, currentPrice);
    const mvrv  = calcMVRV(closes);
    const puell = calcPuell(closes, volumes);

    /* ── 24h 달러 거래량 ────────────────────────────────────── */
    const dollarVol = currentPrice * last.volume;

    const data: CryptoData = {
      ticker,
      name,
      currentPrice,
      change,
      changePercent: changePct,
      volume:   fmtVol(dollarVol),
      marketCap: marketCapRaw > 0 ? fmtCap(marketCapRaw) : 'N/A',
      marketCapRaw,
      week52High,
      week52Low,
      currency:  'USD',
      fetchedAt: new Date().toISOString(),
      chartRows: allRows.slice(-90),   // 최근 90일만 전달
      allPrices: closes,
      latestRSI:    rsiArr[lastIdx],
      latestStochK: stochK[lastIdx],
      latestStochD: stochD[lastIdx],
      latestEMA20:  ema20[lastIdx],
      latestEMA50:  ema50[lastIdx],
      latestEMA200: ema200[lastIdx],
      nvt,
      mvrv,
      puell,
    };

    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    });

  } catch (err) {
    return Response.json(
      {
        error: `${err instanceof Error ? err.message : err}. 지원 예시: BTC-USD, ETH-USD, SOL-USD, DOGE-USD`,
        ticker,
        fetchedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
