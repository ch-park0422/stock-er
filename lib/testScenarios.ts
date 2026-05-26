/**
 * testScenarios.ts
 * QA 하네스 — 극단 시나리오 Mock 데이터 생성기
 *
 * 세 가지 오작동 유발 시나리오:
 *   ① surge_crash   : 폭등/폭락 (일일 변동 15~25%)
 *   ② missing_data  : 데이터 누락 (null / 0 / 음수 삽입)
 *   ③ sideways      : 횡보 + 거래량 제로 (변동 0.02% 이내)
 */

import type { DCFParams } from './analysis';

/* ─────────────────────────────────────────────
 * 공통 타입
 * ───────────────────────────────────────────── */
export type ScenarioId = 'surge_crash' | 'missing_data' | 'sideways';

export interface DCFTestCase {
  label: string;
  params: DCFParams;
  /** true: 양수 유한값 필수 / false: 유한값만 확인 (0·음수 허용) */
  expectFinitePositive: boolean;
}

export interface TestScenario {
  id: ScenarioId;
  name: string;
  description: string;
  tags: string[];
  /** 원본 가격 배열 — null / 0 / 음수 포함 가능 */
  rawPrices: (number | null)[];
  /** 정제된 가격 배열 — null·0·음수·NaN 제거 완료 */
  cleanPrices: number[];
  dcfTestCases: DCFTestCase[];
}

/* ─────────────────────────────────────────────
 * 시드 기반 PRNG (mulberry32)
 * ───────────────────────────────────────────── */
function mkRand(seed: number) {
  let s = seed;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ═══════════════════════════════════════════════
 * ① 폭등/폭락 시나리오
 *
 *  Phase 1 (idx  0–19) : 정상  ±2%/일
 *  Phase 2 (idx 20–39) : 급등 +10~+20%/일 → RSI > 90 유도
 *  Phase 3 (idx 40–59) : 폭락 -15~-25%/일 → RSI < 10 유도
 *  Phase 4 (idx 60–89) : 고변동 회복  ±8~15%
 *
 *  예: Phase2 15%×20일 → 시작가 ×16배
 *      Phase3 20%×20일 → 16배 × 0.013 ≈ 시작가 0.2배
 * ═══════════════════════════════════════════════ */
export function generateSurgeCrashScenario(): TestScenario {
  const rand = mkRand(0xdead_beef);
  const prices: number[] = [];
  let p = 100;

  for (let i = 0; i < 90; i++) {
    let r: number;
    if      (i < 20) r =  (rand() - 0.5) * 0.04;          // ±2 %
    else if (i < 40) r =  0.10 + rand() * 0.10;            // +10 ~ +20 %
    else if (i < 60) r = -(0.15 + rand() * 0.10);          // -15 ~ -25 %
    else             r =  (rand() - 0.40) * 0.16;          // ±8~15 % (편향 상승)
    p = Math.max(p * (1 + r), 0.01);
    prices.push(Math.round(p * 100) / 100);
  }

  return {
    id: 'surge_crash',
    name: '폭등/폭락 시나리오',
    description: '일일 변동성 15~25%, 급등→블랙스완 폭락. 극단 RSI 및 MACD 추세 반전 검증.',
    tags: ['고변동성', 'RSI 극값', 'MACD 추세반전', '경계값 테스트'],
    rawPrices: prices,
    cleanPrices: prices,
    dcfTestCases: [
      {
        label: '고성장 기업 (FCF $50B, g=30%)',
        params: { fcf: 50_000, shares: 5_000, netDebt: -10_000, growthRate: 0.30, discountRate: 0.12, terminalGrowthRate: 0.04 },
        expectFinitePositive: true,
      },
      {
        label: '극단 고성장: g=39.9%, WACC=40% (분모 최소화)',
        params: { fcf: 10_000, shares: 1_000, netDebt: 0, growthRate: 0.399, discountRate: 0.40, terminalGrowthRate: 0.035 },
        expectFinitePositive: true,
      },
      {
        label: '터미널 성장 = WACC (분모=0 방어)',
        params: { fcf: 5_000, shares: 500, netDebt: 0, growthRate: 0.10, discountRate: 0.08, terminalGrowthRate: 0.08 },
        expectFinitePositive: true, // safeTerminal 클램핑으로 방어
      },
    ],
  };
}

/* ═══════════════════════════════════════════════
 * ② 데이터 누락 시나리오
 *
 *  인덱스 패턴:
 *    i % 7  === 0 → null   (피드 누락)
 *    i % 13 === 0 → 0      (데이터 오류)
 *    i % 23 === 0 → -99    (잘못된 음수 입력)
 *
 *  ~ 90개 중 약 23개 비유효 (결측률 ~26%)
 * ═══════════════════════════════════════════════ */
export function generateMissingDataScenario(): TestScenario {
  const rand = mkRand(0xc0ff_ee00);
  const raw: (number | null)[] = [];
  let p = 150;

  for (let i = 0; i < 90; i++) {
    p = Math.max(p * (1 + (rand() - 0.5) * 0.025), 0.01);
    const rounded = Math.round(p * 100) / 100;

    if      (i % 7  === 0) { raw.push(null); continue; }
    if      (i % 13 === 0) { raw.push(0);    continue; }
    else if (i % 23 === 0) { raw.push(-99);  continue; }
    raw.push(rounded);
  }

  const clean = raw.filter((v): v is number => v !== null && v > 0 && Number.isFinite(v));

  return {
    id: 'missing_data',
    name: '데이터 누락 시나리오',
    description: 'null·0·음수값 산재 (7/13/23주기). 정제·복구 후 RSI·DCF 무결성 검증.',
    tags: ['결측치', '데이터 정제', '음수 입력', 'DCF 엣지 케이스'],
    rawPrices: raw,
    cleanPrices: clean,
    dcfTestCases: [
      {
        label: '정상 입력 (정제 후 기준)',
        params: { fcf: 5_000, shares: 500, netDebt: -2_000, growthRate: 0.08, discountRate: 0.09, terminalGrowthRate: 0.025 },
        expectFinitePositive: true,
      },
      {
        label: 'FCF = 0 (수익 없는 기업)',
        params: { fcf: 0, shares: 100, netDebt: 0, growthRate: 0.05, discountRate: 0.08, terminalGrowthRate: 0.02 },
        expectFinitePositive: false, // 0 허용
      },
      {
        label: 'FCF 음수 -$2B (적자 기업)',
        params: { fcf: -2_000, shares: 200, netDebt: 5_000, growthRate: 0.05, discountRate: 0.10, terminalGrowthRate: 0.02 },
        expectFinitePositive: false, // Math.max 클램핑 → 0 허용
      },
      {
        label: '터미널 성장 ≈ WACC-0.001 (분모 최소, TV 폭증)',
        params: { fcf: 3_000, shares: 300, netDebt: 0, growthRate: 0.05, discountRate: 0.08, terminalGrowthRate: 0.079 },
        expectFinitePositive: true, // 매우 크지만 유한해야 함
      },
    ],
  };
}

/* ═══════════════════════════════════════════════
 * ③ 횡보 + 거래량 제로 시나리오
 *
 *  가격 변동 ±0.01% 이내 → RSI ≈ 50 수렴 예상
 *  SMA20 ≈ SMA60 ≈ 현재가 (편차 < 0.05%)
 *  MACD ≈ 0 수렴 예상
 * ═══════════════════════════════════════════════ */
export function generateSidewaysScenario(): TestScenario {
  const rand = mkRand(0xface_b00c);
  const prices: number[] = [];
  const BASE = 200;

  for (let i = 0; i < 90; i++) {
    const noise = (rand() - 0.5) * 0.0002; // ±0.01%
    prices.push(Math.round(BASE * (1 + noise) * 10000) / 10000);
  }

  return {
    id: 'sideways',
    name: '횡보/거래량 제로 시나리오',
    description: '가격 변동 0.01% 이내, 거래량 0. RSI·MACD 중립 수렴 및 제로 성장 DCF 검증.',
    tags: ['횡보', '무거래', 'RSI 중립', 'MACD 0수렴', '제로성장 DCF'],
    rawPrices: prices,
    cleanPrices: prices,
    dcfTestCases: [
      {
        label: '제로 성장 기업 (g=0%)',
        params: { fcf: 1_000, shares: 100, netDebt: 0, growthRate: 0.00, discountRate: 0.05, terminalGrowthRate: 0.01 },
        expectFinitePositive: true,
      },
      {
        label: '초소형 FCF ($100M), 최저 WACC 5%',
        params: { fcf: 100, shares: 10, netDebt: -500, growthRate: 0.0, discountRate: 0.05, terminalGrowthRate: 0.005 },
        expectFinitePositive: true,
      },
      {
        label: '주식수 = 1주 (단주 극단값)',
        params: { fcf: 1_000, shares: 0.001, netDebt: 0, growthRate: 0.03, discountRate: 0.07, terminalGrowthRate: 0.02 },
        expectFinitePositive: true,
      },
    ],
  };
}

/** 세 시나리오 모두 반환 */
export function generateAllScenarios(): TestScenario[] {
  return [
    generateSurgeCrashScenario(),
    generateMissingDataScenario(),
    generateSidewaysScenario(),
  ];
}
