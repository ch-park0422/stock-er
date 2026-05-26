/**
 * mockData.ts
 * GenerateMockData: 시드 기반 결정론적 가격 데이터 + 재무 데이터 생성
 */
import {
  PriceBar,
  calculateSMA,
  calculateRSI,
  calculateMACD,
  MACDPoint,
} from './analysis';

/* ─────────────────────────────────────────────
 * 시드 기반 PRNG (mulberry32)
 * ───────────────────────────────────────────── */
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─────────────────────────────────────────────
 * 기업별 재무 기준 데이터
 * (실제 공개 재무제표 기반 근사치)
 * ───────────────────────────────────────────── */
export interface CompanyFundamentals {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  employees: string;
  description: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: string;
  marketCap: string;
  week52High: number;
  week52Low: number;

  /* DCF 입력값 */
  fcf: number;              // 연간 잉여현금흐름 (백만 달러)
  shares: number;           // 발행주식수 (백만 주)
  netDebt: number;          // 순부채 (백만 달러, 음수 = 순현금)
  defaultGrowthRate: number;
  defaultWACC: number;
  defaultTerminalGrowth: number;

  /* 밸류에이션 지표 */
  per: number;
  industryPer: number;
  pbr: number;
  industryPbr: number;
  roe: number;
  industryRoe: number;
  evEbitda: number;
  industryEvEbitda: number;
  dividendYield: number;
  debtToEquity: number;
  currentRatio: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
}

export const COMPANY_DB: Record<string, CompanyFundamentals> = {
  AAPL: {
    ticker: 'AAPL', name: 'Apple Inc.', sector: '기술', industry: '소비자 전자제품',
    exchange: 'NASDAQ', employees: '161,000',
    description: 'iPhone·Mac·iPad·Apple Watch 등 하드웨어와 App Store·iCloud·Apple Music 서비스로 글로벌 생태계를 구축한 세계 최대 시가총액 테크 기업.',
    currentPrice: 189.30, change: 2.45, changePercent: 1.31,
    volume: '52.3M', marketCap: '$2.87T', week52High: 199.62, week52Low: 143.90,
    // 재무 데이터 (FY2023 기준)
    fcf: 99584, shares: 15550, netDebt: -49271,
    defaultGrowthRate: 0.09, defaultWACC: 0.085, defaultTerminalGrowth: 0.03,
    // → DCF: ~$194/주 vs $189 → 약 +2.6% 저평가
    per: 28.5, industryPer: 24.2, pbr: 45.2, industryPbr: 8.3,
    roe: 147.9, industryRoe: 28.4, evEbitda: 21.3, industryEvEbitda: 18.7,
    dividendYield: 0.51, debtToEquity: 1.76, currentRatio: 0.99,
    grossMargin: 44.5, operatingMargin: 29.8, netMargin: 26.3,
  },
  TSLA: {
    ticker: 'TSLA', name: 'Tesla, Inc.', sector: '임의소비재', industry: '전기차 제조',
    exchange: 'NASDAQ', employees: '127,855',
    description: '전기차·에너지 저장·자율주행 기술을 선도하는 클린에너지 기업. FSD와 Dojo 슈퍼컴퓨터로 AI 기업 전환을 추진 중.',
    currentPrice: 248.50, change: -5.30, changePercent: -2.09,
    volume: '98.1M', marketCap: '$791B', week52High: 299.29, week52Low: 138.80,
    // 재무 데이터 (FY2023 기준)
    fcf: 4358, shares: 3178, netDebt: -11400,
    defaultGrowthRate: 0.30, defaultWACC: 0.10, defaultTerminalGrowth: 0.04,
    // → DCF: ~$168/주 vs $249 → 약 -32% 고평가
    per: 72.3, industryPer: 18.4, pbr: 12.8, industryPbr: 4.2,
    roe: 18.9, industryRoe: 22.1, evEbitda: 42.1, industryEvEbitda: 12.3,
    dividendYield: 0, debtToEquity: 0.18, currentRatio: 1.73,
    grossMargin: 17.9, operatingMargin: 8.6, netMargin: 7.3,
  },
  MSFT: {
    ticker: 'MSFT', name: 'Microsoft Corporation', sector: '기술', industry: '소프트웨어',
    exchange: 'NASDAQ', employees: '221,000',
    description: 'Azure 클라우드·Office 365·GitHub·OpenAI 파트너십으로 기업용 AI를 선도하는 글로벌 소프트웨어 기업. 안정적 구독 수익이 강점.',
    currentPrice: 415.20, change: 3.80, changePercent: 0.92,
    volume: '18.9M', marketCap: '$3.08T', week52High: 468.35, week52Low: 309.45,
    // 재무 데이터 (FY2023 기준)
    fcf: 59475, shares: 7434, netDebt: -18734,
    defaultGrowthRate: 0.135, defaultWACC: 0.075, defaultTerminalGrowth: 0.03,
    // → DCF: ~$421/주 vs $415 → 약 +1.4% 저평가 (적정)
    per: 34.2, industryPer: 24.2, pbr: 12.4, industryPbr: 8.3,
    roe: 36.7, industryRoe: 28.4, evEbitda: 24.8, industryEvEbitda: 18.7,
    dividendYield: 0.72, debtToEquity: 0.35, currentRatio: 1.34,
    grossMargin: 69.4, operatingMargin: 44.6, netMargin: 37.1,
  },
  GOOGL: {
    ticker: 'GOOGL', name: 'Alphabet Inc.', sector: '통신서비스', industry: '인터넷 광고',
    exchange: 'NASDAQ', employees: '182,381',
    description: 'Google 검색·YouTube·Google Cloud·Android 운영 지주회사. Gemini AI 모델로 검색 광고와 클라우드 사업에서 AI 경쟁력을 강화 중.',
    currentPrice: 171.95, change: 1.15, changePercent: 0.67,
    volume: '21.4M', marketCap: '$2.15T', week52High: 193.31, week52Low: 120.21,
    // 재무 데이터 (FY2023 기준)
    fcf: 69495, shares: 12665, netDebt: -79476,
    defaultGrowthRate: 0.10, defaultWACC: 0.085, defaultTerminalGrowth: 0.03,
    // → DCF: ~$183/주 vs $172 → 약 +6.4% 저평가
    per: 25.8, industryPer: 22.4, pbr: 6.2, industryPbr: 4.8,
    roe: 25.4, industryRoe: 20.1, evEbitda: 16.9, industryEvEbitda: 14.2,
    dividendYield: 0.48, debtToEquity: 0.09, currentRatio: 2.10,
    grossMargin: 56.9, operatingMargin: 28.4, netMargin: 24.0,
  },
};

/* ─────────────────────────────────────────────
 * GenerateMockData
 * 반환: 가격 이력 + 모든 기술지표 계산 완료된 배열
 * ───────────────────────────────────────────── */
export interface ChartRow extends PriceBar {
  sma20: number | null;
  sma60: number | null;
  rsi:   number | null;
  macdLine:   number | null;
  signalLine: number | null;
  histogram:  number | null;
}

export interface MockDataResult {
  chartRows: ChartRow[];          // 최근 90일 (차트 표시용)
  allPrices:  number[];           // 전체 종가 배열 (지표 계산 완료 기준)
  latestRSI:  number | null;
  latestSMA20: number | null;
  latestSMA60: number | null;
}

export function GenerateMockData(ticker: string, startPrice: number): MockDataResult {
  const seed = ticker.split('').reduce((acc, c) => acc + c.charCodeAt(0) * 31, 0) * 997;
  const rand = mulberry32(seed);
  const TOTAL = 130; // 기술지표 안정화를 위해 130일 생성
  const rawBars: PriceBar[] = [];
  let price = startPrice;
  const baseDate = new Date('2025-01-06');

  for (let i = 0; i < TOTAL; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // 주말 제외

    // 일별 수익률: 랜덤 워크 + 약한 상향 편향
    const drift  = 0.0003;
    const vol    = 0.015;
    const dailyReturn = (rand() - 0.49) * vol + drift;
    price = Math.max(price * (1 + dailyReturn), 5);

    const open   = price * (1 + (rand() - 0.5) * 0.006);
    const high   = price * (1 + rand() * 0.013);
    const low    = price * (1 - rand() * 0.013);
    const volume = Math.round(rand() * 60_000_000 + 20_000_000);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');

    rawBars.push({
      date: `${mm}/${dd}`,
      open:   Math.round(open  * 100) / 100,
      high:   Math.round(high  * 100) / 100,
      low:    Math.round(low   * 100) / 100,
      close:  Math.round(price * 100) / 100,
      volume,
    });
  }

  /* ── 기술지표 계산 ─────────────────────── */
  const closes = rawBars.map(b => b.close);
  const sma20arr  = calculateSMA(closes, 20);
  const sma60arr  = calculateSMA(closes, 60);
  const rsi14arr  = calculateRSI(closes, 14);
  const macdArr: MACDPoint[] = calculateMACD(closes, 12, 26, 9);

  /* ── ChartRow 조합 ─────────────────────── */
  const allRows: ChartRow[] = rawBars.map((bar, i) => ({
    ...bar,
    sma20: sma20arr[i],
    sma60: sma60arr[i],
    rsi:   rsi14arr[i],
    macdLine:   macdArr[i].macdLine,
    signalLine: macdArr[i].signalLine,
    histogram:  macdArr[i].histogram,
  }));

  const display = allRows.slice(-90); // 최근 90일만 화면에 표시

  const lastIdx = allRows.length - 1;
  return {
    chartRows:   display,
    allPrices:   closes,
    latestRSI:   rsi14arr[lastIdx],
    latestSMA20: sma20arr[lastIdx],
    latestSMA60: sma60arr[lastIdx],
  };
}

export const START_PRICES: Record<string, number> = {
  AAPL: 162, TSLA: 185, MSFT: 378, GOOGL: 140,
};
