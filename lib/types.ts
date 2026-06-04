/**
 * lib/types.ts
 * 프론트엔드·백엔드 공유 타입 정의
 *
 * StockData = CompanyFundamentals + MockDataResult + API 메타데이터
 * → API Route가 반환하고 프론트엔드 State가 소비하는 단일 통합 타입
 */

import type { CompanyFundamentals, MockDataResult } from './mockData';

/**
 * /api/stock 엔드포인트의 성공 응답 타입
 *
 * - source: 'live'  → 외부 API 실제 데이터 (Alpha Vantage 또는 Finnhub)
 * - source: 'mock'  → API 키 미설정 또는 모든 API 실패 시 Seed 기반 Mock 폴백
 * - provider: 어떤 API에서 데이터를 받아왔는지
 */
export type StockData = CompanyFundamentals &
  MockDataResult & {
    /** 데이터 출처 */
    source: 'live' | 'mock';
    /** 실제 데이터 제공 API */
    provider?: 'alphavantage' | 'finnhub' | 'yahoo' | 'mock';
    /** ISO 타임스탬프 */
    fetchedAt: string;
    /** API 키 미설정·Rate Limit 등 사유 메모 */
    note?: string;
    /** 주식 원본 통화 코드 ('KRW' | 'USD' | …) */
    currency: string;
    /** 실시간 USD→KRW 환율 (fallback 1350) */
    exchangeRate: number;

    /* ── Guru Strategy fields (Yahoo Finance quoteSummary) ─────────────────
     * 야후 파이낸스 quoteSummary에서 추출한 대가 전략 분석용 추가 지표.
     * Alpha Vantage / Finnhub 경로에서는 undefined.
     * ──────────────────────────────────────────────────────────────────── */
    /** PEG 비율 (Yahoo Finance 사전 계산값, defaultKeyStatistics.pegRatio) */
    pegRatio?: number;
    /** EPS 성장률 소수 (0.20 = 20%, financialData.earningsGrowth) */
    earningsGrowth?: number;
    /** 순이익 — 보통주 귀속분, 백만 단위 (financialData.netIncomeToCommon) */
    netIncome?: number;
    /** 영업현금흐름, 백만 단위 (financialData.operatingCashflow) */
    operatingCashflow?: number;
    /** 총자산이익률 소수 (0.05 = 5%, financialData.returnOnAssets) */
    returnOnAssets?: number;
    /** EBITDA, 백만 단위 (financialData.ebitda) */
    ebitda?: number;
    /** 총부채, 백만 단위 (financialData.totalDebt) */
    totalDebt?: number;
  };

/* ─────────────────────────────────────────────
 * Crypto Data Types  (/api/crypto)
 * ───────────────────────────────────────────── */

/** 크립토 차트 봉 데이터 (EMA 리본 + Stochastic RSI 포함) */
export interface CryptoChartRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** 코인 단위 거래량 (예: BTC) */
  volume: number;
  ema20:  number | null;
  ema50:  number | null;
  ema200: number | null;
  rsi:    number | null;
  /** Stochastic RSI %K */
  stochK: number | null;
  /** Stochastic RSI %D (3-period SMA of %K) */
  stochD: number | null;
}

/** 온체인 지표 개별 결과 (시뮬레이션 근사치) */
export interface CryptoMetric {
  /** 지표 값 */
  value: number;
  /** 신호 구간 */
  signal: 'cold' | 'normal' | 'caution' | 'hot';
  /** 인디케이터 바 위치 0–100% */
  barPct: number;
}

/** /api/crypto 성공 응답 타입 */
export interface CryptoData {
  ticker: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  /** 포맷된 24h 달러 거래량 */
  volume: string;
  /** 포맷된 시가총액 */
  marketCap: string;
  /** 시가총액 원시 수치 (USD) */
  marketCapRaw: number;
  week52High: number;
  week52Low: number;
  /** 항상 'USD' */
  currency: string;
  fetchedAt: string;
  /** 최근 90일 차트 행 */
  chartRows: CryptoChartRow[];
  /** 전체 종가 배열 (지표 계산용) */
  allPrices: number[];
  latestRSI:    number | null;
  latestStochK: number | null;
  latestStochD: number | null;
  latestEMA20:  number | null;
  latestEMA50:  number | null;
  latestEMA200: number | null;
  /** NVT 비율 (거래량 기반 근사치) */
  nvt: CryptoMetric;
  /** MVRV Z-스코어 (가격 Z-점수 근사치) */
  mvrv: CryptoMetric;
  /** 퓨엘 멀티플 (거래량 비율 근사치) */
  puell: CryptoMetric;
}

/* ─────────────────────────────────────────────
 * Market Pulse Types  (/api/market)
 * ───────────────────────────────────────────── */

/**
 * 한국 주식 표준화 인터페이스
 * 향후 한국투자증권 Open API(KIS) 또는 DART API 스위칭을 위한 단일 계약 타입
 *
 * KIS API 주요 필드 매핑:
 *  stck_prpr     → currentPrice      (현재가)
 *  prdy_vrss     → changeAmount      (전일 대비)
 *  prdy_ctrt     → changePercent     (등락률)
 *  acml_vol      → volume            (누적 거래량)
 *  acml_tr_pbmn  → turnover          (누적 거래대금)
 *  hts_kor_isnm  → name              (종목명)
 *  mksc_shrn_iscd→ ticker            (단축 종목코드)
 *
 * DART OpenAPI 주요 필드 매핑:
 *  stock_code → ticker
 *  corp_name  → name
 */
export interface DomesticStockData {
  /** 종목 코드 (6자리, KIS: mksc_shrn_iscd) */
  ticker: string;
  /** 종목명 (KIS: hts_kor_isnm) */
  name: string;
  /** 상장 시장 */
  market: 'KOSPI' | 'KOSDAQ' | 'KONEX';
  /** GICS 섹터 분류 */
  sector: string;
  /** 세부 산업 분류 */
  industry: string;
  /** 현재가 KRW (KIS: stck_prpr) */
  currentPrice: number;
  /** 전일 대비 등락 KRW (KIS: prdy_vrss) */
  changeAmount: number;
  /** 등락률 % (KIS: prdy_ctrt) */
  changePercent: number;
  /** 누적 거래량 주 (KIS: acml_vol) */
  volume: number;
  /** 누적 거래대금 KRW (KIS: acml_tr_pbmn) */
  turnover: number;
  /** 시가총액 억 KRW (KIS: stck_avls) */
  marketCapBillionKRW: number;
  /** PER (KIS: per) */
  per?: number;
  /** PBR (KIS: pbr) */
  pbr?: number;
  /** ROE % */
  roe?: number;
  /** 외국인 보유율 % (KIS: frgn_hldn_qty_rate) */
  foreignHolding?: number;
  /** 52주 최고가 (KIS: d250_hgpr) */
  week52High?: number;
  /** 52주 최저가 (KIS: d250_lwpr) */
  week52Low?: number;
  /**
   * 데이터 공급처
   * - 'kis'  : 한국투자증권 Open API
   * - 'dart' : 금융감독원 DART OpenAPI
   * - 'naver': 네이버 금융 스크래핑 (비공식)
   * - 'mock' : 시뮬레이션 가상 데이터
   */
  dataSource: 'kis' | 'dart' | 'naver' | 'mock';
  /** ISO 타임스탬프 */
  fetchedAt: string;
}

/** 마켓 무버 단일 항목 (급등·급락·거래량 랭킹) */
export interface MarketMover {
  /** 랭킹 (1부터 시작) */
  rank: number;
  /** 티커 / 종목코드 */
  ticker: string;
  /** 종목명 */
  name: string;
  /** 시장 구분 */
  market: 'KR' | 'US';
  /** 거래소 */
  exchange: 'KOSPI' | 'KOSDAQ' | 'NYSE' | 'NASDAQ';
  /** 현재가 */
  currentPrice: number;
  /** 등락률 % */
  changePercent: number;
  /** 등락 절대값 */
  changeAmount: number;
  /** 포맷된 거래량 문자열 ('4.2억주' | '45.2M') */
  volume: string;
  /** 통화 */
  currency: 'KRW' | 'USD';
}

/** 트렌딩 섹터 내 개별 추천 종목 */
export interface SectorStock {
  /** 티커 / 종목코드 */
  ticker: string;
  /** 종목명 */
  name: string;
  /** 시장 구분 */
  market: 'KR' | 'US';
  /** 거래소 */
  exchange: 'KOSPI' | 'KOSDAQ' | 'NYSE' | 'NASDAQ';
  /** 대장주(시총 1위) 또는 이슈주(뉴스 트렌드) */
  role: 'leader' | 'issue';
  /** 추천 사유 KO/EN */
  reason: { ko: string; en: string };
  /** 당일 등락률 % */
  changePercent: number;
  /** 현재가 */
  currentPrice: number;
  /** 통화 */
  currency: 'KRW' | 'USD';
}

/** 트렌딩 섹터 */
export interface TrendingSector {
  /** 섹터 고유 ID */
  id: string;
  /** 대표 이모지 */
  emoji: string;
  /** 섹터명 KO/EN */
  name: { ko: string; en: string };
  /** 핵심 키워드·세부 테마 KO/EN */
  theme: { ko: string; en: string };
  /** 이번 시즌 핫한 이유 KO/EN (1–2문장) */
  reason: { ko: string; en: string };
  /** 색상 테마 키 (페이지에서 클래스 매핑) */
  colorKey: 'blue' | 'violet' | 'amber';
  /** 대장주 + 이슈주 (최대 2개) */
  stocks: SectorStock[];
}

/** /api/market 성공 응답 타입 */
export interface MarketPulseData {
  movers: {
    kr: { gainers: MarketMover[]; losers: MarketMover[]; volume: MarketMover[] };
    us: { gainers: MarketMover[]; losers: MarketMover[]; volume: MarketMover[] };
  };
  sectors: TrendingSector[];
  /** ISO 타임스탬프 */
  fetchedAt: string;
  /**
   * 데이터 소스
   * - 'mock': 시뮬레이션 데이터 (현재값)
   * - 'live': 실제 API 연동 시
   */
  dataSource: 'mock' | 'live';
}

/** /api/stock의 HTTP 4xx·5xx 에러 응답 타입 */
export interface ApiErrorResponse {
  error: string;
  ticker: string;
  fetchedAt: string;
}

/**
 * 테스트 하네스 API 헬스체크 결과 (클라이언트 전용)
 */
export interface HealthCheckResult {
  ticker: string;
  status: 'idle' | 'pending' | 'ok' | 'error';
  httpStatus?: number;
  responseTimeMs?: number;
  source?: 'live' | 'mock';
  currentPrice?: number;
  dataPoints?: number;
  note?: string;
  errorMessage?: string;
  fetchedAt?: string;
}
