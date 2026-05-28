'use client';

/**
 * app/page.tsx
 * 메인 대시보드 — 실시간 주식 분석 (API 연동)
 * KO / EN 언어 토글 · 한글/숫자 한국 주식 검색 지원
 * v3: 모바일 반응형 + 터치 툴팁 수정
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
  Area, Cell,
} from 'recharts';
import {
  Search, Building2, Users, Activity, DollarSign, BarChart2,
  Target, ArrowUpRight, ArrowDownRight, Zap, ChevronRight,
  SlidersHorizontal, Info, FlaskConical, WifiOff, RefreshCw,
  ServerCrash, X, Globe, HelpCircle,
} from 'lucide-react';

import {
  calculateDCF, getValuationLabel, calculateAIScore,
  detectMACross, calculateHybridValuation,
  calculatePegScore, calculatePiotroski, calculateMagicFormula,
} from '@/lib/analysis';
import type { CompanyFundamentals, MockDataResult, ChartRow } from '@/lib/mockData';
import type { StockData } from '@/lib/types';
import { translations, type Lang, type DashboardT } from '@/lib/i18n';

/* ─────────────────────────────────────────────
 * 유틸
 * ───────────────────────────────────────────── */
function cn(...c: (string | boolean | undefined | null)[]): string {
  return c.filter(Boolean).join(' ');
}
function fmt(n: number, d = 2) { return n.toFixed(d); }

/* ─────────────────────────────────────────────
 * DCF 파라미터 타입
 * ───────────────────────────────────────────── */
interface DCFUserParams {
  growthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
}

/* ═══════════════════════════════════════════════════════════════
 * 1. 차트 툴팁
 * ═══════════════════════════════════════════════════════════════ */
type TooltipPayload = { dataKey: string; value: number; payload: Record<string, number> };

function PriceTooltip({ active, payload, label, t, fmtPx }: {
  active?: boolean; payload?: TooltipPayload[]; label?: string;
  t: DashboardT; fmtPx: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700/80 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-gray-400 mb-2 font-semibold">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4"><span className="text-gray-500">{t.close}</span><span className="text-blue-400 font-bold">{fmtPx(d.close)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-gray-500">{t.open}</span><span className="text-gray-300">{fmtPx(d.open)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-gray-500">{t.high}</span><span className="text-emerald-400">{fmtPx(d.high)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-gray-500">{t.low}</span><span className="text-rose-400">{fmtPx(d.low)}</span></div>
        {d.sma20 && <div className="flex justify-between gap-4 pt-1 border-t border-gray-800"><span className="text-gray-500">SMA20</span><span className="text-orange-400">{fmtPx(d.sma20)}</span></div>}
        {d.sma60 && <div className="flex justify-between gap-4"><span className="text-gray-500">SMA60</span><span className="text-red-400">{fmtPx(d.sma60)}</span></div>}
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-800">
          <span className="text-gray-500">{t.volumeLabel}</span>
          <span className="text-gray-300">{((d.volume ?? 0) / 1_000_000).toFixed(1)}M</span>
        </div>
      </div>
    </div>
  );
}

function RSITooltip({ active, payload, label, t }: {
  active?: boolean; payload?: { value: number }[]; label?: string; t: DashboardT;
}) {
  if (!active || !payload?.length) return null;
  const rsi  = payload[0].value;
  const zone = rsi >= 70
    ? { text: t.overbought, c: 'text-rose-400' }
    : rsi <= 30
    ? { text: t.oversold,   c: 'text-emerald-400' }
    : { text: t.neutralZone, c: 'text-gray-400' };
  return (
    <div className="bg-gray-900 border border-gray-700/80 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-gray-400 mb-1.5 font-semibold">{label}</p>
      <p className="text-violet-400 font-bold text-sm">RSI: {rsi?.toFixed(2)}</p>
      <p className={cn('mt-1', zone.c)}>{zone.text} {t.zone}</p>
    </div>
  );
}

function MACDTooltip({ active, payload, label }: {
  active?: boolean; payload?: TooltipPayload[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const macd = payload.find(p => p.dataKey === 'macdLine')?.value;
  const sig  = payload.find(p => p.dataKey === 'signalLine')?.value;
  const hist = payload.find(p => p.dataKey === 'histogram')?.value;
  return (
    <div className="bg-gray-900 border border-gray-700/80 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-gray-400 mb-1.5 font-semibold">{label}</p>
      {macd != null && <div className="flex justify-between gap-4"><span className="text-gray-500">MACD</span><span className="text-blue-400 font-bold">{macd.toFixed(3)}</span></div>}
      {sig  != null && <div className="flex justify-between gap-4"><span className="text-gray-500">Signal</span><span className="text-orange-400">{sig.toFixed(3)}</span></div>}
      {hist != null && (
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-800">
          <span className="text-gray-500">Hist</span>
          <span className={hist >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{hist.toFixed(3)}</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 2. DCF 슬라이더 + 도움말 툴팁 (모바일 터치 대응)
 * ═══════════════════════════════════════════════════════════════ */

/**
 * SliderHelpIcon
 *
 * - 부모(DCFGauge)가 관리하는 `activeTooltip / setActiveTooltip` 를 props로 받음
 * - 클릭/터치: 해당 id가 이미 열려있으면 닫기, 아니면 열기 (토글)
 * - 바깥 영역 터치/클릭 감지는 부모(DCFGauge)의 useEffect에서 일괄 처리
 * - 모바일 overflow 방지: 모바일(< sm)에서 left-0 정렬, sm+에서 가운데 정렬
 */
function SliderHelpIcon({
  id, text, activeTooltip, setActiveTooltip,
}: {
  id: string;
  text: string;
  activeTooltip: string | null;
  setActiveTooltip: (v: string | null) => void;
}) {
  const isOpen = activeTooltip === id;

  return (
    <span className="relative inline-flex items-center">
      {/* 터치 타깃을 넉넉하게 (44×44px 권장) — padding으로 확장 */}
      <button
        type="button"
        aria-label="도움말"
        aria-expanded={isOpen}
        className={cn(
          'p-1 -m-1 transition-colors rounded outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
          'touch-manipulation',          // iOS 300ms 딜레이 제거
          isOpen ? 'text-blue-400' : 'text-gray-500 hover:text-blue-400',
        )}
        onClick={e => {
          e.stopPropagation();
          setActiveTooltip(isOpen ? null : id);
        }}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 bottom-full mb-3',
            // 모바일: 왼쪽 정렬 (overflow 방지), sm+: 중앙 정렬
            'left-0 sm:left-1/2 sm:-translate-x-1/2',
            // 너비: 최대 256px, 뷰포트 80% 초과 금지
            'w-56 sm:w-64',
            'rounded-2xl px-4 py-3',
            'bg-gray-900 border border-blue-500/20',
            'text-[11px] text-gray-300 leading-relaxed',
            'shadow-2xl shadow-black/70',
            'animate-in fade-in duration-150',
          )}
        >
          {text}
          {/* 아래 방향 캐럿 — 모바일/desktop 정렬에 맞춰 위치 분기 */}
          <span className={cn(
            'absolute top-full border-x-4 border-x-transparent border-t-4 border-t-gray-900',
            'left-4 sm:left-1/2 sm:-translate-x-1/2',
          )} />
        </div>
      )}
    </span>
  );
}

interface SliderProps {
  label: string;
  sub: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  color: string;
  /** Tailwind JIT 정적 스캔을 위해 명시적으로 전달 */
  barColor: string;
  helpText?: string;
  helpId?: string;
  activeTooltip?: string | null;
  setActiveTooltip?: (v: string | null) => void;
}

function ParamSlider({
  label, sub, value, min, max, step, format, onChange, color, barColor,
  helpText, helpId, activeTooltip, setActiveTooltip,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-gray-300">{label}</span>
          {helpText && helpId && activeTooltip !== undefined && setActiveTooltip && (
            <SliderHelpIcon
              id={helpId}
              text={helpText}
              activeTooltip={activeTooltip}
              setActiveTooltip={setActiveTooltip}
            />
          )}
          <span className="text-[10px] text-gray-600">{sub}</span>
        </div>
        <span className={cn('text-sm font-bold flex-shrink-0 ml-2', color)}>{format(value)}</span>
      </div>
      <div className="relative h-2 bg-gray-800 rounded-full">
        <div className={cn('absolute h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
        {/* range input은 opacity-0 으로 덮어씌워 슬라이더 트랙을 직접 스타일링 */}
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-700 mt-1">
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 3. Guru Strategy 컴포넌트
 *    PegAnalysis / PiotroskiScore / MagicFormula
 * ═══════════════════════════════════════════════════════════════ */

/* ── 3-A. PEG 분석 (피터 린치) ─────────────────────────────── */
function PegAnalysis({ stockData, t }: { stockData: StockData; t: DashboardT }) {
  const result = useMemo(() =>
    calculatePegScore(stockData.per, stockData.earningsGrowth, stockData.pegRatio),
    [stockData.per, stockData.earningsGrowth, stockData.pegRatio],
  );

  const tierLabel = t.pegTiers[result.tier] ?? result.tier;
  const growthPct = stockData.earningsGrowth != null
    ? `${(stockData.earningsGrowth * 100).toFixed(1)}%`
    : (stockData.pegRatio != null && stockData.per > 0
        ? `${((stockData.per / (stockData.pegRatio)) ).toFixed(1)}%`
        : '—');

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      {/* 헤더 */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
              <span className="text-lg">🦁</span>
              {t.pegTitle}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{t.pegSub}</p>
          </div>
          {result.hasData && (
            <span className={cn(
              'flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border',
              result.bgColor,
              result.tier === 'strong_buy' ? 'border-emerald-500/30 text-emerald-400' :
              result.tier === 'buy'        ? 'border-green-500/30 text-green-400' :
              result.tier === 'fair'       ? 'border-amber-500/30 text-amber-400' :
                                            'border-rose-500/30 text-rose-400',
            )}>
              {tierLabel}
            </span>
          )}
        </div>
      </div>

      {/* 데이터 없음 */}
      {!result.hasData ? (
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center text-xl">📊</div>
          <div>
            <p className="text-gray-400 font-semibold text-sm mb-1">{t.pegNoData}</p>
            <p className="text-gray-600 text-xs leading-relaxed max-w-xs mx-auto">{t.pegNoDataDesc}</p>
          </div>
        </div>
      ) : (
        <>
          {/* PEG 수치 */}
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{t.pegRatioLabel}</p>
              <p className={cn('text-4xl font-black mt-0.5', result.color)}>{result.peg.toFixed(2)}</p>
            </div>
            <div className="pb-1 space-y-0.5">
              <p className="text-[10px] text-gray-600">
                {t.pegPerLabel} <span className="text-gray-400 font-semibold">{stockData.per.toFixed(1)}×</span>
              </p>
              <p className="text-[10px] text-gray-600">
                {t.pegGrowthLabel} <span className="text-gray-400 font-semibold">{growthPct}</span>
              </p>
              <p className="text-[10px] text-gray-700 italic">{t.pegFormula}</p>
            </div>
          </div>

          {/* 게이지 바 */}
          <div className="space-y-2">
            <div className="relative h-4 rounded-full overflow-visible"
              style={{ background: 'linear-gradient(to right, #10b981, #22c55e, #f59e0b, #ef4444)' }}>
              {/* 현재 PEG 마커 */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-5 bg-white rounded shadow-lg"
                style={{ left: `calc(${result.barPct}% - 6px)` }}
              />
              {/* 구간 기준선 */}
              {[25, 50, 75].map(pct => (
                <div key={pct} className="absolute top-0 bottom-0 w-px bg-black/20" style={{ left: `${pct}%` }} />
              ))}
            </div>
            {/* 눈금 레이블 */}
            <div className="flex justify-between text-[9px] text-gray-600">
              <span>0</span><span>0.5</span><span>1.0</span><span>1.5</span><span>2.0+</span>
            </div>
          </div>

          {/* 구간 해석 테이블 */}
          <div className="border-t border-gray-800 pt-3">
            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider mb-2">{t.pegGuideTitle}</p>
            <div className="space-y-1">
              {t.pegZones.map(z => (
                <div key={z.range}
                  className={cn(
                    'flex items-center justify-between px-2 py-1 rounded-lg text-[11px]',
                    result.hasData && (
                      (result.tier === 'strong_buy' && z.range === '≤ 0.5') ||
                      (result.tier === 'buy'        && z.range === '≤ 1.0') ||
                      (result.tier === 'fair'       && z.range === '≤ 1.5') ||
                      (result.tier === 'overvalued' && z.range === '> 1.5')
                    ) ? 'bg-gray-800/70 ring-1 ring-gray-700' : '',
                  )}>
                  <span className="text-gray-500 font-mono">PEG {z.range}</span>
                  <span className={cn('font-semibold', z.c)}>{z.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── 3-B. 피오트로스키 F-스코어 ─────────────────────────────── */
function PiotroskiScore({ stockData, t }: { stockData: StockData; t: DashboardT }) {
  const result = useMemo(() => calculatePiotroski({
    returnOnAssets:   stockData.returnOnAssets,
    operatingCashflow: stockData.operatingCashflow,
    netIncome:        stockData.netIncome,
    fcf:              stockData.fcf,
    grossMargin:      stockData.grossMargin,
    debtToEquity:     stockData.debtToEquity,
    currentRatio:     stockData.currentRatio,
    operatingMargin:  stockData.operatingMargin,
    roe:              stockData.roe,
    netMargin:        stockData.netMargin,
  }), [stockData]);

  const tierLabel = t.piotroskiTiers[result.tier] ?? result.tier;

  // 카테고리별 그룹화
  const categories: Array<{ key: 'profitability' | 'leverage' | 'efficiency' }> = [
    { key: 'profitability' },
    { key: 'leverage' },
    { key: 'efficiency' },
  ];

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
            <span className="text-lg">📋</span>
            {t.piotroskiTitle}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{t.piotroskiSub}</p>
        </div>
        {/* 점수 뱃지 */}
        <div className={cn(
          'flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl border font-black',
          result.bgColor,
          result.tier === 'strong' ? 'border-emerald-500/30' :
          result.tier === 'moderate' ? 'border-amber-500/30' : 'border-rose-500/30',
        )}>
          <span className={cn('text-2xl leading-none', result.color)}>{result.score}</span>
          <span className="text-[9px] text-gray-600 font-normal">/ 9</span>
        </div>
      </div>

      {/* 점수 요약 */}
      <div className={cn('px-3 py-2 rounded-xl border text-xs font-semibold', result.bgColor,
        result.tier === 'strong' ? 'border-emerald-500/30 text-emerald-400' :
        result.tier === 'moderate' ? 'border-amber-500/30 text-amber-400' : 'border-rose-500/30 text-rose-400',
      )}>
        {tierLabel}
      </div>

      {/* 기준별 체크리스트 */}
      <div className="space-y-3">
        {categories.map(({ key }) => {
          const items = result.criteria.filter(c => c.category === key);
          return (
            <div key={key}>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-1.5">
                {t.piotroskiCatLabels[key] ?? key}
              </p>
              <div className="space-y-1">
                {items.map(criterion => (
                  <div key={criterion.id}
                    className={cn(
                      'flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs',
                      criterion.passed
                        ? 'bg-emerald-500/5 border border-emerald-500/15'
                        : 'bg-rose-500/5 border border-rose-500/10',
                    )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={criterion.passed ? 'text-emerald-400' : 'text-rose-400'}>
                        {criterion.passed ? '✓' : '✗'}
                      </span>
                      <span className={cn(
                        'text-[11px] truncate',
                        criterion.passed ? 'text-gray-300' : 'text-gray-500',
                      )}>
                        {t.piotroskiCriteria[criterion.id] ?? criterion.id}
                        {!criterion.hasData && (
                          <span className="text-gray-700 ml-1">*</span>
                        )}
                      </span>
                    </div>
                    <span className={cn(
                      'text-[10px] font-mono flex-shrink-0 ml-2',
                      criterion.passed ? 'text-emerald-600' : 'text-rose-700',
                    )}>
                      {criterion.valueStr}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 대체 기준 주석 */}
      {result.criteria.some(c => !c.hasData) && (
        <p className="text-[10px] text-gray-700 border-t border-gray-800 pt-2">
          {t.piotroskiProxyNote}
        </p>
      )}
    </div>
  );
}

/* ── 3-C. 마법 공식 (그린블라트) ────────────────────────────── */
function MagicFormula({ stockData, t }: { stockData: StockData; t: DashboardT }) {
  const result = useMemo(() =>
    calculateMagicFormula(
      stockData.evEbitda,
      stockData.per,
      stockData.roe,
      stockData.operatingMargin,
    ),
    [stockData.evEbitda, stockData.per, stockData.roe, stockData.operatingMargin],
  );

  const attrLabel    = t.magicAttrLabels[result.attractiveness] ?? result.attractiveness;
  const eyTierLabel  = t.magicTierLabels[result.eyTier]  ?? result.eyTier;
  const rocTierLabel = t.magicTierLabels[result.rocTier] ?? result.rocTier;

  // 컴포지트 점수 바: 2→0%, 6→100%
  const scoreBarPct = ((result.compositeScore - 2) / 4) * 100;

  const tierColor = (tier: 'high' | 'medium' | 'low') =>
    tier === 'high' ? 'text-emerald-400' : tier === 'medium' ? 'text-amber-400' : 'text-rose-400';
  const tierBg = (tier: 'high' | 'medium' | 'low') =>
    tier === 'high' ? 'bg-emerald-500/10 border-emerald-500/25' :
    tier === 'medium' ? 'bg-amber-500/10 border-amber-500/25' : 'bg-rose-500/10 border-rose-500/25';

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
            <span className="text-lg">✨</span>
            {t.magicTitle}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{t.magicSub}</p>
        </div>
      </div>

      {/* 두 지표 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 이익수익률 */}
        <div className={cn('rounded-xl p-3 border', tierBg(result.eyTier))}>
          <p className="text-[10px] text-gray-500 mb-1 leading-tight">{t.magicEYLabel}</p>
          <p className={cn('text-2xl font-black', tierColor(result.eyTier))}>
            {result.earningsYield.toFixed(1)}<span className="text-sm">%</span>
          </p>
          <p className={cn('text-[10px] font-semibold mt-1', tierColor(result.eyTier))}>
            {eyTierLabel} {result.eyTier === 'high' ? '▲' : result.eyTier === 'medium' ? '→' : '▼'}
          </p>
          <p className="text-[9px] text-gray-700 mt-1 leading-tight">{t.magicEYDesc}</p>
        </div>
        {/* 자본수익률 */}
        <div className={cn('rounded-xl p-3 border', tierBg(result.rocTier))}>
          <p className="text-[10px] text-gray-500 mb-1 leading-tight">{t.magicROCLabel}</p>
          <p className={cn('text-2xl font-black', tierColor(result.rocTier))}>
            {result.roc.toFixed(1)}<span className="text-sm">%</span>
          </p>
          <p className={cn('text-[10px] font-semibold mt-1', tierColor(result.rocTier))}>
            {rocTierLabel} {result.rocTier === 'high' ? '▲' : result.rocTier === 'medium' ? '→' : '▼'}
          </p>
          <p className="text-[9px] text-gray-700 mt-1 leading-tight">{t.magicROCDesc}</p>
        </div>
      </div>

      {/* 종합 투자 매력도 */}
      <div>
        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-2">{t.magicAttrTitle}</p>
        {/* 3구간 바 */}
        <div className="h-6 rounded-full overflow-hidden relative"
          style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b, #10b981)' }}>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-5 bg-white rounded shadow-lg"
            style={{ left: `calc(${scoreBarPct}% - 6px)` }}
          />
          {/* ★ / ★★ / ★★★ 텍스트 */}
          <div className="absolute inset-0 flex items-center justify-around text-[9px] text-white/50 select-none px-3">
            <span>★</span><span>★★</span><span>★★★</span>
          </div>
        </div>

        {/* 종합 배지 */}
        <div className={cn(
          'mt-3 px-3 py-2 rounded-xl border text-xs font-semibold text-center',
          result.bgColor,
          result.attractiveness === 'high' ? 'border-emerald-500/30 text-emerald-400' :
          result.attractiveness === 'medium' ? 'border-amber-500/30 text-amber-400' :
                                               'border-rose-500/30 text-rose-400',
        )}>
          {attrLabel}
        </div>
      </div>

      {/* 방법론 주석 */}
      <p className="text-[10px] text-gray-700 border-t border-gray-800 pt-2 leading-relaxed">
        {t.magicNote}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 4. DCF 게이지 (하이브리드 가치평가: DCF → EPS-PER → unavailable)
 * ═══════════════════════════════════════════════════════════════ */
function DCFGauge({ company, params, onParamChange, t, fmtPx, convFactor }: {
  company: CompanyFundamentals;
  params: DCFUserParams;
  onParamChange: (p: Partial<DCFUserParams>) => void;
  t: DashboardT;
  fmtPx: (v: number) => string;
  convFactor: number;
}) {
  /* ── 툴팁 상태: string = 열린 슬라이더 ID, null = 모두 닫힘 ── */
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);

  /**
   * 바깥 영역 mousedown / touchstart → 툴팁 닫기
   * - capture phase(true)로 등록해 stopPropagation 방어
   * - activeTooltip이 null이면 리스너 불필요
   */
  useEffect(() => {
    if (!activeTooltip) return;

    const closeTooltip = (e: MouseEvent | TouchEvent) => {
      if (gaugeRef.current && !gaugeRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
      }
    };

    document.addEventListener('mousedown',  closeTooltip, true);
    document.addEventListener('touchstart', closeTooltip, true);
    return () => {
      document.removeEventListener('mousedown',  closeTooltip, true);
      document.removeEventListener('touchstart', closeTooltip, true);
    };
  }, [activeTooltip]);

  /* ── 하이브리드 가치평가 ─────────────────────── */
  const result = useMemo(() => calculateHybridValuation({
    fcf:               company.fcf,
    shares:            company.shares,
    netDebt:           company.netDebt,
    growthRate:        params.growthRate,
    discountRate:      params.discountRate,
    terminalGrowthRate: params.terminalGrowthRate,
    currentPrice:      company.currentPrice,
    trailingEps:       company.trailingEps,
  }), [company, params]);

  const fairValue     = result.fairValuePerShare;
  const isEpsModel    = result.model === 'eps';
  const isUnavailable = result.model === 'unavailable';

  const valuation = getValuationLabel(fairValue, company.currentPrice);
  const valLabel  = valuation.label === '저평가' ? t.valUnder
                  : valuation.label === '고평가' ? t.valOver : t.valFair;
  const bearVal   = fairValue * 0.70;
  const bullVal   = fairValue * 1.40;
  const range     = bullVal - bearVal;
  const curPos    = Math.min(Math.max(((company.currentPrice - bearVal) / range) * 100, 2), 97);

  const modelBadgeCls = isUnavailable
    ? 'text-gray-500 bg-gray-700/20 border-gray-700/40'
    : isEpsModel
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
    : 'text-blue-400 bg-blue-500/10 border-blue-500/25';
  const modelBadgeIcon = isUnavailable ? '⚠️' : isEpsModel ? '📊' : '💹';
  const modelBadgeText = isUnavailable
    ? t.unavailableModelBadge
    : isEpsModel ? t.epsModelBadge : t.dcfModelBadge;

  return (
    <div
      ref={gaugeRef}
      className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-4 sm:p-6 h-full flex flex-col"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          <h3 className="text-white font-bold text-sm sm:text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400 flex-shrink-0" />
            {t.dcfTitle}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{t.dcfSub}</p>
          <span className={cn(
            'inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border',
            modelBadgeCls,
          )}>
            {modelBadgeIcon} {modelBadgeText}
          </span>
        </div>
        {!isUnavailable && (
          <div className={cn(
            'px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold border flex-shrink-0',
            valuation.bgColor, valuation.borderColor, valuation.color,
          )}>
            {valuation.upsidePct > 0 ? '▲' : '▼'} {Math.abs(valuation.upsidePct).toFixed(1)}% {valLabel}
          </div>
        )}
      </div>

      {/* ── 데이터 미제공 상태 ── */}
      {isUnavailable ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center text-2xl sm:text-3xl">
            📊
          </div>
          <div>
            <p className="text-gray-300 font-semibold text-sm mb-2">{t.valuationUnavailableTitle}</p>
            <p className="text-gray-500 text-xs leading-relaxed max-w-xs mx-auto">
              {t.valuationUnavailableDesc}
            </p>
          </div>
          <p className="text-gray-600 text-[11px] leading-relaxed max-w-xs mx-auto border-t border-gray-800 pt-3">
            💡 {t.valuationUnavailableHint}
          </p>
        </div>
      ) : (
        <>
          {/* 게이지 바 */}
          <div className="relative mt-8 mb-12">
            <div className="h-6 sm:h-7 rounded-full bg-gradient-to-r from-rose-600/80 via-amber-500/80 to-emerald-500/80 relative overflow-visible shadow-inner">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] text-white/60 font-medium select-none">{t.dcfUnder}</span>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] text-white/60 font-medium select-none">{t.dcfOver}</span>
              {/* 적정가 마커 */}
              <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: '50%' }}>
                <div className="absolute -top-7 transform -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[10px] sm:text-[11px] font-bold text-yellow-300 bg-yellow-500/20 border border-yellow-500/40 px-1.5 sm:px-2 py-0.5 rounded-full">
                    {t.dcfFairLabel} {fmtPx(fairValue * convFactor)}
                  </span>
                </div>
                <div className="w-0.5 h-full bg-yellow-300/80" />
                <div
                  className="absolute -bottom-2 w-2.5 h-2.5 bg-yellow-300 rounded-full transform -translate-x-1/2"
                  style={{ left: '50%' }}
                />
              </div>
              {/* 현재가 마커 */}
              <div className="absolute top-0 bottom-0" style={{ left: `${curPos}%` }}>
                <div className="w-1 h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                <div
                  className="absolute -bottom-9 transform -translate-x-1/2 whitespace-nowrap"
                  style={{ left: '50%' }}
                >
                  <span className="text-[10px] sm:text-[11px] font-bold text-white bg-blue-600 px-1.5 sm:px-2 py-0.5 rounded-full">
                    {t.dcfCurrent} {fmtPx(company.currentPrice * convFactor)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bear / Current / Bull */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { l: t.dcfBear,    v: fmtPx(bearVal  * convFactor), c: 'text-rose-400' },
              { l: t.dcfCurrent, v: fmtPx(company.currentPrice * convFactor), c: 'text-white font-bold' },
              { l: t.dcfBull,    v: fmtPx(bullVal  * convFactor), c: 'text-emerald-400' },
            ].map(item => (
              <div key={item.l} className="bg-gray-800/50 rounded-xl p-2 sm:p-2.5 text-center">
                <p className="text-[9px] sm:text-[10px] text-gray-500 mb-1 leading-tight">{item.l}</p>
                <p className={cn('text-xs sm:text-sm truncate', item.c)}>{item.v}</p>
              </div>
            ))}
          </div>

          {/* EPS 모드 / DCF 모드 상세 */}
          {isEpsModel ? (
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              {[
                { l: t.epsEpsLabel,  v: fmtPx((result.trailingEpsUsed ?? 0) * convFactor) },
                { l: t.epsPERLabel,  v: `× ${fmt(result.targetPerUsed ?? 12.5, 1)}` },
                { l: t.epsFairLabel, v: fmtPx(fairValue * convFactor) },
              ].map(item => (
                <div key={item.l} className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-2 sm:p-2.5">
                  <p className="text-[9px] sm:text-[10px] text-amber-600/80 mb-1">{item.l}</p>
                  <p className="text-xs sm:text-sm font-bold text-amber-200 truncate">{item.v}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              {[
                { l: t.pvFCFs,  v: `${fmtPx(result.pvOfFCFs         * convFactor / 1000)}B` },
                { l: t.termVal, v: `${fmtPx(result.pvOfTerminalValue * convFactor / 1000)}B` },
                { l: t.ev,      v: `${fmtPx(result.enterpriseValue   * convFactor / 1000)}B` },
              ].map(item => (
                <div key={item.l} className="bg-gray-800/30 rounded-xl p-2 sm:p-2.5">
                  <p className="text-[9px] sm:text-[10px] text-gray-600 mb-1">{item.l}</p>
                  <p className="text-xs sm:text-sm font-bold text-gray-200 truncate">{item.v}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 슬라이더 영역 — unavailable 시에도 표시 */}
      <div className="border-t border-gray-800 pt-4 space-y-4 mt-auto">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.dcfAdjust}</span>
          <button
            className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            onClick={() => onParamChange({
              growthRate:         company.defaultGrowthRate,
              discountRate:       company.defaultWACC,
              terminalGrowthRate: company.defaultTerminalGrowth,
            })}
          >
            {t.dcfReset}
          </button>
        </div>

        <ParamSlider
          label={t.growthRate} sub={t.growthSub}
          value={params.growthRate} min={0.01} max={0.40} step={0.005}
          format={v => `${(v * 100).toFixed(1)}%`}
          onChange={v => onParamChange({ growthRate: v })}
          color="text-blue-400" barColor="bg-blue-400"
          helpText={t.growthRateHelp} helpId="growthRate"
          activeTooltip={activeTooltip} setActiveTooltip={setActiveTooltip}
        />
        <ParamSlider
          label={t.wacc} sub={t.waccSub}
          value={params.discountRate} min={0.05} max={0.15} step={0.005}
          format={v => `${(v * 100).toFixed(1)}%`}
          onChange={v => onParamChange({ discountRate: v })}
          color="text-purple-400" barColor="bg-purple-400"
          helpText={t.waccHelp} helpId="wacc"
          activeTooltip={activeTooltip} setActiveTooltip={setActiveTooltip}
        />
        <ParamSlider
          label={t.termGrowth} sub={t.termSub}
          value={params.terminalGrowthRate} min={0.005} max={0.05} step={0.005}
          format={v => `${(v * 100).toFixed(1)}%`}
          onChange={v => onParamChange({ terminalGrowthRate: v })}
          color="text-amber-400" barColor="bg-amber-400"
          helpText={t.termGrowthHelp} helpId="termGrowth"
          activeTooltip={activeTooltip} setActiveTooltip={setActiveTooltip}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 4. 메트릭 카드
 * ═══════════════════════════════════════════════════════════════ */
function MetricCard({ label, value, industryAvg, unit, description, higherIsBetter = false, isPercent = false, t }: {
  label: string; value: number; industryAvg: number; unit: string;
  description: string; higherIsBetter?: boolean; isPercent?: boolean; t: DashboardT;
}) {
  const display    = isPercent ? `${value.toFixed(1)}%` : `${value.toFixed(1)}${unit}`;
  const indDisplay = isPercent ? `${industryAvg.toFixed(1)}%` : `${industryAvg.toFixed(1)}${unit}`;
  const isGood     = higherIsBetter ? value >= industryAvg : value <= industryAvg;
  const diffPct    = Math.abs(((value - industryAvg) / industryAvg) * 100);
  const barWidth   = Math.min((value / (industryAvg * 2)) * 100, 100);

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-4 sm:p-5 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div>
          <p className="text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-1 sm:mt-1.5 leading-none">{display}</p>
        </div>
        <span className={cn(
          'text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-1 rounded-full font-bold flex-shrink-0 ml-2',
          isGood ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                 : 'bg-rose-500/15 text-rose-400 border border-rose-500/20',
        )}>
          {isGood ? t.metricGood : t.metricCaution}
        </span>
      </div>
      <div className="mb-3 relative pt-5">
        <div className="absolute top-0 text-[10px] text-gray-600 transform -translate-x-1/2" style={{ left: '50%' }}>
          {t.industryAvg} ({indDisplay})
        </div>
        <div className="h-2 sm:h-2.5 bg-gray-800 rounded-full overflow-hidden relative">
          <div
            className={cn('h-full rounded-full transition-all duration-700 ease-out',
              isGood ? 'bg-gradient-to-r from-blue-600 to-blue-400'
                     : 'bg-gradient-to-r from-amber-600 to-amber-400')}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="absolute top-5 h-2.5 w-px bg-gray-500" style={{ left: '50%' }} />
      </div>
      <div className="flex items-center justify-between text-xs mt-3 sm:mt-4">
        <span className="text-gray-500 text-[10px] sm:text-xs">{t.industryAvg} <span className="text-gray-300 font-medium">{indDisplay}</span></span>
        <span className={cn('font-bold', isGood ? 'text-emerald-400' : 'text-rose-400')}>
          {isGood ? (higherIsBetter ? '▲' : '▼') : (higherIsBetter ? '▼' : '▲')} {diffPct.toFixed(1)}%
        </span>
      </div>
      <p className="text-[10px] sm:text-[11px] text-gray-600 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-800 leading-relaxed">{description}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 5. 재무 건전성 카드
 * ═══════════════════════════════════════════════════════════════ */
function FinancialHealth({ company, t }: { company: CompanyFundamentals; t: DashboardT }) {
  const f = company;
  const margins = [
    { label: t.grossMargin,     value: f.grossMargin,     grad: 'from-blue-500 to-blue-400',       text: 'text-blue-400' },
    { label: t.operatingMargin, value: f.operatingMargin, grad: 'from-purple-500 to-purple-400',   text: 'text-purple-400' },
    { label: t.netMargin,       value: f.netMargin,       grad: 'from-emerald-500 to-emerald-400', text: 'text-emerald-400' },
  ];
  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-4 sm:p-5 h-full flex flex-col">
      <h3 className="text-white font-bold text-sm sm:text-base flex items-center gap-2 mb-4 sm:mb-5">
        <Activity className="w-4 h-4 text-blue-400" />
        {t.healthTitle}
      </h3>
      <div className="space-y-4 flex-1">
        {margins.map(m => (
          <div key={m.label}>
            <div className="flex justify-between items-center mb-1.5 sm:mb-2">
              <span className="text-xs text-gray-400">{m.label}</span>
              <span className={cn('text-sm font-bold', m.text)}>{m.value.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', m.grad)}
                style={{ width: `${Math.min(m.value, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-800 grid grid-cols-3 gap-2">
        {[
          { label: t.divYield,     value: f.dividendYield === 0 ? t.noDiv : `${f.dividendYield.toFixed(2)}%` },
          { label: t.debtToEquity, value: f.debtToEquity.toFixed(2) },
          { label: t.currentRatio, value: f.currentRatio.toFixed(2) },
        ].map(item => (
          <div key={item.label} className="bg-gray-800/50 rounded-xl p-2 sm:p-3 text-center">
            <p className="text-[9px] sm:text-[10px] text-gray-500 mb-1 leading-tight">{item.label}</p>
            <p className="text-xs sm:text-sm font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 6. AI 점수 위젯
 * ═══════════════════════════════════════════════════════════════ */
function AIScoreWidget({ company, params, chartData, t }: {
  company: CompanyFundamentals;
  params: DCFUserParams;
  chartData: MockDataResult;
  t: DashboardT;
}) {
  const aiScore = useMemo(() => {
    const hybrid = calculateHybridValuation({
      fcf:               company.fcf,
      shares:            company.shares,
      netDebt:           company.netDebt,
      currentPrice:      company.currentPrice,
      trailingEps:       company.trailingEps,
      ...params,
    });
    const dcfFairForScore = hybrid.model === 'unavailable'
      ? company.currentPrice
      : hybrid.fairValuePerShare;

    const sma20s = chartData.chartRows.map(r => r.sma20);
    const sma60s = chartData.chartRows.map(r => r.sma60);
    const cross  = detectMACross(sma20s, sma60s, 10);
    return calculateAIScore({
      currentPrice: company.currentPrice, dcfFairValue: dcfFairForScore,
      rsi: chartData.latestRSI, crossSignal: cross,
      per: company.per, industryPer: company.industryPer,
      pbr: company.pbr, industryPbr: company.industryPbr,
    });
  }, [company, params, chartData]);

  const gradeT    = t.aiGrades[aiScore.grade]      ?? aiScore.grade;
  const feedbackT = t.aiFeedbacks[aiScore.feedback] ?? aiScore.feedback;

  const radius = 54;
  const circ   = 2 * Math.PI * radius;
  const dash   = (aiScore.score / 100) * circ;
  const scoreColor = aiScore.score >= 65 ? '#10b981' : aiScore.score >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-4 sm:p-6">
      <h3 className="text-white font-bold text-sm sm:text-base flex items-center gap-2 mb-4 sm:mb-5">
        <Zap className="w-4 h-4 text-yellow-400" />
        {t.aiTitle}
        <span className="ml-auto text-[10px] text-gray-600 flex items-center gap-1">
          <Info className="w-3 h-3" /> {t.aiSubLabel}
        </span>
      </h3>

      <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-center">
        {/* 원형 점수 게이지 */}
        <div className="relative flex-shrink-0">
          <svg width="130" height="130" className="-rotate-90 sm:w-[140px] sm:h-[140px]">
            <circle cx="65" cy="65" r={radius} fill="none" stroke="#1f2937" strokeWidth="10" />
            <circle cx="65" cy="65" r={radius} fill="none" stroke={scoreColor} strokeWidth="10"
              strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.4s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl sm:text-4xl font-black text-white">{aiScore.score}</span>
            <span className="text-xs text-gray-500 -mt-1">/ 100</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 w-full">
          <p className={cn('text-xl sm:text-2xl font-extrabold mb-2', aiScore.gradeColor)}>{gradeT}</p>
          <div className="bg-gray-800/50 rounded-xl p-3 text-xs text-gray-300 leading-relaxed border border-gray-700/50">
            💡 {feedbackT}
          </div>
        </div>
      </div>

      <div className="mt-4 sm:mt-5 space-y-3">
        {aiScore.breakdown.map(item => {
          const pct    = (item.points / item.maxPoints) * 100;
          const barCol = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
          const catT   = t.aiCategories[item.category] ?? item.category;
          return (
            <div key={item.category}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-300">{catT}</span>
                <span className="text-xs font-bold text-gray-200">
                  {item.points} <span className="text-gray-600">/ {item.maxPoints}</span>
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-1">
                <div className={cn('h-full rounded-full transition-all duration-700', barCol)}
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{item.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 7. 주가 차트
 * ═══════════════════════════════════════════════════════════════ */
function PriceChart({ rows, fmtPx, t }: {
  rows: ChartRow[]; fmtPx: (v: number) => string; t: DashboardT;
}) {
  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-3 sm:p-5">
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
        <h3 className="text-white font-bold text-sm sm:text-base">{t.priceChartTitle}</h3>
        <div className="flex items-center gap-3 sm:gap-4 text-xs">
          {[
            { color: 'bg-blue-400',   label: t.close },
            { color: 'bg-orange-400', label: 'SMA20' },
            { color: 'bg-red-400',    label: 'SMA60' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={cn('w-3 sm:w-4 h-0.5 inline-block rounded', color)} />
              <span className="text-gray-400 text-[11px] sm:text-xs">{label}</span>
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false} axisLine={false} interval={14} />
          <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => fmtPx(v)} domain={['auto', 'auto']} width={64} />
          <Tooltip content={<PriceTooltip t={t} fmtPx={fmtPx} />} />
          <Area type="monotone" dataKey="close" fill="url(#priceGrad)"
            stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="sma20" stroke="#f97316"
            strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="sma60" stroke="#f87171"
            strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 8. RSI 차트
 * ═══════════════════════════════════════════════════════════════ */
function RSIChart({ data, t }: { data: MockDataResult; t: DashboardT }) {
  const rsiVal = data.latestRSI ?? 50;
  const zone   = rsiVal >= 70
    ? { text: t.overbought, c: 'text-rose-400',    b: 'bg-rose-500/10',    bd: 'border-rose-500/30' }
    : rsiVal <= 30
    ? { text: t.oversold,   c: 'text-emerald-400', b: 'bg-emerald-500/10', bd: 'border-emerald-500/30' }
    : { text: t.neutralZone, c: 'text-gray-300',   b: 'bg-gray-700/30',    bd: 'border-gray-600/30' };
  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-3 sm:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3 flex-wrap gap-2">
        <h3 className="text-white font-bold text-sm sm:text-base">
          {t.rsiTitle} <span className="text-gray-500 font-normal text-xs sm:text-sm">{t.rsiSub}</span>
        </h3>
        <div className={cn('text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full border', zone.b, zone.bd, zone.c)}>
          RSI {rsiVal.toFixed(1)} · {zone.text}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data.chartRows} margin={{ top: 5, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false} axisLine={false} interval={14} />
          <YAxis domain={[0, 100]} tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false} axisLine={false} ticks={[0, 30, 50, 70, 100]} width={24} />
          <Tooltip content={<RSITooltip t={t} />} />
          <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.07} />
          <ReferenceArea y1={0}  y2={30}  fill="#10b981" fillOpacity={0.07} />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.5} />
          <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.5} />
          <ReferenceLine y={50} stroke="#374151" strokeDasharray="2 4" strokeOpacity={0.6} />
          <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={2}
            dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 9. MACD 차트
 * ═══════════════════════════════════════════════════════════════ */
function MACDChart({ data, t }: { data: MockDataResult; t: DashboardT }) {
  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-3 sm:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3 flex-wrap gap-2">
        <h3 className="text-white font-bold text-sm sm:text-base">
          {t.macdTitle} <span className="text-gray-500 font-normal text-xs sm:text-sm">{t.macdSub}</span>
        </h3>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px]">
          {[
            { c: 'bg-blue-400',       l: 'MACD' },
            { c: 'bg-orange-400',     l: 'Signal' },
            { c: 'bg-emerald-400/60', l: 'Hist+' },
            { c: 'bg-rose-400/60',    l: 'Hist-' },
          ].map(({ c, l }) => (
            <span key={l} className="flex items-center gap-1">
              <span className={cn('w-3 h-2 rounded-sm inline-block', c)} />
              <span className="text-gray-500">{l}</span>
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data.chartRows} margin={{ top: 5, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false} axisLine={false} interval={14} />
          <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false}
            width={44} tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip content={<MACDTooltip />} />
          <ReferenceLine y={0} stroke="#374151" strokeOpacity={0.8} />
          <Bar dataKey="histogram" maxBarSize={5} radius={[2, 2, 0, 0]}>
            {data.chartRows.map((entry, idx) => (
              <Cell key={idx} fill={(entry.histogram ?? 0) >= 0 ? '#10b981' : '#ef4444'}
                fillOpacity={0.75} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="macdLine"   stroke="#60a5fa"
            strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="signalLine" stroke="#fb923c"
            strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 10. 기업 프로필 카드
 * ═══════════════════════════════════════════════════════════════ */
function ProfileCard({ company, note, onRefresh, isLoading, t, fmtPx, convFactor }: {
  company: CompanyFundamentals;
  note?: string;
  onRefresh: () => void;
  isLoading: boolean;
  t: DashboardT;
  fmtPx: (v: number) => string;
  convFactor: number;
}) {
  const isPos  = company.changePercent >= 0;
  const range  = company.week52High - company.week52Low;
  const curPct = range > 0
    ? Math.round(((company.currentPrice - company.week52Low) / range) * 100)
    : 50;

  const dispPrice  = fmtPx(company.currentPrice * convFactor);
  const dispChange = (() => {
    const v    = company.change * convFactor;
    const sign = v >= 0 ? '+' : '';
    return `${sign}${fmtPx(Math.abs(v))}`;
  })();
  const dispW52H = fmtPx(company.week52High * convFactor);
  const dispW52L = fmtPx(company.week52Low  * convFactor);

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-4 sm:p-6">
      {note && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{note}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start gap-4 sm:gap-6">
        {/* 기업명 & 설명 */}
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-gray-700 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-white">{company.name}</h1>
              <span className="text-xs text-blue-300 bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 rounded-full font-semibold">
                {company.ticker}
              </span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {company.exchange}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{company.sector} · {company.industry}</p>
            <p className="text-xs text-gray-600 mt-1.5 sm:mt-2 leading-relaxed max-w-2xl line-clamp-2 sm:line-clamp-none">{company.description}</p>
          </div>
        </div>

        {/* 가격 & 52주 범위 */}
        <div className="md:text-right flex-shrink-0">
          <div className="flex items-baseline gap-2 sm:gap-3 md:justify-end flex-wrap">
            <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
              {dispPrice}
            </span>
            <div className={cn(
              'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-bold',
              isPos ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
            )}>
              {isPos ? <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              <span className="whitespace-nowrap">{dispChange} ({isPos ? '+' : ''}{company.changePercent.toFixed(2)}%)</span>
            </div>
          </div>

          <div className="mt-2 sm:mt-3 md:flex md:flex-col md:items-end">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 md:justify-end">
              <span className="text-[11px]">{dispW52L}</span>
              <span className="text-gray-600 text-[10px]">{t.week52Range}</span>
              <span className="text-[11px]">{dispW52H}</span>
            </div>
            <div className="w-full md:w-48 h-1.5 sm:h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500"
                style={{ width: `${curPct}%` }} />
            </div>
            <p className="text-[11px] text-gray-600 mt-1">{t.week52Pos(curPct)}</p>
          </div>

          <button onClick={onRefresh} disabled={isLoading}
            className="mt-2 sm:mt-3 flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-300 transition-colors md:ml-auto disabled:opacity-40">
            <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
            {t.dataRefresh}
          </button>
        </div>
      </div>

      {/* 요약 지표 4개 */}
      <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-800/80 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: t.marketCap, value: company.marketCap, Icon: DollarSign, accent: 'text-blue-400' },
          { label: t.peRatio,   value: `${company.per}x`,  Icon: BarChart2,  accent: 'text-purple-400' },
          { label: t.volume,    value: company.volume,     Icon: Activity,   accent: 'text-emerald-400' },
          { label: t.employees, value: company.employees,  Icon: Users,      accent: 'text-amber-400' },
        ].map(({ label, value, Icon, accent }) => (
          <div key={label} className="flex items-center gap-2 sm:gap-3">
            <div className={cn('w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-800/70 flex items-center justify-center flex-shrink-0', accent)}>
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] text-gray-500">{label}</p>
              <p className="text-xs sm:text-sm font-bold text-white truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 11. 섹션 구분선
 * ═══════════════════════════════════════════════════════════════ */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-gray-800" />
      <ChevronRight className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 12. 로딩 화면
 * ═══════════════════════════════════════════════════════════════ */
function LoadingScreen({ ticker, t }: { ticker: string; t: DashboardT }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4"
      style={{ backgroundColor: '#060d1a' }}>
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
          <BarChart2 className="w-8 h-8 text-white" />
        </div>
        <div className="absolute -inset-2 rounded-3xl border-2 border-blue-500/30 animate-ping" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-lg">{t.loadingTitle(ticker)}</p>
        <p className="text-gray-500 text-sm mt-1">{t.loadingSubtitle}</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 13. 에러 화면
 * ═══════════════════════════════════════════════════════════════ */
function ErrorScreen({ ticker, message, onRetry, t }: {
  ticker: string; message: string; onRetry: () => void; t: DashboardT;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
      style={{ backgroundColor: '#060d1a' }}>
      <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
        <ServerCrash className="w-10 h-10 text-rose-400" />
      </div>
      <div className="text-center max-w-md w-full">
        <p className="text-white font-extrabold text-xl sm:text-2xl tracking-tight">{t.errorTitle}</p>
        <p className="text-gray-400 text-sm mt-2">{t.errorSubtitle(ticker)}</p>
        <div className="mt-4 bg-gray-900/80 border border-gray-800 rounded-2xl px-4 sm:px-5 py-4 text-left space-y-1">
          <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold mb-2">
            {t.errorDetail}
          </p>
          <p className="text-rose-400/90 text-xs font-mono leading-relaxed break-all">{message}</p>
        </div>
        <p className="text-gray-600 text-xs mt-4 leading-relaxed">
          {t.errorHint}<br />
          <span className="text-gray-500">{t.errorHintSub}</span>
        </p>
      </div>
      <button onClick={onRetry}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl text-sm font-semibold text-white transition-colors shadow-lg shadow-blue-500/20">
        <RefreshCw className="w-4 h-4" />
        {t.retryBtn}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 14. 메인 대시보드
 * ═══════════════════════════════════════════════════════════════ */
export default function StockDashboard() {
  /* ── 언어 상태 ──────────────────────────────── */
  const [lang, setLang] = useState<Lang>('ko');
  useEffect(() => {
    const saved = localStorage.getItem('stock-er-lang') as Lang | null;
    if (saved === 'ko' || saved === 'en') setLang(saved);
  }, []);
  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'ko' ? 'en' : 'ko';
      localStorage.setItem('stock-er-lang', next);
      return next;
    });
  }, []);
  const t = translations[lang].dashboard;

  /* ── UI 상태 ────────────────────────────────── */
  const [searchInput, setSearchInput]       = useState('AAPL');
  const [activeTab, setActiveTab]           = useState<'fundamental' | 'technical' | 'guru'>('fundamental');
  const [bannerVisible, setBannerVisible]   = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<'KRW' | 'USD'>('USD');

  /* ── API 데이터 상태 ────────────────────────── */
  const [stockData, setStockData]   = useState<StockData | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [apiError, setApiError]     = useState<string | null>(null);
  const [lastTicker, setLastTicker] = useState('AAPL');

  /* ── DCF 슬라이더 ───────────────────────────── */
  const [dcfParams, setDcfParams] = useState<DCFUserParams>({
    growthRate: 0.09, discountRate: 0.085, terminalGrowthRate: 0.03,
  });

  /* ── 데이터 페치 ────────────────────────────── */
  const fetchStockData = useCallback(async (rawTicker: string) => {
    const q = rawTicker.trim();
    if (!q) return;
    setIsLoading(true);
    setApiError(null);
    setLastTicker(q);
    try {
      const res = await fetch(`/api/stock?ticker=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data: StockData = await res.json();
      setStockData(data);
      setDisplayCurrency((data.currency ?? 'USD') === 'KRW' ? 'KRW' : 'USD');
      setDcfParams({
        growthRate:         data.defaultGrowthRate,
        discountRate:       data.defaultWACC,
        terminalGrowthRate: data.defaultTerminalGrowth,
      });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStockData('AAPL'); }, [fetchStockData]);

  const handleSearch = useCallback(() => {
    const q = searchInput.trim();
    if (q) fetchStockData(q);
  }, [searchInput, fetchStockData]);

  const updateParam = useCallback((partial: Partial<DCFUserParams>) => {
    setDcfParams(prev => ({ ...prev, ...partial }));
  }, []);

  /* ── 환율 변환 계수 ─────────────────────────── */
  const convFactor = useMemo(() => {
    if (!stockData) return 1;
    const natCurrency = stockData.currency ?? 'USD';
    const rate = stockData.exchangeRate > 0 ? stockData.exchangeRate : 1350;
    if (natCurrency === 'KRW' && displayCurrency === 'USD') return 1 / rate;
    if (natCurrency === 'USD' && displayCurrency === 'KRW') return rate;
    return 1;
  }, [stockData, displayCurrency]);

  /* ── 가격 포맷 ──────────────────────────────── */
  const fmtPx = useCallback((v: number): string => {
    if (displayCurrency === 'KRW') return `₩${Math.round(v).toLocaleString()}`;
    return `$${v.toFixed(2)}`;
  }, [displayCurrency]);

  /* ── 표시 통화로 변환된 차트 행 ─────────────── */
  const displayChartRows = useMemo((): ChartRow[] => {
    if (!stockData) return [];
    if (convFactor === 1) return stockData.chartRows;
    return stockData.chartRows.map(row => ({
      ...row,
      open:  Math.round(row.open  * convFactor * 100) / 100,
      high:  Math.round(row.high  * convFactor * 100) / 100,
      low:   Math.round(row.low   * convFactor * 100) / 100,
      close: Math.round(row.close * convFactor * 100) / 100,
      sma20: row.sma20 != null ? Math.round(row.sma20 * convFactor * 100) / 100 : row.sma20,
      sma60: row.sma60 != null ? Math.round(row.sma60 * convFactor * 100) / 100 : row.sma60,
    }));
  }, [stockData, convFactor]);

  /* ── 화면 분기 ──────────────────────────────── */
  if (!stockData && isLoading)  return <LoadingScreen ticker={lastTicker} t={t} />;
  if (!stockData && apiError)   return <ErrorScreen ticker={lastTicker} message={apiError} onRetry={() => fetchStockData(lastTicker)} t={t} />;
  if (!stockData) return null;

  const company: CompanyFundamentals = stockData;
  const chartData: MockDataResult = {
    chartRows:   stockData.chartRows,
    allPrices:   stockData.allPrices,
    latestRSI:   stockData.latestRSI,
    latestSMA20: stockData.latestSMA20,
    latestSMA60: stockData.latestSMA60,
  };
  const activeTicker = stockData.ticker;

  /* ─────── 검색 입력 UI (모바일/데스크톱 공용) ─────── */
  const searchUI = (
    <>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder={t.searchPlaceholder}
          className="w-full pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 rounded-xl border outline-none transition-colors"
          style={{ backgroundColor: '#111827', borderColor: '#1f2d3d' }}
        />
      </div>
      <button
        onClick={handleSearch}
        disabled={isLoading}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0 disabled:opacity-60 flex items-center gap-1.5"
        style={{ backgroundColor: '#2563eb' }}
      >
        {isLoading
          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{t.searching}</>
          : t.searchBtn}
      </button>
    </>
  );

  /* ═══════════════════════════════════════════════
   * RENDER
   * ═══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060d1a', color: 'white' }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header
        style={{ borderBottom: '1px solid #1a2535', backgroundColor: 'rgba(6,13,26,0.92)' }}
        className="sticky top-0 z-50 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">

          {/*
           * 레이아웃 전략:
           * · 모바일(< sm): 1행 = 로고 + 우측 버튼, 2행 = 검색창(전체 너비)
           * · sm+         : 1행 = 로고 + 검색창 + 우측 버튼
           *
           * flex-wrap + order-last(검색) 조합으로 2행 분기
           */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">

            {/* 로고 */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <BarChart2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-white text-lg tracking-tight">Stock-er</span>
              <span className="hidden sm:inline-flex text-[11px] text-blue-300 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">
                {t.brandTag}
              </span>
            </div>

            {/*
             * 검색창
             * · 모바일: order-last → 로고/버튼 아래 행, w-full
             * · sm+  : order-none → 로고 다음, flex-1 max-w-sm
             */}
            <div className="order-last w-full flex gap-2 sm:order-none sm:w-auto sm:flex-1 sm:max-w-sm">
              {searchUI}
            </div>

            {/* 우측 도구 */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              {/* 통화 토글 */}
              {stockData && (
                <button
                  onClick={() => setDisplayCurrency(prev => prev === 'KRW' ? 'USD' : 'KRW')}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:border-emerald-500/50 hover:text-emerald-300"
                  style={{ backgroundColor: '#111827', borderColor: '#1f2d3d', color: '#9ca3af' }}
                  title="Toggle display currency"
                >
                  {displayCurrency === 'KRW' ? t.currencyToggleToUSD : t.currencyToggleToKRW}
                </button>
              )}

              {/* 언어 토글 */}
              <button
                onClick={toggleLang}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:border-blue-500/50 hover:text-blue-300"
                style={{ backgroundColor: '#111827', borderColor: '#1f2d3d', color: '#9ca3af' }}
                title="Switch language / 언어 변경"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{lang === 'ko' ? 'EN' : '한국어'}</span>
                <span className="xs:hidden">{lang === 'ko' ? 'EN' : 'KO'}</span>
              </button>

              {/* QA 링크 (sm+에서만 표시) */}
              <Link href="/admin/test-harness"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-600 transition-colors">
                <FlaskConical className="w-3.5 h-3.5" />
                {t.qaLink}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── 면책조항 배너 ───────────────────────── */}
      {bannerVisible && (
        <div className="w-full flex items-center gap-2 px-4 sm:px-6 py-2.5"
          style={{
            backgroundColor: 'rgba(120, 53, 15, 0.25)',
            borderBottom: '1px solid rgba(217, 119, 6, 0.25)',
          }}>
          <span className="text-amber-400 text-sm flex-shrink-0">⚠️</span>
          <p className="text-amber-200/80 text-xs sm:text-sm flex-1 min-w-0 leading-snug">
            {t.bannerText}{' '}
            <Link href="/about"
              className="text-amber-300 font-semibold underline underline-offset-2 decoration-amber-500/50 hover:text-amber-100 transition-colors whitespace-nowrap">
              {t.bannerLink}
            </Link>
          </p>
          <button
            onClick={() => setBannerVisible(false)}
            aria-label="배너 닫기"
            className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-amber-500/70 hover:text-amber-300 hover:bg-amber-500/15 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── 로딩 오버레이 (데이터 교체 시) ─────── */}
      {isLoading && stockData && (
        <div className="fixed top-[57px] sm:top-16 left-0 right-0 z-40 flex items-center justify-center py-2 bg-blue-600/90 backdrop-blur-sm">
          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
          <span className="text-xs font-medium text-white">{t.loadingOverlay(lastTicker)}</span>
        </div>
      )}

      {/* ── MAIN ────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">

        <ProfileCard
          company={company}
          note={stockData.note}
          onRefresh={() => fetchStockData(activeTicker)}
          isLoading={isLoading}
          t={t}
          fmtPx={fmtPx}
          convFactor={convFactor}
        />

        {/* 탭 */}
        <div className="flex gap-1 p-1 rounded-2xl w-fit flex-wrap"
          style={{ backgroundColor: '#0d1929', border: '1px solid #1a2535' }}>
          {([
            { key: 'fundamental' as const, label: t.tabFundamental },
            { key: 'technical'   as const, label: t.tabTechnical },
            { key: 'guru'        as const, label: t.tabGuru },
          ]).map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all"
              style={{
                backgroundColor: activeTab === key ? '#2563eb' : 'transparent',
                color: activeTab === key ? 'white' : '#6b7280',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 펀더멘탈 탭 ─────────────────────────── */}
        {activeTab === 'fundamental' && (
          <div className="space-y-4 sm:space-y-5">
            <SectionDivider label={t.secMetrics} />

            {/* 밸류에이션 지표 4개 — 모바일 1열, md 2열, lg 4열 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <MetricCard t={t} label={t.perLabel} value={company.per}
                industryAvg={company.industryPer} unit="x" description={t.perDesc}
                higherIsBetter={false} />
              <MetricCard t={t} label={t.pbrLabel} value={company.pbr}
                industryAvg={company.industryPbr} unit="x" description={t.pbrDesc}
                higherIsBetter={false} />
              <MetricCard t={t} label={t.roeLabel} value={company.roe}
                industryAvg={company.industryRoe} unit="%" description={t.roeDesc}
                higherIsBetter={true} isPercent={true} />
              <MetricCard t={t} label={t.evLabel} value={company.evEbitda}
                industryAvg={company.industryEvEbitda} unit="x" description={t.evDesc}
                higherIsBetter={false} />
            </div>

            <SectionDivider label={t.secDCF} />

            {/* DCF + 재무건전성 — 모바일 1열, md 3열 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              <div className="md:col-span-2">
                <DCFGauge
                  company={company}
                  params={dcfParams}
                  onParamChange={updateParam}
                  t={t}
                  fmtPx={fmtPx}
                  convFactor={convFactor}
                />
              </div>
              <FinancialHealth company={company} t={t} />
            </div>

            <SectionDivider label={t.secAI} />
            <AIScoreWidget company={company} params={dcfParams} chartData={chartData} t={t} />
          </div>
        )}

        {/* ── 기술적 차트 탭 ──────────────────────── */}
        {activeTab === 'technical' && (
          <div className="space-y-4 sm:space-y-5">
            <SectionDivider label={t.secAI} />
            <AIScoreWidget company={company} params={dcfParams} chartData={chartData} t={t} />

            <SectionDivider label={t.secPriceChart} />
            <PriceChart rows={displayChartRows} fmtPx={fmtPx} t={t} />

            <SectionDivider label={t.secIndicators} />
            {/* RSI + MACD — 모바일 1열, md 2열 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <RSIChart  data={chartData} t={t} />
              <MACDChart data={chartData} t={t} />
            </div>
          </div>
        )}
        {/* ── 대가의 투자 시그널 탭 ──────────────── */}
        {activeTab === 'guru' && (
          <div className="space-y-4 sm:space-y-5">
            <SectionDivider label={t.guruSection} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
              <PegAnalysis    stockData={stockData} t={t} />
              <PiotroskiScore stockData={stockData} t={t} />
              <MagicFormula   stockData={stockData} t={t} />
            </div>
            {/* 면책 미니 배너 */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl px-4 py-3 text-xs text-gray-600 leading-relaxed">
              🔬 대가의 투자법 분석은 공개 학술 알고리즘을 기반으로 한 참고용 계산 결과이며, 실제 투자 결정에 사용하지 마세요.
              PEG 분석은 피터 린치, F-스코어는 조셉 피오트로스키(2000), 마법 공식은 조엘 그린블라트(2005)가 제시한 방법론을 근사 구현합니다.
            </div>
          </div>
        )}

      </main>

      {/* ── FOOTER ──────────────────────────────── */}
      <footer className="mt-8 sm:mt-12 py-5 sm:py-6 text-center px-4" style={{ borderTop: '1px solid #1a2535' }}>
        <p className="text-xs text-gray-700">
          Stock-er · {t.footerData} — {t.footerNote} ·{' '}
          <Link href="/admin/test-harness" className="hover:text-gray-500 transition-colors underline">
            {t.footerQA}
          </Link>
        </p>
      </footer>
    </div>
  );
}
