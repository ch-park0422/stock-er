/**
 * testHarness.ts
 * 로직 검증 엔진 (Assertion Core)
 *
 * 각 극단 시나리오 데이터를 분석 함수에 주입하고,
 * 결과값이 수학적·금융학적 경계 조건을 만족하는지 검증합니다.
 *
 * 반환 형식:
 *   ScenarioTestResult { scenarioName, passed, executionTime, errorLog?, assertions[], stats }
 */

import {
  calculateDCF,
  calculateRSI,
  calculateSMA,
  calculateMACD,
} from './analysis';

import {
  generateAllScenarios,
  type TestScenario,
  type DCFTestCase,
} from './testScenarios';

/* ─────────────────────────────────────────────
 * 공개 타입
 * ───────────────────────────────────────────── */
export interface AssertionResult {
  /** 어설션 이름 */
  name: string;
  /** 통과 여부 */
  passed: boolean;
  /** 실제 산출값 (디버깅용) */
  actual?: string;
  /** 기대 조건 (디버깅용) */
  expected?: string;
  /** 실패 이유 */
  error?: string;
}

export interface ScenarioTestResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  /** 예) "7ms" */
  executionTime: string;
  /** 실패 시 최초 오류 요약 */
  errorLog?: string;
  assertions: AssertionResult[];
  stats: {
    total: number;
    passed: number;
    failed: number;
  };
}

export interface HarnessResult {
  results: ScenarioTestResult[];
  totalPassed: number;
  totalFailed: number;
  /** 전체 소요 시간 */
  totalTime: string;
}

/* ─────────────────────────────────────────────
 * 내부 헬퍼
 * ───────────────────────────────────────────── */

/** v 가 유한한 숫자인지 (NaN·Infinity 제외) */
const isFiniteNum = (v: number) => Number.isFinite(v);

/** 단일 어설션을 생성 */
function assert(
  name: string,
  condition: boolean,
  actual: string,
  expected: string,
): AssertionResult {
  return {
    name,
    passed: condition,
    actual,
    expected,
    error: condition ? undefined : `Expected: ${expected}  /  Actual: ${actual}`,
  };
}

/* ─────────────────────────────────────────────
 * RSI 어설션 묶음
 * ───────────────────────────────────────────── */
function assertRSI(prices: number[]): AssertionResult[] {
  const results: AssertionResult[] = [];
  const rsiArr = calculateRSI(prices, 14);
  const validRSIs = rsiArr.filter((v): v is number => v !== null);

  // 1) 계산 가능한 RSI가 존재해야 함
  results.push(
    assert(
      'RSI: 유효값 존재',
      validRSIs.length > 0,
      `${validRSIs.length}개`,
      '1개 이상',
    ),
  );

  // 2) 모든 RSI가 NaN·Infinity가 아니어야 함
  const allFinite = validRSIs.every(isFiniteNum);
  results.push(
    assert(
      'RSI: 모든 값 유한(Finite)',
      allFinite,
      allFinite ? '전부 유한' : `비유한값: ${validRSIs.filter(v => !isFiniteNum(v)).join(', ')}`,
      '모두 Number.isFinite',
    ),
  );

  // 3) 범위: 0 ≤ RSI ≤ 100
  const allInRange = validRSIs.every(v => v >= 0 && v <= 100);
  const outOfRange = validRSIs.filter(v => v < 0 || v > 100);
  results.push(
    assert(
      'RSI: 모든 값 [0, 100] 범위',
      allInRange,
      allInRange ? '범위 내 전부' : `범위 이탈 ${outOfRange.length}개: [${outOfRange.slice(0, 3).join(', ')}…]`,
      '0 ≤ RSI ≤ 100',
    ),
  );

  return results;
}

/* ─────────────────────────────────────────────
 * SMA 어설션 묶음
 * ───────────────────────────────────────────── */
function assertSMA(prices: number[]): AssertionResult[] {
  const results: AssertionResult[] = [];
  const sma20 = calculateSMA(prices, 20);
  const sma60 = calculateSMA(prices, 60);
  const valid20 = sma20.filter((v): v is number => v !== null);
  const valid60 = sma60.filter((v): v is number => v !== null);

  // SMA20 — 양수 & 유한
  const sma20Ok = valid20.every(v => isFiniteNum(v) && v > 0);
  results.push(
    assert(
      'SMA20: 모든 값 양수·유한',
      sma20Ok,
      sma20Ok ? '전부 정상' : `비정상: ${valid20.filter(v => !isFiniteNum(v) || v <= 0).length}개`,
      'finite && > 0',
    ),
  );

  // SMA60 — 양수 & 유한 (값이 충분히 있을 경우)
  if (valid60.length > 0) {
    const sma60Ok = valid60.every(v => isFiniteNum(v) && v > 0);
    results.push(
      assert(
        'SMA60: 모든 값 양수·유한',
        sma60Ok,
        sma60Ok ? '전부 정상' : `비정상: ${valid60.filter(v => !isFiniteNum(v) || v <= 0).length}개`,
        'finite && > 0',
      ),
    );
  } else {
    results.push(
      assert('SMA60: 가격 데이터 부족 — 건너뜀', true, 'N/A', 'N/A'),
    );
  }

  return results;
}

/* ─────────────────────────────────────────────
 * MACD 어설션 묶음
 * ───────────────────────────────────────────── */
function assertMACD(prices: number[]): AssertionResult[] {
  const results: AssertionResult[] = [];
  const macdArr = calculateMACD(prices, 12, 26, 9);
  const validPoints = macdArr.filter(p => p.macdLine !== null);

  // 1) 유효 포인트 존재
  results.push(
    assert(
      'MACD: 유효 포인트 존재',
      validPoints.length > 0,
      `${validPoints.length}개`,
      '1개 이상',
    ),
  );

  // 2) MACD 라인 — 유한
  const macdFinite = validPoints.every(p => isFiniteNum(p.macdLine!));
  results.push(
    assert(
      'MACD 라인: 모든 값 유한',
      macdFinite,
      macdFinite ? '전부 유한' : '비유한 값 존재',
      'Number.isFinite',
    ),
  );

  // 3) 히스토그램 = MACD − Signal (시그널 존재 시)
  const sigPoints = validPoints.filter(p => p.signalLine !== null && p.histogram !== null);
  if (sigPoints.length > 0) {
    const histOk = sigPoints.every(p => {
      const diff = Math.abs(p.macdLine! - p.signalLine! - p.histogram!);
      return diff < 0.001; // 부동소수점 오차 허용
    });
    results.push(
      assert(
        'MACD 히스토그램: MACD − Signal과 일치',
        histOk,
        histOk ? '일치' : '불일치 발생',
        '|macd − signal − hist| < 0.001',
      ),
    );
  }

  return results;
}

/* ─────────────────────────────────────────────
 * DCF 어설션 묶음
 * ───────────────────────────────────────────── */
function assertDCFCases(cases: DCFTestCase[]): AssertionResult[] {
  const results: AssertionResult[] = [];

  for (const tc of cases) {
    const dcf = calculateDCF(tc.params);
    const { fairValuePerShare: fv } = dcf;

    // ① NaN 방어
    results.push(
      assert(
        `DCF [${tc.label}]: NaN 아님`,
        !isNaN(fv),
        isNaN(fv) ? 'NaN' : `${fv.toFixed(4)}`,
        'not NaN',
      ),
    );

    // ② Infinity 방어
    results.push(
      assert(
        `DCF [${tc.label}]: Infinity 아님`,
        isFinite(fv),
        !isFinite(fv) ? (fv > 0 ? '+Infinity' : '-Infinity') : `${fv.toFixed(4)}`,
        'finite',
      ),
    );

    // ③ 양수 여부 (기대값에 따라 분기)
    if (tc.expectFinitePositive) {
      results.push(
        assert(
          `DCF [${tc.label}]: 양수 (>0)`,
          fv > 0,
          `${fv.toFixed(4)}`,
          '> 0',
        ),
      );
    } else {
      // FCF ≤ 0 허용 케이스 — 음수만 아니면 됨 (Math.max 클램핑으로 0 이상 보장)
      results.push(
        assert(
          `DCF [${tc.label}]: 음수 아님 (≥0 허용)`,
          fv >= 0,
          `${fv.toFixed(4)}`,
          '>= 0',
        ),
      );
    }

    // ④ pvFCFs 개수 확인 (forecastYears 기본 10)
    const years = tc.params.forecastYears ?? 10;
    results.push(
      assert(
        `DCF [${tc.label}]: pvFCFs 길이 = ${years}`,
        dcf.pvFCFs.length === years,
        `${dcf.pvFCFs.length}`,
        `${years}`,
      ),
    );
  }

  return results;
}

/* ─────────────────────────────────────────────
 * 시나리오별 특수 어설션
 * ───────────────────────────────────────────── */

/** ① 폭등/폭락 — 가격 범위 극단 검증 */
function assertSurgeCrash(prices: number[]): AssertionResult[] {
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const ratio = max / min;

  return [
    assert(
      'SurgeCrash: 최대/최소 가격 비율 > 5배 (극단 변동 확인)',
      ratio > 5,
      `${ratio.toFixed(1)}배`,
      '> 5배',
    ),
    assert(
      'SurgeCrash: 모든 가격 양수',
      prices.every(p => p > 0),
      prices.every(p => p > 0) ? '전부 양수' : '음수 존재',
      'all > 0',
    ),
  ];
}

/** ② 데이터 누락 — 정제 전후 카운트 검증 */
function assertMissingData(raw: (number | null)[], clean: number[]): AssertionResult[] {
  const nullCount   = raw.filter(v => v === null).length;
  const zeroCount   = raw.filter(v => v === 0).length;
  const negCount    = raw.filter(v => typeof v === 'number' && v < 0).length;
  const invalidTotal = nullCount + zeroCount + negCount;
  const expectedClean = raw.length - invalidTotal;

  return [
    assert(
      'MissingData: null·0·음수 존재 (약 26% 결측)',
      invalidTotal > 0,
      `${invalidTotal}개 비유효 (null:${nullCount}, 0:${zeroCount}, 음수:${negCount})`,
      '1개 이상 비유효값',
    ),
    assert(
      'MissingData: 정제 후 유효 가격 수 일치',
      clean.length === expectedClean,
      `${clean.length}개`,
      `${expectedClean}개`,
    ),
    assert(
      'MissingData: 정제 후 모든 값 양수·유한',
      clean.every(v => v > 0 && isFiniteNum(v)),
      clean.every(v => v > 0 && isFiniteNum(v)) ? '전부 정상' : '비정상 존재',
      'all > 0 && finite',
    ),
  ];
}

/** ③ 횡보 — RSI가 30~70 사이로 수렴하는지 */
function assertSideways(prices: number[]): AssertionResult[] {
  const BASE = prices[0];
  const maxDrift = Math.max(...prices.map(p => Math.abs(p / BASE - 1)));
  const rsiArr = calculateRSI(prices, 14);
  const validRSIs = rsiArr.filter((v): v is number => v !== null);
  const rsiInBand = validRSIs.every(v => v >= 30 && v <= 70);

  return [
    assert(
      'Sideways: 가격 변동폭 0.1% 이내 (횡보 확인)',
      maxDrift < 0.001,
      `최대 편차 ${(maxDrift * 100).toFixed(4)}%`,
      '< 0.1%',
    ),
    assert(
      'Sideways: RSI 전부 중립 대역 [30, 70]',
      rsiInBand,
      rsiInBand
        ? `전부 30–70 (${validRSIs.length}개)`
        : `이탈: ${validRSIs.filter(v => v < 30 || v > 70).map(v => v.toFixed(1)).join(', ')}`,
      '30 ≤ RSI ≤ 70',
    ),
  ];
}

/* ─────────────────────────────────────────────
 * 단일 시나리오 실행
 * ───────────────────────────────────────────── */
function runScenario(scenario: TestScenario): ScenarioTestResult {
  const startMs = performance.now();
  const allAssertions: AssertionResult[] = [];

  try {
    const { cleanPrices, rawPrices } = scenario;

    // ── 공통 기술지표 검증 ──────────────────────
    allAssertions.push(...assertRSI(cleanPrices));
    allAssertions.push(...assertSMA(cleanPrices));
    allAssertions.push(...assertMACD(cleanPrices));

    // ── DCF 경계 조건 검증 ─────────────────────
    allAssertions.push(...assertDCFCases(scenario.dcfTestCases));

    // ── 시나리오별 특수 검증 ───────────────────
    if (scenario.id === 'surge_crash') {
      allAssertions.push(...assertSurgeCrash(cleanPrices));
    } else if (scenario.id === 'missing_data') {
      allAssertions.push(...assertMissingData(rawPrices, cleanPrices));
    } else if (scenario.id === 'sideways') {
      allAssertions.push(...assertSideways(cleanPrices));
    }
  } catch (err) {
    allAssertions.push({
      name: '시나리오 실행 오류',
      passed: false,
      actual: String(err),
      expected: '정상 실행',
      error: String(err),
    });
  }

  const elapsedMs = performance.now() - startMs;
  const failedAssertions = allAssertions.filter(a => !a.passed);
  const passed = failedAssertions.length === 0;

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    passed,
    executionTime: `${elapsedMs.toFixed(1)}ms`,
    errorLog: failedAssertions.length > 0
      ? failedAssertions.map(a => a.error).filter(Boolean).join(' | ')
      : undefined,
    assertions: allAssertions,
    stats: {
      total:  allAssertions.length,
      passed: allAssertions.filter(a => a.passed).length,
      failed: failedAssertions.length,
    },
  };
}

/* ─────────────────────────────────────────────
 * 공개 API: 전체 하네스 실행
 * ───────────────────────────────────────────── */
export function runAllTests(): HarnessResult {
  const globalStart = performance.now();
  const scenarios = generateAllScenarios();
  const results = scenarios.map(runScenario);
  const globalElapsed = performance.now() - globalStart;

  return {
    results,
    totalPassed: results.filter(r => r.passed).length,
    totalFailed: results.filter(r => !r.passed).length,
    totalTime: `${globalElapsed.toFixed(1)}ms`,
  };
}
