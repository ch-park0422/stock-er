/**
 * analysis.ts
 * 수학적·금융학적 분석 알고리즘 모음
 * DCF 모델 / SMA / RSI / MACD / AI 종합 점수
 */

/* ─────────────────────────────────────────────
 * 공통 타입
 * ───────────────────────────────────────────── */
export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DCFParams {
  /** 최근 연간 잉여현금흐름 (단위: 백만 달러) */
  fcf: number;
  /** 발행주식수 (단위: 백만 주) */
  shares: number;
  /** 순부채 = 부채 - 현금 (음수 = 순현금, 단위: 백만 달러) */
  netDebt: number;
  /** FCF 성장률 (예: 0.09 = 9%) */
  growthRate: number;
  /** 할인율 / WACC (예: 0.085 = 8.5%) */
  discountRate: number;
  /** 영구 성장률 (예: 0.03 = 3%) */
  terminalGrowthRate: number;
  /** 예측 기간 (년) */
  forecastYears?: number;
}

export interface DCFResult {
  /** 주당 적정 가치 (달러) */
  fairValuePerShare: number;
  /** 기업가치 (EV, 백만 달러) */
  enterpriseValue: number;
  /** FCF 현재가치 합계 (백만 달러) */
  pvOfFCFs: number;
  /** 터미널 밸류 현재가치 (백만 달러) */
  pvOfTerminalValue: number;
  /** 연도별 FCF 예측값 (백만 달러) */
  projectedFCFs: number[];
  /** 연도별 FCF 현재가치 (백만 달러) */
  pvFCFs: number[];
}

export type ValuationLabel = '저평가' | '적정' | '고평가';
export interface ValuationResult {
  label: ValuationLabel;
  upsidePct: number;   // 양수 = 저평가, 음수 = 고평가
  color: string;       // Tailwind text color class
  bgColor: string;
  borderColor: string;
}

export interface AIScoreBreakdown {
  category: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface AIScoreResult {
  score: number;          // 0–100
  grade: string;          // ★★★ 강력매수 등
  gradeColor: string;
  feedback: string;       // 한 줄 요약
  breakdown: AIScoreBreakdown[];
}

/* ─────────────────────────────────────────────
 * 1. DCF 적정 주가 계산
 *    Gordon Growth / 2-Stage DCF
 * ───────────────────────────────────────────── */
export function calculateDCF(params: DCFParams): DCFResult {
  const {
    fcf,
    shares,
    netDebt,
    growthRate,
    discountRate,
    terminalGrowthRate,
    forecastYears = 10,
  } = params;

  // 터미널 성장률은 반드시 할인율보다 작아야 함
  const safeTerminal = Math.min(terminalGrowthRate, discountRate - 0.001);

  const projectedFCFs: number[] = [];
  const pvFCFs: number[] = [];
  let runningFCF = fcf;
  let sumPV = 0;

  for (let yr = 1; yr <= forecastYears; yr++) {
    runningFCF = runningFCF * (1 + growthRate);
    const pv = runningFCF / Math.pow(1 + discountRate, yr);
    projectedFCFs.push(Math.round(runningFCF));
    pvFCFs.push(Math.round(pv));
    sumPV += pv;
  }

  // 터미널 밸류 (고든 성장 모델)
  const terminalFCF = runningFCF * (1 + safeTerminal);
  const terminalValue = terminalFCF / (discountRate - safeTerminal);
  const pvTV = terminalValue / Math.pow(1 + discountRate, forecastYears);

  const enterpriseValue = sumPV + pvTV;

  // 자기자본 가치 = EV − 순부채 (순현금이면 netDebt < 0 → 가치 증가)
  const equityValue = enterpriseValue - netDebt;

  // 주당 가치 (EV·주식수 모두 백만 단위 → 달러)
  const fairValuePerShare = equityValue / shares;

  return {
    fairValuePerShare: Math.max(fairValuePerShare, 0),
    enterpriseValue,
    pvOfFCFs: sumPV,
    pvOfTerminalValue: pvTV,
    projectedFCFs,
    pvFCFs,
  };
}

/* ─────────────────────────────────────────────
 * 1b. 하이브리드 가치평가 (DCF 우선 → EPS-PER 폴백)
 * ───────────────────────────────────────────── */

/**
 * 가치평가에 실제로 적용된 모델
 * - 'dcf'         : 현금흐름할인 모델
 * - 'eps'         : EPS × 목표PER 모델 (DCF 데이터 부족 시 폴백)
 * - 'unavailable' : FCF·EPS 모두 미제공 → 적정가 산출 불가
 */
export type ValuationModel = 'dcf' | 'eps' | 'unavailable';

/** calculateHybridValuation 반환 타입 */
export interface HybridValuationResult extends DCFResult {
  /** 사용된 평가 모델 */
  model: ValuationModel;
  /** EPS 모델 적용 시: 사용된 주당 순이익 */
  trailingEpsUsed?: number;
  /** EPS 모델 적용 시: 적용된 목표 PER 배수 */
  targetPerUsed?: number;
}

/** calculateHybridValuation 입력 타입 */
export interface HybridValuationParams extends DCFParams {
  /** 현재 주가 — DCF 합리성 검증 기준 */
  currentPrice: number;
  /** 주당 순이익 (EPS-PER 폴백용) */
  trailingEps?: number;
  /** 목표 PER 배수 (기본 12.5) */
  targetPer?: number;
}

/**
 * 하이브리드 가치평가 엔진
 *
 * ① DCF: fcf > 0 이고 결과가 현재가의 20% 이상 → DCF 결과 반환
 * ② EPS-PER: DCF 부적합·데이터 없음 + trailingEps 유효 → EPS×PER 반환
 * ③ 최후 폴백: 두 경우 모두 해당 없으면 DCF 결과 그대로 반환
 */
export function calculateHybridValuation(
  params: HybridValuationParams,
): HybridValuationResult {
  const { currentPrice, trailingEps, targetPer = 12.5, ...dcfParams } = params;

  // 0 이하 현재가 방어 (한국 주식 단위 등 엣지 케이스)
  const safePrice = currentPrice > 0 ? currentPrice : 1;

  // DCF 가능 여부: fcf·shares 양수 & finite 값
  const hasDcfData =
    dcfParams.fcf > 0 &&
    dcfParams.shares > 0 &&
    isFinite(dcfParams.fcf) &&
    isFinite(dcfParams.shares);

  if (hasDcfData) {
    const dcfResult = calculateDCF(dcfParams);
    const fv = dcfResult.fairValuePerShare;
    // 현재가의 20% 이상이면 합리적인 DCF 결과로 간주
    const isReasonable =
      isFinite(fv) &&
      !isNaN(fv) &&
      fv >= safePrice * 0.20;
    if (isReasonable) {
      return { ...dcfResult, model: 'dcf' };
    }
  }

  // EPS-PER 폴백
  if (trailingEps != null && !isNaN(trailingEps) && trailingEps > 0) {
    const epsFairValue = trailingEps * targetPer;
    if (epsFairValue > 0 && isFinite(epsFairValue)) {
      return {
        fairValuePerShare: epsFairValue,
        enterpriseValue:   epsFairValue * Math.max(dcfParams.shares, 1),
        pvOfFCFs:          0,
        pvOfTerminalValue: 0,
        projectedFCFs:     [],
        pvFCFs:            [],
        model:             'eps',
        trailingEpsUsed:   trailingEps,
        targetPerUsed:     targetPer,
      };
    }
  }

  // 최후 폴백: FCF·EPS 모두 미제공 → 'unavailable' 반환
  // currentPrice를 fairValuePerShare로 사용해 AI 점수 DCF 항목을 중립으로 처리
  return {
    fairValuePerShare: safePrice,   // 중립 (현재가 = 적정가로 간주)
    enterpriseValue:   safePrice * Math.max(dcfParams.shares, 1),
    pvOfFCFs:          0,
    pvOfTerminalValue: 0,
    projectedFCFs:     [],
    pvFCFs:            [],
    model:             'unavailable',
  };
}

/* ─────────────────────────────────────────────
 * 2. 밸류에이션 레이블 반환
 * ───────────────────────────────────────────── */
export function getValuationLabel(
  fairValue: number,
  currentPrice: number,
): ValuationResult {
  const upsidePct = ((fairValue - currentPrice) / currentPrice) * 100;

  if (upsidePct > 5) {
    return {
      label: '저평가',
      upsidePct,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    };
  }
  if (upsidePct < -5) {
    return {
      label: '고평가',
      upsidePct,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
    };
  }
  return {
    label: '적정',
    upsidePct,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  };
}

/* ─────────────────────────────────────────────
 * 3. 단순 이동평균 (SMA)
 * ───────────────────────────────────────────── */
export function calculateSMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / period;
    return Math.round(avg * 100) / 100;
  });
}

/* ─────────────────────────────────────────────
 * 4. RSI (Relative Strength Index)
 *    Wilder 스무딩 방식
 * ───────────────────────────────────────────── */
export function calculateRSI(prices: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = Array(prices.length).fill(null);
  if (prices.length < period + 1) return result;

  // 초기 평균 이득/손실 (단순 평균)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const computeRSI = (ag: number, al: number) =>
    al === 0 ? 100 : Math.round((100 - 100 / (1 + ag / al)) * 100) / 100;

  result[period] = computeRSI(avgGain, avgLoss);

  // Wilder 지수이동평균
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = computeRSI(avgGain, avgLoss);
  }
  return result;
}

/* ─────────────────────────────────────────────
 * 5. MACD (Moving Average Convergence Divergence)
 * ───────────────────────────────────────────── */
function ema(arr: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out = [arr[0]];
  for (let i = 1; i < arr.length; i++) {
    out.push(arr[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export interface MACDPoint {
  macdLine: number | null;
  signalLine: number | null;
  histogram: number | null;
}

export function calculateMACD(
  prices: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): MACDPoint[] {
  const ema12 = ema(prices, fast);
  const ema26 = ema(prices, slow);
  const macdArr = ema12.map((v, i) => v - ema26[i]);
  const sigArr  = ema(macdArr.slice(slow - 1), signal);

  return prices.map((_, i) => {
    if (i < slow - 1) return { macdLine: null, signalLine: null, histogram: null };
    const mv = Math.round(macdArr[i] * 10000) / 10000;
    const si  = i - (slow - 1);
    const sv  = si < signal - 1 ? null : Math.round(sigArr[si] * 10000) / 10000;
    return {
      macdLine: mv,
      signalLine: sv,
      histogram: sv !== null ? Math.round((mv - sv) * 10000) / 10000 : null,
    };
  });
}

/* ─────────────────────────────────────────────
 * 6. 골든크로스 / 데드크로스 감지
 * ───────────────────────────────────────────── */
export type CrossSignal = 'golden' | 'dead' | 'uptrend' | 'downtrend' | 'neutral';

export function detectMACross(
  sma20: (number | null)[],
  sma60: (number | null)[],
  lookback = 5,
): CrossSignal {
  const n = sma20.length;
  const recent20 = sma20.slice(n - lookback).filter((v): v is number => v !== null);
  const recent60 = sma60.slice(n - lookback).filter((v): v is number => v !== null);
  if (recent20.length < 2 || recent60.length < 2) return 'neutral';

  const cur20 = recent20.at(-1)!;
  const cur60 = recent60.at(-1)!;
  const prev20 = recent20[0];
  const prev60 = recent60[0];

  const crossedAbove = prev20 <= prev60 && cur20 > cur60;
  const crossedBelow = prev20 >= prev60 && cur20 < cur60;

  if (crossedAbove) return 'golden';
  if (crossedBelow) return 'dead';
  if (cur20 > cur60) return 'uptrend';
  if (cur20 < cur60) return 'downtrend';
  return 'neutral';
}

/* ─────────────────────────────────────────────
 * 7. AI 종합 투자 매력도 점수 (100점 만점)
 *
 *  [30점] DCF 저평가 여부
 *  [25점] RSI 구간
 *  [25점] 이동평균 추세
 *  [20점] 밸류에이션 지표 (PER/PBR vs 업종 평균)
 * ───────────────────────────────────────────── */
export interface AIScoreInput {
  currentPrice: number;
  dcfFairValue: number;
  rsi: number | null;
  crossSignal: CrossSignal;
  per: number;
  industryPer: number;
  pbr: number;
  industryPbr: number;
}

export function calculateAIScore(input: AIScoreInput): AIScoreResult {
  const { currentPrice, dcfFairValue, rsi, crossSignal, per, industryPer, pbr, industryPbr } = input;
  const breakdown: AIScoreBreakdown[] = [];

  /* ① DCF 점수 (30점) */
  const upsidePct = ((dcfFairValue - currentPrice) / currentPrice) * 100;
  let dcfScore: number;
  let dcfReason: string;
  if (upsidePct > 20) { dcfScore = 30; dcfReason = `DCF 대비 ${upsidePct.toFixed(1)}% 저평가 — 강한 안전마진 확보`; }
  else if (upsidePct > 5) { dcfScore = 22; dcfReason = `DCF 대비 ${upsidePct.toFixed(1)}% 저평가 — 매력적 진입 구간`; }
  else if (upsidePct >= -5) { dcfScore = 15; dcfReason = `DCF 기준 적정가 수준 (±5% 내외)`; }
  else if (upsidePct >= -20) { dcfScore = 8; dcfReason = `DCF 대비 ${Math.abs(upsidePct).toFixed(1)}% 고평가 — 주의 필요`; }
  else { dcfScore = 0; dcfReason = `DCF 대비 ${Math.abs(upsidePct).toFixed(1)}% 고평가 — 펀더멘탈 위험 구간`; }
  breakdown.push({ category: 'DCF 내재가치', points: dcfScore, maxPoints: 30, reason: dcfReason });

  /* ② RSI 점수 (25점) */
  let rsiScore: number;
  let rsiReason: string;
  const rsiVal = rsi ?? 50;
  if (rsiVal <= 30) { rsiScore = 25; rsiReason = `RSI ${rsiVal} — 과매도 구간, 반등 매수 기회`; }
  else if (rsiVal <= 45) { rsiScore = 20; rsiReason = `RSI ${rsiVal} — 저점 회복 중, 매수 유리`; }
  else if (rsiVal <= 55) { rsiScore = 15; rsiReason = `RSI ${rsiVal} — 중립 구간, 방향성 대기`; }
  else if (rsiVal <= 70) { rsiScore = 8;  rsiReason = `RSI ${rsiVal} — 과열 접근, 추격 매수 주의`; }
  else { rsiScore = 0; rsiReason = `RSI ${rsiVal} — 과매수 구간, 단기 조정 가능성 높음`; }
  breakdown.push({ category: 'RSI 모멘텀', points: rsiScore, maxPoints: 25, reason: rsiReason });

  /* ③ 이동평균 추세 점수 (25점) */
  const crossScores: Record<CrossSignal, number> = {
    golden: 25, uptrend: 18, neutral: 12, downtrend: 5, dead: 0,
  };
  const crossLabels: Record<CrossSignal, string> = {
    golden:    '골든크로스 발생 — 강력한 상승 전환 시그널',
    uptrend:   'MA20 > MA60 정배열 유지 — 중장기 상승 추세',
    neutral:   'MA20 ≈ MA60 횡보 — 추세 형성 대기 중',
    downtrend: 'MA20 < MA60 역배열 — 하락 추세 진행 중',
    dead:      '데드크로스 발생 — 강한 하락 전환 시그널',
  };
  const maScore = crossScores[crossSignal];
  breakdown.push({ category: 'MA 추세', points: maScore, maxPoints: 25, reason: crossLabels[crossSignal] });

  /* ④ 밸류에이션 지표 점수 (20점) */
  const perOk = per < industryPer;
  const pbrOk = pbr < industryPbr;
  let valScore: number;
  let valReason: string;
  if (perOk && pbrOk) {
    valScore = 20;
    valReason = `PER·PBR 모두 업종 평균 하회 — 상대적 저평가`;
  } else if (perOk || pbrOk) {
    valScore = 12;
    valReason = `PER·PBR 중 하나만 업종 평균 하회 — 부분 저평가`;
  } else {
    valScore = 5;
    valReason = `PER·PBR 모두 업종 평균 초과 — 프리미엄 밸류에이션`;
  }
  breakdown.push({ category: '상대 밸류에이션', points: valScore, maxPoints: 20, reason: valReason });

  /* 종합 */
  const score = dcfScore + rsiScore + maScore + valScore;

  let grade: string;
  let gradeColor: string;
  let feedback: string;

  if (score >= 80) {
    grade = '★★★ 강력 매수';
    gradeColor = 'text-emerald-400';
    feedback = '펀더멘탈·기술적 지표 모두 매수 우호적. 분할 매수 적극 검토 구간.';
  } else if (score >= 65) {
    grade = '★★ 매수';
    gradeColor = 'text-emerald-300';
    feedback = '대부분의 지표가 긍정적. 리스크 관리 하에 매수 접근 권장.';
  } else if (score >= 45) {
    grade = '★ 중립';
    gradeColor = 'text-amber-400';
    feedback = '지표 혼조세. 방향성 확인 후 포지션 결정 권장.';
  } else if (score >= 30) {
    grade = '⚠ 매도';
    gradeColor = 'text-rose-300';
    feedback = '복수 지표에서 약세 신호. 보유 비중 축소 검토.';
  } else {
    grade = '⛔ 강력 매도';
    gradeColor = 'text-rose-500';
    feedback = '펀더멘탈·기술적 지표 모두 취약. 손절 또는 회피 권장.';
  }

  return { score, grade, gradeColor, feedback, breakdown };
}

/* ─────────────────────────────────────────────
 * 8. PEG 비율 분석 (피터 린치)
 *    PEG = PER ÷ 이익성장률(%)
 * ───────────────────────────────────────────── */
export type PegTier = 'strong_buy' | 'buy' | 'fair' | 'overvalued' | 'unavailable';

export interface PegResult {
  /** PEG 비율 */
  peg: number;
  /** 계산에 필요한 데이터 존재 여부 */
  hasData: boolean;
  /** 구간 */
  tier: PegTier;
  /** Tailwind text color class */
  color: string;
  /** Tailwind bg color class */
  bgColor: string;
  /** 게이지 바 너비 % (PEG 0 → 0%, PEG 2+ → 100%) */
  barPct: number;
}

/**
 * PEG(주가수익성장비율) 분석
 *
 * @param per             P/E 비율 (예: 20)
 * @param earningsGrowth  이익성장률 소수 (예: 0.20 = 20%). 미제공 시 undefined.
 * @param yfPegRatio      Yahoo Finance 사전 계산 PEG (우선 사용)
 */
export function calculatePegScore(
  per: number,
  earningsGrowth?: number,
  yfPegRatio?: number,
): PegResult {
  let peg = 0;
  let hasData = false;

  if (yfPegRatio != null && isFinite(yfPegRatio) && yfPegRatio > 0) {
    peg = yfPegRatio;
    hasData = true;
  } else if (earningsGrowth != null && earningsGrowth > 0 && per > 0) {
    peg = per / (earningsGrowth * 100);
    hasData = true;
  }

  if (!hasData) {
    return { peg: 0, hasData: false, tier: 'unavailable',
      color: 'text-gray-500', bgColor: 'bg-gray-500/10', barPct: 0 };
  }

  const tier: PegTier =
    peg <= 0.5 ? 'strong_buy' :
    peg <= 1.0 ? 'buy' :
    peg <= 1.5 ? 'fair' : 'overvalued';

  const color =
    tier === 'strong_buy' ? 'text-emerald-400' :
    tier === 'buy'        ? 'text-green-400' :
    tier === 'fair'       ? 'text-amber-400' : 'text-rose-400';

  const bgColor =
    tier === 'strong_buy' ? 'bg-emerald-500/10' :
    tier === 'buy'        ? 'bg-green-500/10' :
    tier === 'fair'       ? 'bg-amber-500/10' : 'bg-rose-500/10';

  return {
    peg: Math.round(peg * 100) / 100,
    hasData,
    tier,
    color,
    bgColor,
    barPct: Math.min((peg / 2.0) * 100, 100),
  };
}

/* ─────────────────────────────────────────────
 * 9. 피오트로스키 F-스코어 (0–9점)
 *    재무건전성 9개 기준 체크리스트
 * ───────────────────────────────────────────── */
export type PiotroskiCategory = 'profitability' | 'leverage' | 'efficiency';

export interface PiotroskiCriterion {
  /** i18n 번역 키 */
  id: string;
  /** 기준 카테고리 */
  category: PiotroskiCategory;
  /** 통과 여부 */
  passed: boolean;
  /** 실제 수치 문자열 (언어 중립) */
  valueStr: string;
  /** 충분한 데이터 여부 (false면 대체 기준 사용) */
  hasData: boolean;
}

export interface PiotroskiResult {
  score: number;                   // 0–9
  criteria: PiotroskiCriterion[];
  tier: 'strong' | 'moderate' | 'weak';
  color: string;
  bgColor: string;
}

export interface PiotroskiInput {
  returnOnAssets?: number;      // 소수 (0.05 = 5%)
  operatingCashflow?: number;   // 백만 단위
  netIncome?: number;           // 백만 단위
  fcf: number;                  // 백만 단위 (기존 필드)
  grossMargin: number;          // % (30 = 30%)
  debtToEquity: number;         // 소수 (0.5 = 50%)
  currentRatio: number;
  operatingMargin: number;      // %
  roe: number;                  // %
  netMargin: number;            // %
}

/**
 * 피오트로스키 F-스코어 (가용 데이터 기반 실용적 버전)
 *
 * [수익성 — 4점]
 *   F1: ROA > 0
 *   F2: 영업현금흐름 > 0
 *   F3: 영업현금흐름 > 순이익 (이익 품질)
 *   F4: 매출총이익률 ≥ 20%
 *
 * [재무건전성 — 3점]
 *   F5: D/E ≤ 1.0
 *   F6: 유동비율 ≥ 1.5
 *   F7: 영업이익률 > 0%
 *
 * [운영효율 — 2점]
 *   F8: ROE ≥ 10%
 *   F9: 순이익률 ≥ 5%
 */
export function calculatePiotroski(input: PiotroskiInput): PiotroskiResult {
  const {
    returnOnAssets, operatingCashflow, netIncome, fcf,
    grossMargin, debtToEquity, currentRatio,
    operatingMargin, roe, netMargin,
  } = input;

  const criteria: PiotroskiCriterion[] = [
    /* ── 수익성 ── */
    {
      id: 'roa_positive',
      category: 'profitability',
      passed:   returnOnAssets != null ? returnOnAssets > 0 : netMargin > 0,
      valueStr: returnOnAssets != null
        ? `ROA ${(returnOnAssets * 100).toFixed(1)}%`
        : `NM ${netMargin.toFixed(1)}%`,
      hasData: returnOnAssets != null,
    },
    {
      id: 'ocf_positive',
      category: 'profitability',
      passed:   operatingCashflow != null ? operatingCashflow > 0 : fcf > 0,
      valueStr: operatingCashflow != null
        ? `OCF ${operatingCashflow.toFixed(0)}M`
        : `FCF ${fcf.toFixed(0)}M`,
      hasData: operatingCashflow != null,
    },
    {
      id: 'accrual',
      category: 'profitability',
      passed:   (operatingCashflow != null && netIncome != null)
        ? operatingCashflow > netIncome
        : fcf > 0,
      valueStr: (operatingCashflow != null && netIncome != null)
        ? `OCF ${operatingCashflow >= netIncome ? '>' : '<'} NI`
        : `FCF ${fcf > 0 ? '>0' : '≤0'}`,
      hasData: operatingCashflow != null && netIncome != null,
    },
    {
      id: 'gross_margin',
      category: 'profitability',
      passed:   grossMargin >= 20,
      valueStr: `GM ${grossMargin.toFixed(1)}%`,
      hasData: true,
    },
    /* ── 재무건전성 ── */
    {
      id: 'low_leverage',
      category: 'leverage',
      passed:   debtToEquity <= 1.0,
      valueStr: `D/E ${debtToEquity.toFixed(2)}`,
      hasData: true,
    },
    {
      id: 'liquidity',
      category: 'leverage',
      passed:   currentRatio >= 1.5,
      valueStr: `CR ${currentRatio.toFixed(2)}`,
      hasData: true,
    },
    {
      id: 'operating_positive',
      category: 'leverage',
      passed:   operatingMargin > 0,
      valueStr: `OM ${operatingMargin.toFixed(1)}%`,
      hasData: true,
    },
    /* ── 운영효율 ── */
    {
      id: 'roe_strong',
      category: 'efficiency',
      passed:   roe >= 10,
      valueStr: `ROE ${roe.toFixed(1)}%`,
      hasData: true,
    },
    {
      id: 'net_margin',
      category: 'efficiency',
      passed:   netMargin >= 5,
      valueStr: `NM ${netMargin.toFixed(1)}%`,
      hasData: true,
    },
  ];

  const score  = criteria.filter(c => c.passed).length;
  const tier   = score >= 7 ? 'strong' : score >= 4 ? 'moderate' : 'weak';
  const color   = tier === 'strong' ? 'text-emerald-400' : tier === 'moderate' ? 'text-amber-400' : 'text-rose-400';
  const bgColor = tier === 'strong' ? 'bg-emerald-500/10' : tier === 'moderate' ? 'bg-amber-500/10' : 'bg-rose-500/10';

  return { score, criteria, tier, color, bgColor };
}

/* ─────────────────────────────────────────────
 * 10. 그린블라트 마법 공식
 *     이익수익률(EY) + 자본수익률(ROC) 복합 평가
 * ───────────────────────────────────────────── */
export type MagicTier = 'high' | 'medium' | 'low';

export interface MagicFormulaResult {
  /** 이익수익률 % (예: 8.5) */
  earningsYield: number;
  /** 자본수익률 % (예: 22.4) */
  roc: number;
  /** EY 구간 */
  eyTier: MagicTier;
  /** ROC 구간 */
  rocTier: MagicTier;
  /** 복합 점수 2–6 */
  compositeScore: number;
  /** 종합 투자 매력도 */
  attractiveness: MagicTier;
  /** Tailwind text color class */
  color: string;
  /** Tailwind bg color class */
  bgColor: string;
  /** 계산에 필요한 데이터 존재 여부 */
  hasData: boolean;
}

/**
 * 그린블라트 마법 공식 (근사치)
 *
 * - 이익수익률 = 1 / EV·EBITDA (EBITDA 기반 EV 수익률); PER 폴백
 * - 자본수익률 = ROE × 0.7 + 영업이익률 × 0.3 (가중 평균 근사)
 *
 * 원본(EBIT/EV, EBIT/InvestedCapital)과 완전히 동일하지 않으나
 * 가용 데이터 범위 내 최선 근사치를 사용합니다.
 */
export function calculateMagicFormula(
  evEbitda: number,
  per: number,
  roe: number,
  operatingMargin: number,
): MagicFormulaResult {
  let earningsYield = 0;
  let hasData = false;

  if (evEbitda > 0 && isFinite(evEbitda)) {
    earningsYield = (1 / evEbitda) * 100;
    hasData = true;
  } else if (per > 0 && isFinite(per)) {
    earningsYield = (1 / per) * 100;
    hasData = true;
  }

  // ROC: ROE 70% + 영업이익률 30% 가중 평균
  const roc = Math.max(roe, 0) * 0.7 + Math.max(operatingMargin, 0) * 0.3;

  const eyTier:  MagicTier = earningsYield >= 12 ? 'high' : earningsYield >= 6 ? 'medium' : 'low';
  const rocTier: MagicTier = roc >= 20            ? 'high' : roc >= 10          ? 'medium' : 'low';

  const eyScore  = eyTier  === 'high' ? 3 : eyTier  === 'medium' ? 2 : 1;
  const rocScore = rocTier === 'high' ? 3 : rocTier === 'medium' ? 2 : 1;
  const compositeScore = eyScore + rocScore;

  const attractiveness: MagicTier =
    compositeScore >= 5 ? 'high' :
    compositeScore >= 3 ? 'medium' : 'low';

  const color   = attractiveness === 'high' ? 'text-emerald-400'
                : attractiveness === 'medium' ? 'text-amber-400' : 'text-rose-400';
  const bgColor = attractiveness === 'high' ? 'bg-emerald-500/10'
                : attractiveness === 'medium' ? 'bg-amber-500/10' : 'bg-rose-500/10';

  return {
    earningsYield: Math.round(earningsYield * 10) / 10,
    roc:           Math.round(roc * 10) / 10,
    eyTier,
    rocTier,
    compositeScore,
    attractiveness,
    color,
    bgColor,
    hasData,
  };
}

/* ══════════════════════════════════════════════════════════════
 * QUANT ENGINE — 시장 국면 감지 · 동적 가중치 · 백테스팅
 * ══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
 * 11. 시장 국면 감지 (Market Regime Detector)
 *
 * 알고리즘:
 *   ① SMA50 기울기 = (SMA50_현재 - SMA50_10거래일전) / SMA50_10거래일전
 *   ② 20일 변동성 = 일간수익률 표준편차
 *   ③ Bull    : 기울기 > +1.5%  AND  종가 > SMA50  AND  변동성 ≤ 2.5%
 *      Bear    : 기울기 < -1.5%  AND  종가 < SMA50
 *      Sideways: 그 외 (기울기 불명확 또는 고변동성)
 * ───────────────────────────────────────────── */
export type MarketRegime = 'bull' | 'bear' | 'sideways';

/**
 * 국면별 최적 가중치 (재무건전성 / 성장성 / 기술적)
 * - Bear    : 재무건전성 60% / 성장성 20% / 기술 20%  → 생존력 우선
 * - Bull    : 성장성 50%    / 기술 35%   / 재무 15%  → 모멘텀 우선
 * - Sideways: 1/3 균등 배분
 */
export interface RegimeWeights {
  financial: number;   // Piotroski
  growth:    number;   // PEG / Peter Lynch
  technical: number;   // RSI + MA
}

const REGIME_WEIGHTS: Record<MarketRegime, RegimeWeights> = {
  bear:     { financial: 0.60, growth: 0.20, technical: 0.20 },
  bull:     { financial: 0.15, growth: 0.50, technical: 0.35 },
  sideways: { financial: 0.33, growth: 0.33, technical: 0.34 },
};

export function detectMarketRegime(prices: number[]): MarketRegime {
  const n = prices.length;
  if (n < 60) return 'sideways';

  // SMA50 현재 vs 10거래일 전
  const sma50Now = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const sma50Ago = prices.slice(n - 60, n - 10).reduce((a, b) => a + b, 0) / 50;
  const slope    = sma50Ago > 0 ? (sma50Now - sma50Ago) / sma50Ago : 0;

  // 20일 변동성 (일간수익률 표준편차)
  const last21   = prices.slice(-21);
  const returns  = last21.slice(1).map((p, i) => last21[i] > 0 ? (p - last21[i]) / last21[i] : 0);
  const meanRet  = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / returns.length;
  const vol      = Math.sqrt(variance);

  const priceAboveSMA = prices[n - 1] > sma50Now;

  if (vol > 0.025)                         return 'sideways'; // 고변동성 → 전환기
  if (slope > 0.015 && priceAboveSMA)      return 'bull';
  if (slope < -0.015 && !priceAboveSMA)    return 'bear';
  return 'sideways';
}

/* ─────────────────────────────────────────────
 * 12. 동적 가중치 스코어링
 *     시장 국면에 따라 재무/성장/기술 가중치를 다르게 적용
 * ───────────────────────────────────────────── */
export type DynamicGrade = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';

export interface DynamicScoreResult {
  /** 국면 조정 종합 점수 0–100 */
  total:         number;
  grade:         DynamicGrade;
  gradeColor:    string;
  regime:        MarketRegime;
  weights:       RegimeWeights;
  /** 개별 컴포넌트 점수 0–100 */
  financialScore: number;
  growthScore:    number;
  techScore:      number;
}

export interface DynamicScoreInput {
  /** calculatePiotroski 원시 F-Score 0–9 */
  piotroskiRaw: number;
  /** calculatePegScore 결과 */
  pegResult: PegResult;
  /** 최신 RSI (null 허용) */
  rsi: number | null;
  /** MA 교차 신호 */
  crossSignal: CrossSignal;
  /** 전체 종가 배열 (detectMarketRegime 용) */
  allPrices: number[];
}

/** PEG 티어 → 0–100 성장성 점수 정규화 */
function normalizePegToScore(pegResult: PegResult): number {
  if (!pegResult.hasData) return 50;
  switch (pegResult.tier) {
    case 'strong_buy':  return 100;
    case 'buy':         return 75;
    case 'fair':        return 50;
    case 'overvalued':  return 20;
    default:            return 50;
  }
}

/** RSI + MA 교차 → 0–100 기술적 점수 */
function calcTechScore(rsi: number | null, crossSignal: CrossSignal): number {
  // RSI 기여 (0–50점): 과매도일수록 고점
  const rsiVal = rsi ?? 50;
  const rsiPts =
    rsiVal <= 30 ? 50 :
    rsiVal <= 40 ? 38 :
    rsiVal <= 50 ? 28 :
    rsiVal <= 60 ? 18 :
    rsiVal <= 70 ? 8  : 0;

  // MA 교차 기여 (0–50점)
  const maPts: Record<CrossSignal, number> = {
    golden: 50, uptrend: 38, neutral: 24, downtrend: 10, dead: 0,
  };

  return Math.min(100, rsiPts + maPts[crossSignal]);
}

/**
 * 동적 가중치 스코어링 엔진
 *
 *   Bear  → 재무건전성(Piotroski) 60%, 성장성(PEG) 20%, 기술 20%
 *   Bull  → 성장성(PEG) 50%, 기술(RSI+MA) 35%, 재무건전성 15%
 *   Side  → 균등 33%씩
 */
export function calcDynamicWeightedScore(input: DynamicScoreInput): DynamicScoreResult {
  const { piotroskiRaw, pegResult, rsi, crossSignal, allPrices } = input;

  const regime  = detectMarketRegime(allPrices);
  const weights = REGIME_WEIGHTS[regime];

  const financialScore = Math.min(100, Math.max(0, (piotroskiRaw / 9) * 100));
  const growthScore    = normalizePegToScore(pegResult);
  const techScore      = calcTechScore(rsi, crossSignal);

  const total = Math.round(
    financialScore * weights.financial +
    growthScore    * weights.growth    +
    techScore      * weights.technical,
  );

  const grade: DynamicGrade =
    total >= 80 ? 'strong_buy' :
    total >= 65 ? 'buy' :
    total >= 45 ? 'neutral' :
    total >= 30 ? 'sell' : 'strong_sell';

  const gradeColor =
    grade === 'strong_buy' ? 'text-emerald-400' :
    grade === 'buy'        ? 'text-green-400'   :
    grade === 'neutral'    ? 'text-amber-400'   :
    grade === 'sell'       ? 'text-orange-400'  : 'text-rose-500';

  return { total, grade, gradeColor, regime, weights, financialScore, growthScore, techScore };
}

/* ─────────────────────────────────────────────
 * 13. 백테스팅 엔진 (90일 가상 시뮬레이션)
 *
 * 알고리즘:
 *   ① chartRows[n−90 .. n−31] 구간(시그널 탐색 윈도우)을 순회
 *   ② 각 시점에서 동적 스코어 계산 → ≥ 60점이면 '매수 시그널' 기록
 *   ③ 각 시그널로부터 30 거래일 후 종가 비교 → 수익이면 '적중'
 *   ④ 적중률 = 적중 수 / 전체 시그널 수 × 100
 *
 * 주의: 기업 펀더멘탈(Piotroski, PEG)은 과거·현재 동일 값 사용.
 *       연간 재무 데이터의 느린 변화를 반영한 현실적 근사값입니다.
 * ───────────────────────────────────────────── */

/** 백테스팅 엔진이 필요로 하는 차트 행 최소 인터페이스
 *  (mockData.ts ChartRow의 순환 참조를 피하기 위해 로컬 덕타입 정의)
 */
interface BacktestBar {
  close:  number;
  rsi:    number | null;
  sma20:  number | null;
  sma60:  number | null;
}

export interface BacktestResult {
  /** 예측 적중률 % (0–100) */
  hitRate:         number;
  /** 탐색 윈도우 내 시그널 총 횟수 */
  totalSignals:    number;
  /** 그 중 수익 발생 횟수 (적중) */
  correctSignals:  number;
  /** 시그널 발동 후 평균 수익률 % */
  avgReturnPct:    number;
  /** 현재 시장 국면 */
  regime:          MarketRegime;
  /** 실제 사용한 회고 기간 (거래일) */
  lookbackDays:    number;
}

export interface BacktestInput {
  chartRows:    BacktestBar[];
  allPrices:    number[];
  piotroskiRaw: number;      // 0–9
  pegResult:    PegResult;
}

export function runBacktest(input: BacktestInput): BacktestResult {
  const { chartRows, allPrices, piotroskiRaw, pegResult } = input;

  const n             = chartRows.length;
  const HOLDING       = 30;                             // 보유 기간 (거래일)
  const LOOKBACK      = Math.min(90, n);
  const signalStart   = Math.max(0, n - LOOKBACK);
  const signalEnd     = Math.max(0, n - HOLDING - 1);  // 미래 데이터 확보용

  const signals: Array<{ idx: number; entryPrice: number }> = [];

  for (let i = signalStart; i <= signalEnd; i++) {
    const row  = chartRows[i];
    const prev = chartRows[i - 1];

    // MA 추세 판단 (pre-calculated SMA20/SMA60 직접 활용)
    const sma20 = row.sma20  ?? 0;
    const sma60 = row.sma60  ?? 0;
    const pSma20 = prev?.sma20 ?? sma20;
    const pSma60 = prev?.sma60 ?? sma60;

    let cross: CrossSignal = 'neutral';
    if      (pSma20 <= pSma60 && sma20 > sma60) cross = 'golden';
    else if (pSma20 >= pSma60 && sma20 < sma60) cross = 'dead';
    else if (sma20 > sma60)                      cross = 'uptrend';
    else if (sma20 < sma60)                      cross = 'downtrend';

    // 해당 시점까지의 종가로 국면 감지
    const pricesUpTo = allPrices.slice(0, i + 1);
    const regime     = detectMarketRegime(pricesUpTo);
    const weights    = REGIME_WEIGHTS[regime];

    const fScore = Math.min(100, (piotroskiRaw / 9) * 100);
    const gScore = normalizePegToScore(pegResult);
    const tScore = calcTechScore(row.rsi, cross);

    const dynScore = Math.round(
      fScore * weights.financial +
      gScore * weights.growth    +
      tScore * weights.technical,
    );

    if (dynScore >= 60) {
      signals.push({ idx: i, entryPrice: row.close });
    }
  }

  if (signals.length === 0) {
    return {
      hitRate: 50.0, totalSignals: 0, correctSignals: 0,
      avgReturnPct: 0, regime: detectMarketRegime(allPrices), lookbackDays: LOOKBACK,
    };
  }

  let hits = 0;
  let totalRet = 0;

  for (const sig of signals) {
    const exitIdx   = Math.min(sig.idx + HOLDING, n - 1);
    const exitPrice = chartRows[exitIdx].close;
    const ret       = sig.entryPrice > 0 ? (exitPrice - sig.entryPrice) / sig.entryPrice : 0;
    if (exitPrice > sig.entryPrice) hits++;
    totalRet += ret;
  }

  return {
    hitRate:        Math.round((hits / signals.length) * 1000) / 10,   // 소수점 1자리
    totalSignals:   signals.length,
    correctSignals: hits,
    avgReturnPct:   Math.round((totalRet / signals.length) * 1000) / 10,
    regime:         detectMarketRegime(allPrices),
    lookbackDays:   LOOKBACK,
  };
}
