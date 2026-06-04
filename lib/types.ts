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
