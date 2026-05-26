'use client';

/**
 * app/page.tsx
 * 메인 대시보드 — 실시간 주식 분석 (API 연동)
 *
 * /api/stock?ticker={ticker} 를 호출하여 실시간 데이터를 받아옵니다.
 * API 호출 실패 시 Mock 폴백 없이 에러 화면을 표시합니다.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
  Area, Cell,
} from 'recharts';
import {
  Search, TrendingUp, TrendingDown, Building2, Users,
  Activity, DollarSign, BarChart2, Target, ArrowUpRight,
  ArrowDownRight, Zap, ChevronRight, SlidersHorizontal,
  Info, FlaskConical, WifiOff, RefreshCw, ServerCrash, X,
} from 'lucide-react';

/* ── 분석 라이브러리 ─────────────────────────── */
import {
  calculateDCF, getValuationLabel, calculateAIScore,
  detectMACross,
} from '@/lib/analysis';
import type { CompanyFundamentals, MockDataResult } from '@/lib/mockData';
import type { StockData } from '@/lib/types';

/* ─────────────────────────────────────────────
 * 빠른 접근 티커 목록 (고정)
 * ───────────────────────────────────────────── */
const QUICK_TICKERS = ['AAPL', 'TSLA', 'MSFT', 'GOOGL'];

/* ─────────────────────────────────────────────
 * 0. 유틸
 * ───────────────────────────────────────────── */
function cn(...c: (string | boolean | undefined | null)[]): string {
  return c.filter(Boolean).join(' ');
}
function fmt(n: number, d = 2) { return n.toFixed(d); }

/* ─────────────────────────────────────────────
 * DCF 파라미터 상태 타입
 * ───────────────────────────────────────────── */
interface DCFUserParams {
  growthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
}

/* ─────────────────────────────────────────────
 * 1. 커스텀 툴팁
 * ───────────────────────────────────────────── */
type TooltipPayload = { dataKey: string; value: number; payload: Record<string, number> };

const PriceTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900 border border-gray-700/80 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-gray-400 mb-2 font-semibold">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4"><span className="text-gray-500">종가</span><span className="text-blue-400 font-bold">${d.close}</span></div>
        <div className="flex justify-between gap-4"><span className="text-gray-500">시가</span><span className="text-gray-300">${d.open}</span></div>
        <div className="flex justify-between gap-4"><span className="text-gray-500">고가</span><span className="text-emerald-400">${d.high}</span></div>
        <div className="flex justify-between gap-4"><span className="text-gray-500">저가</span><span className="text-rose-400">${d.low}</span></div>
        {d.sma20 && <div className="flex justify-between gap-4 pt-1 border-t border-gray-800"><span className="text-gray-500">SMA20</span><span className="text-orange-400">${d.sma20}</span></div>}
        {d.sma60 && <div className="flex justify-between gap-4"><span className="text-gray-500">SMA60</span><span className="text-red-400">${d.sma60}</span></div>}
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-800">
          <span className="text-gray-500">거래량</span>
          <span className="text-gray-300">{((d.volume ?? 0) / 1_000_000).toFixed(1)}M</span>
        </div>
      </div>
    </div>
  );
};

const RSITooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const rsi = payload[0].value;
  const zone = rsi >= 70 ? { t: '과매수', c: 'text-rose-400' } : rsi <= 30 ? { t: '과매도', c: 'text-emerald-400' } : { t: '중립', c: 'text-gray-400' };
  return (
    <div className="bg-gray-900 border border-gray-700/80 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-gray-400 mb-1.5 font-semibold">{label}</p>
      <p className="text-violet-400 font-bold text-sm">RSI: {rsi?.toFixed(2)}</p>
      <p className={cn('mt-1', zone.c)}>{zone.t} 구간</p>
    </div>
  );
};

const MACDTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const macd = payload.find(p => p.dataKey === 'macdLine')?.value;
  const sig  = payload.find(p => p.dataKey === 'signalLine')?.value;
  const hist = payload.find(p => p.dataKey === 'histogram')?.value;
  return (
    <div className="bg-gray-900 border border-gray-700/80 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-gray-400 mb-1.5 font-semibold">{label}</p>
      {macd != null && <div className="flex justify-between gap-4"><span className="text-gray-500">MACD</span><span className="text-blue-400 font-bold">{macd.toFixed(3)}</span></div>}
      {sig  != null && <div className="flex justify-between gap-4"><span className="text-gray-500">Signal</span><span className="text-orange-400">{sig.toFixed(3)}</span></div>}
      {hist != null && <div className="flex justify-between gap-4 pt-1 border-t border-gray-800"><span className="text-gray-500">Hist</span><span className={hist >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{hist.toFixed(3)}</span></div>}
    </div>
  );
};

/* ─────────────────────────────────────────────
 * 2. DCF 파라미터 슬라이더
 * ───────────────────────────────────────────── */
interface SliderProps {
  label: string; sub: string;
  value: number; min: number; max: number; step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  color: string;
}
function ParamSlider({ label, sub, value, min, max, step, format, onChange, color }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div>
          <span className="text-xs font-semibold text-gray-300">{label}</span>
          <span className="text-[10px] text-gray-600 ml-2">{sub}</span>
        </div>
        <span className={cn('text-sm font-bold', color)}>{format(value)}</span>
      </div>
      <div className="relative h-2 bg-gray-800 rounded-full">
        <div className={cn('absolute h-full rounded-full', color.replace('text-', 'bg-'))} style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
      </div>
      <div className="flex justify-between text-[10px] text-gray-700 mt-1">
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 3. DCF 게이지
 * ───────────────────────────────────────────── */
interface DCFGaugeProps {
  company: CompanyFundamentals;
  params: DCFUserParams;
  onParamChange: (p: Partial<DCFUserParams>) => void;
}
function DCFGauge({ company, params, onParamChange }: DCFGaugeProps) {
  const dcfResult = useMemo(() => calculateDCF({
    fcf: company.fcf, shares: company.shares, netDebt: company.netDebt,
    growthRate: params.growthRate, discountRate: params.discountRate,
    terminalGrowthRate: params.terminalGrowthRate,
  }), [company, params]);

  const fairValue = dcfResult.fairValuePerShare;
  const valuation = getValuationLabel(fairValue, company.currentPrice);
  const bearVal = fairValue * 0.70;
  const bullVal = fairValue * 1.40;
  const range   = bullVal - bearVal;
  const curPos  = Math.min(Math.max(((company.currentPrice - bearVal) / range) * 100, 2), 97);

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            DCF 적정 주가 분석
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">현금흐름할인(DCF) 모델 · 슬라이더로 가정치 조정</p>
        </div>
        <div className={cn('px-3 py-1.5 rounded-xl text-sm font-bold border', valuation.bgColor, valuation.borderColor, valuation.color)}>
          {valuation.upsidePct > 0 ? '▲' : '▼'} {Math.abs(valuation.upsidePct).toFixed(1)}% {valuation.label}
        </div>
      </div>

      <div className="relative mt-8 mb-12">
        <div className="h-7 rounded-full bg-gradient-to-r from-rose-600/80 via-amber-500/80 to-emerald-500/80 relative overflow-visible shadow-inner">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-white/60 font-medium select-none">저평가</span>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/60 font-medium select-none">고평가</span>
          <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: '50%' }}>
            <div className="absolute -top-7 transform -translate-x-1/2 whitespace-nowrap">
              <span className="text-[11px] font-bold text-yellow-300 bg-yellow-500/20 border border-yellow-500/40 px-2 py-0.5 rounded-full">
                적정 ${fmt(fairValue)}
              </span>
            </div>
            <div className="w-0.5 h-full bg-yellow-300/80" />
            <div className="absolute -bottom-2 w-2.5 h-2.5 bg-yellow-300 rounded-full transform -translate-x-1/2" style={{ left: '50%' }} />
          </div>
          <div className="absolute top-0 bottom-0" style={{ left: `${curPos}%` }}>
            <div className="w-1 h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            <div className="absolute -bottom-9 transform -translate-x-1/2 whitespace-nowrap" style={{ left: '50%' }}>
              <span className="text-[11px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">
                현재 ${fmt(company.currentPrice)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { l: '🐻 Bear (-30%)', v: `$${fmt(bearVal)}`,              c: 'text-rose-400' },
          { l: '현재 주가',      v: `$${fmt(company.currentPrice)}`, c: 'text-white font-bold' },
          { l: '🐂 Bull (+40%)', v: `$${fmt(bullVal)}`,              c: 'text-emerald-400' },
        ].map(item => (
          <div key={item.l} className="bg-gray-800/50 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-gray-500 mb-1 leading-tight">{item.l}</p>
            <p className={cn('text-sm', item.c)}>{item.v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5 text-center">
        {[
          { l: 'PV of FCFs',     v: `$${(dcfResult.pvOfFCFs / 1000).toFixed(1)}B` },
          { l: 'Terminal Value', v: `$${(dcfResult.pvOfTerminalValue / 1000).toFixed(1)}B` },
          { l: 'EV',             v: `$${(dcfResult.enterpriseValue / 1000).toFixed(1)}B` },
        ].map(item => (
          <div key={item.l} className="bg-gray-800/30 rounded-xl p-2.5">
            <p className="text-[10px] text-gray-600 mb-1">{item.l}</p>
            <p className="text-sm font-bold text-gray-200">{item.v}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800 pt-4 space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">DCF 가정치 조정</span>
          <button className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            onClick={() => onParamChange({
              growthRate: company.defaultGrowthRate,
              discountRate: company.defaultWACC,
              terminalGrowthRate: company.defaultTerminalGrowth,
            })}>
            ↺ 기본값
          </button>
        </div>
        <ParamSlider label="FCF 성장률" sub="예상 연간 잉여현금흐름 성장률"
          value={params.growthRate} min={0.01} max={0.40} step={0.005}
          format={v => `${(v * 100).toFixed(1)}%`}
          onChange={v => onParamChange({ growthRate: v })} color="text-blue-400" />
        <ParamSlider label="할인율 (WACC)" sub="가중평균자본비용"
          value={params.discountRate} min={0.05} max={0.15} step={0.005}
          format={v => `${(v * 100).toFixed(1)}%`}
          onChange={v => onParamChange({ discountRate: v })} color="text-purple-400" />
        <ParamSlider label="영구 성장률" sub="터미널 밸류 영구 성장 가정"
          value={params.terminalGrowthRate} min={0.005} max={0.05} step={0.005}
          format={v => `${(v * 100).toFixed(1)}%`}
          onChange={v => onParamChange({ terminalGrowthRate: v })} color="text-amber-400" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 4. 메트릭 카드
 * ───────────────────────────────────────────── */
function MetricCard({ label, value, industryAvg, unit, description, higherIsBetter = false, isPercent = false }: {
  label: string; value: number; industryAvg: number; unit: string;
  description: string; higherIsBetter?: boolean; isPercent?: boolean;
}) {
  const display    = isPercent ? `${value.toFixed(1)}%` : `${value.toFixed(1)}${unit}`;
  const indDisplay = isPercent ? `${industryAvg.toFixed(1)}%` : `${industryAvg.toFixed(1)}${unit}`;
  const isGood     = higherIsBetter ? value >= industryAvg : value <= industryAvg;
  const diffPct    = Math.abs(((value - industryAvg) / industryAvg) * 100);
  const barWidth   = Math.min((value / (industryAvg * 2)) * 100, 100);

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-5 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
          <p className="text-3xl font-bold text-white mt-1.5 leading-none">{display}</p>
        </div>
        <span className={cn('text-[11px] px-2.5 py-1 rounded-full font-bold',
          isGood ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                 : 'bg-rose-500/15 text-rose-400 border border-rose-500/20')}>
          {isGood ? '양호' : '주의'}
        </span>
      </div>
      <div className="mb-3 relative pt-5">
        <div className="absolute top-0 text-[10px] text-gray-600 transform -translate-x-1/2" style={{ left: '50%' }}>
          업종평균 ({indDisplay})
        </div>
        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden relative">
          <div className={cn('h-full rounded-full transition-all duration-700 ease-out',
            isGood ? 'bg-gradient-to-r from-blue-600 to-blue-400' : 'bg-gradient-to-r from-amber-600 to-amber-400')}
            style={{ width: `${barWidth}%` }} />
        </div>
        <div className="absolute top-5 h-2.5 w-px bg-gray-500" style={{ left: '50%' }} />
      </div>
      <div className="flex items-center justify-between text-xs mt-4">
        <span className="text-gray-500">업종평균 <span className="text-gray-300 font-medium">{indDisplay}</span></span>
        <span className={cn('font-bold', isGood ? 'text-emerald-400' : 'text-rose-400')}>
          {isGood ? (higherIsBetter ? '▲' : '▼') : (higherIsBetter ? '▼' : '▲')} {diffPct.toFixed(1)}%
        </span>
      </div>
      <p className="text-[11px] text-gray-600 mt-3 pt-3 border-t border-gray-800 leading-relaxed">{description}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 5. 재무 건전성 카드
 * ───────────────────────────────────────────── */
function FinancialHealth({ company }: { company: CompanyFundamentals }) {
  const f = company;
  const margins = [
    { label: '매출총이익률', value: f.grossMargin,     grad: 'from-blue-500 to-blue-400',     text: 'text-blue-400' },
    { label: '영업이익률',   value: f.operatingMargin, grad: 'from-purple-500 to-purple-400', text: 'text-purple-400' },
    { label: '순이익률',     value: f.netMargin,       grad: 'from-emerald-500 to-emerald-400', text: 'text-emerald-400' },
  ];
  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-5 h-full flex flex-col">
      <h3 className="text-white font-bold text-base flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-blue-400" />
        수익성 &amp; 재무 건전성
      </h3>
      <div className="space-y-4 flex-1">
        {margins.map(m => (
          <div key={m.label}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400">{m.label}</span>
              <span className={cn('text-sm font-bold', m.text)}>{m.value.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', m.grad)}
                style={{ width: `${Math.min(m.value, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-5 border-t border-gray-800 grid grid-cols-3 gap-2">
        {[
          { label: '배당수익률',    value: f.dividendYield === 0 ? '없음' : `${f.dividendYield.toFixed(2)}%` },
          { label: '부채비율(D/E)', value: f.debtToEquity.toFixed(2) },
          { label: '유동비율',      value: f.currentRatio.toFixed(2) },
        ].map(item => (
          <div key={item.label} className="bg-gray-800/50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-gray-500 mb-1 leading-tight">{item.label}</p>
            <p className="text-sm font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 6. AI 종합 점수 위젯
 * ───────────────────────────────────────────── */
function AIScoreWidget({ company, params, chartData }: {
  company: CompanyFundamentals;
  params: DCFUserParams;
  chartData: MockDataResult;
}) {
  const aiScore = useMemo(() => {
    const dcfFair = calculateDCF({
      fcf: company.fcf, shares: company.shares, netDebt: company.netDebt, ...params,
    }).fairValuePerShare;
    const sma20s = chartData.chartRows.map(r => r.sma20);
    const sma60s = chartData.chartRows.map(r => r.sma60);
    const cross  = detectMACross(sma20s, sma60s, 10);
    return calculateAIScore({
      currentPrice: company.currentPrice, dcfFairValue: dcfFair,
      rsi: chartData.latestRSI, crossSignal: cross,
      per: company.per, industryPer: company.industryPer,
      pbr: company.pbr, industryPbr: company.industryPbr,
    });
  }, [company, params, chartData]);

  const radius = 54;
  const circ   = 2 * Math.PI * radius;
  const dash   = (aiScore.score / 100) * circ;
  const scoreColor = aiScore.score >= 65 ? '#10b981' : aiScore.score >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-6">
      <h3 className="text-white font-bold text-base flex items-center gap-2 mb-5">
        <Zap className="w-4 h-4 text-yellow-400" />
        AI 종합 투자 매력도
        <span className="ml-auto text-[10px] text-gray-600 flex items-center gap-1">
          <Info className="w-3 h-3" /> 슬라이더 조정 시 실시간 갱신
        </span>
      </h3>
      <div className="flex flex-col sm:flex-row gap-6 items-center">
        <div className="relative flex-shrink-0">
          <svg width="140" height="140" className="-rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#1f2937" strokeWidth="10" />
            <circle cx="70" cy="70" r={radius} fill="none" stroke={scoreColor} strokeWidth="10"
              strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.4s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-white">{aiScore.score}</span>
            <span className="text-xs text-gray-500 -mt-1">/ 100</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-2xl font-extrabold mb-2', aiScore.gradeColor)}>{aiScore.grade}</p>
          <div className="bg-gray-800/50 rounded-xl p-3 text-xs text-gray-300 leading-relaxed border border-gray-700/50">
            💡 {aiScore.feedback}
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {aiScore.breakdown.map(item => {
          const pct    = (item.points / item.maxPoints) * 100;
          const barCol = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
          return (
            <div key={item.category}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-300">{item.category}</span>
                <span className="text-xs font-bold text-gray-200">
                  {item.points} <span className="text-gray-600">/ {item.maxPoints}</span>
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-1">
                <div className={cn('h-full rounded-full transition-all duration-700', barCol)} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{item.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 7. 주가 차트
 * ───────────────────────────────────────────── */
function PriceChart({ data }: { data: MockDataResult }) {
  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-white font-bold text-base">주가 차트 + 이동평균선 (SMA)</h3>
        <div className="flex items-center gap-4 text-xs">
          {[
            { color: 'bg-blue-400',   label: '종가' },
            { color: 'bg-orange-400', label: 'SMA20' },
            { color: 'bg-red-400',    label: 'SMA60' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={cn('w-4 h-0.5 inline-block rounded', color)} />
              <span className="text-gray-400">{label}</span>
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data.chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 11 }} tickLine={false} axisLine={false} interval={14} />
          <YAxis tick={{ fill: '#4b5563', fontSize: 11 }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => `$${v}`} domain={['auto', 'auto']} width={62} />
          <Tooltip content={<PriceTooltip />} />
          <Area type="monotone" dataKey="close" fill="url(#priceGrad)" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="sma20" stroke="#f97316" strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="sma60" stroke="#f87171" strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 8. RSI 차트
 * ───────────────────────────────────────────── */
function RSIChart({ data }: { data: MockDataResult }) {
  const rsiVal = data.latestRSI ?? 50;
  const zone   = rsiVal >= 70 ? { t: '과매수', c: 'text-rose-400',    b: 'bg-rose-500/10',    bd: 'border-rose-500/30' }
               : rsiVal <= 30 ? { t: '과매도', c: 'text-emerald-400', b: 'bg-emerald-500/10', bd: 'border-emerald-500/30' }
               : { t: '중립', c: 'text-gray-300', b: 'bg-gray-700/30', bd: 'border-gray-600/30' };
  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-white font-bold text-base">RSI <span className="text-gray-500 font-normal text-sm">(Wilder, 14)</span></h3>
        <div className={cn('text-xs font-bold px-3 py-1 rounded-full border', zone.b, zone.bd, zone.c)}>
          RSI {rsiVal.toFixed(1)} · {zone.t}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={data.chartRows} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 11 }} tickLine={false} axisLine={false} interval={14} />
          <YAxis domain={[0, 100]} tick={{ fill: '#4b5563', fontSize: 11 }} tickLine={false} axisLine={false}
            ticks={[0, 30, 50, 70, 100]} width={28} />
          <Tooltip content={<RSITooltip />} />
          <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.07} />
          <ReferenceArea y1={0}  y2={30}  fill="#10b981" fillOpacity={0.07} />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.5} />
          <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.5} />
          <ReferenceLine y={50} stroke="#374151" strokeDasharray="2 4" strokeOpacity={0.6} />
          <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 9. MACD 차트
 * ───────────────────────────────────────────── */
function MACDChart({ data }: { data: MockDataResult }) {
  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-white font-bold text-base">MACD <span className="text-gray-500 font-normal text-sm">(12, 26, 9)</span></h3>
        <div className="flex items-center gap-3 text-[11px]">
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
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={data.chartRows} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 11 }} tickLine={false} axisLine={false} interval={14} />
          <YAxis tick={{ fill: '#4b5563', fontSize: 11 }} tickLine={false} axisLine={false}
            width={50} tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip content={<MACDTooltip />} />
          <ReferenceLine y={0} stroke="#374151" strokeOpacity={0.8} />
          <Bar dataKey="histogram" maxBarSize={6} radius={[2, 2, 0, 0]}>
            {data.chartRows.map((entry, idx) => (
              <Cell key={idx} fill={(entry.histogram ?? 0) >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.75} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="macdLine"   stroke="#60a5fa" strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="signalLine" stroke="#fb923c" strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 10. 기업 프로필 카드
 * ───────────────────────────────────────────── */
function ProfileCard({ company, note, onRefresh, isLoading }: {
  company: CompanyFundamentals;
  note?: string;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  const isPos  = company.changePercent >= 0;
  const range  = company.week52High - company.week52Low;
  const curPct = range > 0 ? Math.round(((company.currentPrice - company.week52Low) / range) * 100) : 50;

  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-6">
      {/* 데이터 소스 배너 */}
      {note && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{note}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-gray-700 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-7 h-7 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-white">{company.name}</h1>
              <span className="text-xs text-blue-300 bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 rounded-full font-semibold">{company.ticker}</span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{company.exchange}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{company.sector} · {company.industry}</p>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-2xl">{company.description}</p>
          </div>
        </div>

        <div className="lg:text-right flex-shrink-0">
          <div className="flex items-baseline gap-3 lg:justify-end">
            <span className="text-4xl font-bold text-white tracking-tight">${company.currentPrice.toFixed(2)}</span>
            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold',
              isPos ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/25')}>
              {isPos ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {isPos ? '+' : ''}{company.change.toFixed(2)} ({isPos ? '+' : ''}{company.changePercent.toFixed(2)}%)
            </div>
          </div>
          <div className="mt-3 lg:flex lg:flex-col lg:items-end">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 lg:justify-end">
              <span>${company.week52Low}</span>
              <span className="text-gray-600">52주 범위</span>
              <span>${company.week52High}</span>
            </div>
            <div className="w-full lg:w-52 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500"
                style={{ width: `${curPct}%` }} />
            </div>
            <p className="text-[11px] text-gray-600 mt-1">52주 범위의 {curPct}% 위치</p>
          </div>
          {/* 새로고침 버튼 */}
          <button onClick={onRefresh} disabled={isLoading}
            className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-300 transition-colors ml-auto disabled:opacity-40">
            <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
            데이터 새로고침
          </button>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-gray-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '시가총액', value: company.marketCap, Icon: DollarSign, accent: 'text-blue-400' },
          { label: 'P/E 비율', value: `${company.per}x`,  Icon: BarChart2,  accent: 'text-purple-400' },
          { label: '거래량',   value: company.volume,     Icon: Activity,   accent: 'text-emerald-400' },
          { label: '임직원',   value: company.employees,  Icon: Users,      accent: 'text-amber-400' },
        ].map(({ label, value, Icon, accent }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-xl bg-gray-800/70 flex items-center justify-center flex-shrink-0', accent)}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500">{label}</p>
              <p className="text-sm font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 11. 섹션 구분선
 * ───────────────────────────────────────────── */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{label}</p>
      <div className="flex-1 h-px bg-gray-800" />
      <ChevronRight className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 12. 로딩 화면
 * ───────────────────────────────────────────── */
function LoadingScreen({ ticker }: { ticker: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ backgroundColor: '#060d1a' }}>
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
          <BarChart2 className="w-8 h-8 text-white" />
        </div>
        <div className="absolute -inset-2 rounded-3xl border-2 border-blue-500/30 animate-ping" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-lg">{ticker} 분석 중...</p>
        <p className="text-gray-500 text-sm mt-1">실시간 데이터를 불러오고 있습니다</p>
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

/* ─────────────────────────────────────────────
 * 13. 에러 화면 (API 호출 불가)
 * ───────────────────────────────────────────── */
function ErrorScreen({ ticker, message, onRetry }: {
  ticker: string; message: string; onRetry: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ backgroundColor: '#060d1a' }}>
      <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
        <ServerCrash className="w-10 h-10 text-rose-400" />
      </div>
      <div className="text-center max-w-md px-4">
        <p className="text-white font-extrabold text-2xl tracking-tight">API 호출 불가</p>
        <p className="text-gray-400 text-sm mt-2">
          <span className="text-gray-200 font-semibold">{ticker}</span> 데이터를 불러올 수 없습니다.
        </p>
        <div className="mt-4 bg-gray-900/80 border border-gray-800 rounded-2xl px-5 py-4 text-left space-y-1">
          <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold mb-2">오류 상세</p>
          <p className="text-rose-400/90 text-xs font-mono leading-relaxed break-all">{message}</p>
        </div>
        <p className="text-gray-600 text-xs mt-4 leading-relaxed">
          API 키를 확인하거나 잠시 후 다시 시도해 주세요.<br />
          (<span className="text-gray-500">.env.local → STOCK_API_KEY / FINNHUB_API_KEY</span>)
        </p>
      </div>
      <button onClick={onRetry}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl text-sm font-semibold text-white transition-colors shadow-lg shadow-blue-500/20">
        <RefreshCw className="w-4 h-4" />
        다시 시도
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 14. 메인 대시보드 (기본 내보내기)
 * ───────────────────────────────────────────── */
export default function StockDashboard() {
  const [searchInput, setSearchInput] = useState('AAPL');
  const [activeTab, setActiveTab]     = useState<'fundamental' | 'technical'>('fundamental');
  const [bannerVisible, setBannerVisible] = useState(true);

  /* ── API 데이터 상태 ─────────────────────── */
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [lastTicker, setLastTicker] = useState('AAPL');

  /* ── DCF 슬라이더 파라미터 ──────────────── */
  const [dcfParams, setDcfParams] = useState<DCFUserParams>({
    growthRate: 0.09, discountRate: 0.085, terminalGrowthRate: 0.03,
  });

  /* ── 데이터 페치 ────────────────────────── */
  const fetchStockData = useCallback(async (ticker: string) => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setIsLoading(true);
    setApiError(null);
    setLastTicker(t);
    try {
      const res = await fetch(`/api/stock?ticker=${encodeURIComponent(t)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data: StockData = await res.json();
      setStockData(data);
      // 티커별 기본 DCF 파라미터로 리셋
      setDcfParams({
        growthRate:        data.defaultGrowthRate,
        discountRate:      data.defaultWACC,
        terminalGrowthRate: data.defaultTerminalGrowth,
      });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ── 최초 마운트 시 AAPL 로드 ────────────── */
  useEffect(() => {
    fetchStockData('AAPL');
  }, [fetchStockData]);

  const handleSearch = useCallback(() => {
    const t = searchInput.trim().toUpperCase();
    if (t) { setSearchInput(t); fetchStockData(t); }
  }, [searchInput, fetchStockData]);

  const updateParam = useCallback((partial: Partial<DCFUserParams>) => {
    setDcfParams(prev => ({ ...prev, ...partial }));
  }, []);

  /* ── 로딩 중 (초기 데이터 없을 때만 풀스크린) ── */
  if (!stockData && isLoading) return <LoadingScreen ticker={lastTicker} />;

  /* ── 에러 (데이터 없을 때만 풀스크린) ──────── */
  if (!stockData && apiError) return (
    <ErrorScreen ticker={lastTicker} message={apiError} onRetry={() => fetchStockData(lastTicker)} />
  );

  /* ── 초기 데이터 없음 (기술적으로 발생 불가) ── */
  if (!stockData) return null;

  /* ── 컴포넌트 prop 타입 호환 추출 ────────── */
  const company: CompanyFundamentals = stockData;
  const chartData: MockDataResult = {
    chartRows:   stockData.chartRows,
    allPrices:   stockData.allPrices,
    latestRSI:   stockData.latestRSI,
    latestSMA20: stockData.latestSMA20,
    latestSMA60: stockData.latestSMA60,
  };

  const activeTicker = stockData.ticker;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060d1a', color: 'white' }}>

      {/* ── HEADER ───────────────────────────── */}
      <header style={{ borderBottom: '1px solid #1a2535', backgroundColor: 'rgba(6,13,26,0.92)' }}
        className="sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4">

          {/* 로고 */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-white text-lg tracking-tight">Stock-er</span>
            <span className="hidden sm:inline-flex text-[11px] text-blue-300 border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium">
              AI 주가 분석
            </span>
          </div>

          {/* 검색창 */}
          <div className="flex gap-2 flex-1 max-w-sm relative">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input type="text" value={searchInput}
                onChange={e => setSearchInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="티커 입력 (AAPL, TSLA…)"
                className="w-full pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 rounded-xl border outline-none transition-colors"
                style={{ backgroundColor: '#111827', borderColor: '#1f2d3d' }}
              />
            </div>
            <button onClick={handleSearch} disabled={isLoading}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0 disabled:opacity-60 flex items-center gap-1.5"
              style={{ backgroundColor: '#2563eb' }}>
              {isLoading
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> 조회 중</>
                : '검색'}
            </button>
          </div>

          {/* 빠른 접근 버튼 */}
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_TICKERS.map(t => (
              <button key={t}
                onClick={() => { setSearchInput(t); fetchStockData(t); }}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                style={{
                  backgroundColor: activeTicker === t ? '#2563eb' : '#111827',
                  color: activeTicker === t ? 'white' : '#9ca3af',
                  border: `1px solid ${activeTicker === t ? 'transparent' : '#1f2d3d'}`,
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* QA 하네스 링크 */}
          <Link href="/admin/test-harness"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-600 transition-colors">
            <FlaskConical className="w-3.5 h-3.5" />
            QA
          </Link>
        </div>
      </header>

      {/* ── 면책조항 안내 배너 ── */}
      {bannerVisible && (
        <div
          className="w-full flex items-center gap-2 px-4 sm:px-6 py-2.5"
          style={{
            backgroundColor: 'rgba(120, 53, 15, 0.25)',
            borderBottom: '1px solid rgba(217, 119, 6, 0.25)',
          }}
        >
          <span className="text-amber-400 text-sm flex-shrink-0">⚠️</span>
          <p className="text-amber-200/80 text-xs sm:text-sm flex-1 min-w-0 leading-snug">
            본 서비스는 투자 편의를 위한 분석 시스템으로, 투자 결과에 대한 책임을 지지 않습니다.{' '}
            <Link
              href="/about"
              className="text-amber-300 font-semibold underline underline-offset-2 decoration-amber-500/50 hover:text-amber-100 hover:decoration-amber-300 transition-colors whitespace-nowrap"
            >
              서비스 분석 기준 및 면책조항 보기 →
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

      {/* ── 로딩 오버레이 (데이터 있을 때 전환 중) ── */}
      {isLoading && stockData && (
        <div className="fixed top-16 left-0 right-0 z-40 flex items-center justify-center py-2 bg-blue-600/90 backdrop-blur-sm">
          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
          <span className="text-xs font-medium text-white">{lastTicker} 데이터 로딩 중…</span>
        </div>
      )}

      {/* ── MAIN ─────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <ProfileCard
          company={company}
          note={stockData.note}
          onRefresh={() => fetchStockData(activeTicker)}
          isLoading={isLoading}
        />

        {/* 탭 */}
        <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#0d1929', border: '1px solid #1a2535' }}>
          {[
            { key: 'fundamental' as const, label: '📊  기업 펀더멘탈 분석' },
            { key: 'technical'   as const, label: '📈  기술적 차트 분석' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: activeTab === key ? '#2563eb' : 'transparent',
                color: activeTab === key ? 'white' : '#6b7280',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 펀더멘탈 탭 ──────────────────────── */}
        {activeTab === 'fundamental' && (
          <div className="space-y-5 tab-content">
            <SectionDivider label="주요 투자 지표" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard label="PER (주가수익비율)" value={company.per} industryAvg={company.industryPer}
                unit="x" description="낮을수록 이익 대비 저평가. 성장주는 업종 평균보다 높게 형성." higherIsBetter={false} />
              <MetricCard label="PBR (주가순자산비율)" value={company.pbr} industryAvg={company.industryPbr}
                unit="x" description="낮을수록 자산 대비 저평가. 1배 미만은 청산가치 이하를 의미." higherIsBetter={false} />
              <MetricCard label="ROE (자기자본이익률)" value={company.roe} industryAvg={company.industryRoe}
                unit="%" description="높을수록 자본 활용 효율 우수. 워런 버핏이 중요시하는 지표." higherIsBetter={true} isPercent={true} />
              <MetricCard label="EV/EBITDA" value={company.evEbitda} industryAvg={company.industryEvEbitda}
                unit="x" description="기업가치 대비 현금 창출력. M&A 가치평가에 활용되는 부채 중립 지표." higherIsBetter={false} />
            </div>

            <SectionDivider label="DCF 내재가치 분석 (실시간 계산)" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <DCFGauge company={company} params={dcfParams} onParamChange={updateParam} />
              </div>
              <FinancialHealth company={company} />
            </div>

            <SectionDivider label="AI 종합 투자 매력도" />
            <AIScoreWidget company={company} params={dcfParams} chartData={chartData} />
          </div>
        )}

        {/* ── 기술적 차트 탭 ───────────────────── */}
        {activeTab === 'technical' && (
          <div className="space-y-5 tab-content">
            <SectionDivider label="AI 종합 투자 매력도" />
            <AIScoreWidget company={company} params={dcfParams} chartData={chartData} />

            <SectionDivider label="주가 차트 (SMA20 · SMA60)" />
            <PriceChart data={chartData} />

            <SectionDivider label="보조지표 (RSI · MACD)" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <RSIChart  data={chartData} />
              <MACDChart data={chartData} />
            </div>
          </div>
        )}
      </main>

      <footer className="mt-12 py-6 text-center" style={{ borderTop: '1px solid #1a2535' }}>
        <p className="text-xs text-gray-700">
          Stock-er · 실시간 시장 데이터 (Alpha Vantage / Finnhub) — 실제 투자 결정에 활용하지 마세요. ·{' '}
          <Link href="/admin/test-harness" className="hover:text-gray-500 transition-colors underline">
            QA 테스트 하네스
          </Link>
        </p>
      </footer>
    </div>
  );
}
