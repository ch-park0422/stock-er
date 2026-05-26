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
