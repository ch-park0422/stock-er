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
    provider?: 'alphavantage' | 'finnhub' | 'mock';
    /** ISO 타임스탬프 */
    fetchedAt: string;
    /** API 키 미설정·Rate Limit 등 사유 메모 */
    note?: string;
  };

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
