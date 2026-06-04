'use client';

/**
 * app/crypto/page.tsx
 * 가상화폐 분석 대시보드
 *
 * · 온체인 지표 근사치: NVT 비율 / MVRV Z-스코어 / 퓨엘 멀티플
 * · 기술적 차트: 가격 + EMA 20/50/200 리본 + Stochastic RSI
 * · KO / EN 다국어 토글
 * · 모바일 반응형
 */

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import {
  Search, RefreshCw, Globe, ArrowUpRight, ArrowDownRight,
  TrendingUp, BarChart2, ServerCrash, Activity,
} from 'lucide-react';

import type { CryptoData, CryptoChartRow, CryptoMetric } from '@/lib/types';
import { translations, type Lang, type CryptoT } from '@/lib/i18n';

/* ─────────────────────────────────────────────
 * 유틸
 * ───────────────────────────────────────────── */
function cn(...c: (string | boolean | undefined | null)[]): string {
  return c.filter(Boolean).join(' ');
}

/** 가격 포맷: BTC($100k+) ~ SHIB($0.0000…) 모두 대응 */
function fmtPrice(v: number): string {
  if (v >= 10000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (v >= 1000)  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (v >= 1)     return `$${v.toFixed(2)}`;
  if (v >= 0.01)  return `$${v.toFixed(4)}`;
  if (v >= 0.0001) return `$${v.toFixed(6)}`;
  return `$${v.toFixed(10)}`;
}

/** Y축 눈금 포맷 (차트용) */
function fmtAxis(v: number): string {
  if (v >= 100000) return `$${(v / 1000).toFixed(0)}k`;
  if (v >= 1000)   return `$${(v / 1000).toFixed(1)}k`;
  if (v >= 1)      return `$${v.toFixed(0)}`;
  if (v >= 0.01)   return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

/* ─────────────────────────────────────────────
 * 차트 툴팁
 * ───────────────────────────────────────────── */
function CryptoPriceTooltip({ active, payload, label, t }: {
  active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; t: CryptoT;
}) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find(p => p.dataKey === k)?.value;
  const close  = get('close');
  const ema20  = get('ema20');
  const ema50  = get('ema50');
  const ema200 = get('ema200');
  return (
    <div className="bg-gray-950 border border-violet-900/50 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-gray-400 mb-2 font-semibold">{label}</p>
      <div className="space-y-1">
        {close  != null && <div className="flex justify-between gap-4"><span className="text-gray-500">{t.close}</span><span className="text-violet-400 font-bold">{fmtPrice(close)}</span></div>}
        {ema20  != null && <div className="flex justify-between gap-4 pt-1 border-t border-gray-800"><span className="text-cyan-500/80">{t.ema20Label}</span><span className="text-cyan-400">{fmtPrice(ema20)}</span></div>}
        {ema50  != null && <div className="flex justify-between gap-4"><span className="text-amber-500/80">{t.ema50Label}</span><span className="text-amber-400">{fmtPrice(ema50)}</span></div>}
        {ema200 != null && <div className="flex justify-between gap-4"><span className="text-rose-500/80">{t.ema200Label}</span><span className="text-rose-400">{fmtPrice(ema200)}</span></div>}
      </div>
    </div>
  );
}

function StochTooltip({ active, payload, label, t }: {
  active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; t: CryptoT;
}) {
  if (!active || !payload?.length) return null;
  const k = payload.find(p => p.dataKey === 'stochK')?.value;
  const d = payload.find(p => p.dataKey === 'stochD')?.value;
  const zone = (v: number | undefined) =>
    v == null ? null
    : v >= 80 ? { text: t.overbought, c: 'text-rose-400' }
    : v <= 20 ? { text: t.oversold,   c: 'text-cyan-400' }
    : { text: t.neutralZone, c: 'text-gray-400' };
  const zk = zone(k);
  return (
    <div className="bg-gray-950 border border-violet-900/50 rounded-xl p-3 text-xs shadow-2xl">
      <p className="text-gray-400 mb-2 font-semibold">{label}</p>
      <div className="space-y-1">
        {k != null && <div className="flex justify-between gap-4"><span className="text-violet-400">%K</span><span className="text-violet-300 font-bold">{k.toFixed(1)}</span></div>}
        {d != null && <div className="flex justify-between gap-4"><span className="text-orange-400">%D</span><span className="text-orange-300">{d.toFixed(1)}</span></div>}
        {zk && <p className={cn('mt-1 pt-1 border-t border-gray-800', zk.c)}>{zk.text} {t.zone}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 온체인 카드
 * ───────────────────────────────────────────── */
const SIGNAL_STYLE: Record<CryptoMetric['signal'], {
  bg: string; border: string; text: string; glow: string;
}> = {
  cold:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/10' },
  normal:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
  caution: { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   glow: 'shadow-amber-500/10' },
  hot:     { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    glow: 'shadow-rose-500/10' },
};

function OnChainCard({
  emoji, title, fullName, desc, guide, metric, signalLabels, indicatorZones,
}: {
  emoji: string;
  title: string;
  fullName: string;
  desc: string;
  guide: string;
  metric: CryptoMetric;
  signalLabels: Record<string, string>;
  indicatorZones: string[];
}) {
  const s = SIGNAL_STYLE[metric.signal];
  return (
    <div className={cn(
      'bg-[#0a0f1e] border rounded-2xl p-4 sm:p-5 flex flex-col gap-3 transition-shadow',
      s.border, `shadow-lg ${s.glow}`,
    )}>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            <h3 className="text-white font-bold text-sm">{title}</h3>
          </div>
          <p className="text-[10px] text-gray-600 mt-0.5">{fullName}</p>
        </div>
        <span className={cn(
          'flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border',
          s.bg, s.border, s.text,
        )}>
          {signalLabels[metric.signal] ?? metric.signal}
        </span>
      </div>

      {/* 수치 */}
      <div>
        <p className={cn('text-4xl font-black leading-none', s.text)}>
          {metric.value}
        </p>
        <p className="text-[11px] text-gray-500 mt-1 leading-tight">{desc}</p>
      </div>

      {/* 인디케이터 바 */}
      <div className="space-y-2">
        <div className="relative h-3 rounded-full overflow-hidden"
          style={{ background: 'linear-gradient(to right, #22d3ee, #10b981, #f59e0b, #ef4444)' }}>
          {/* 마커 */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-4 bg-white rounded shadow-lg"
            style={{ left: `clamp(0px, calc(${metric.barPct}% - 5px), calc(100% - 10px))` }}
          />
          {/* 구간 구분선 */}
          {[33, 66].map(p => (
            <div key={p} className="absolute top-0 bottom-0 w-px bg-black/20" style={{ left: `${p}%` }} />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-gray-600">
          {indicatorZones.map(z => <span key={z}>{z}</span>)}
        </div>
      </div>

      {/* 가이드 설명 */}
      <p className="text-[10px] text-gray-600 leading-relaxed border-t border-gray-800/60 pt-2">
        {guide}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 가격 + EMA 리본 차트
 * ───────────────────────────────────────────── */
function CryptoPriceChart({ rows, t }: { rows: CryptoChartRow[]; t: CryptoT }) {
  const legend = [
    { color: 'bg-violet-400', label: t.close },
    { color: 'bg-cyan-400',   label: t.ema20Label },
    { color: 'bg-amber-400',  label: t.ema50Label },
    { color: 'bg-rose-400',   label: t.ema200Label },
  ];
  return (
    <div className="bg-[#0a0f1e] border border-violet-900/30 rounded-2xl p-3 sm:p-5">
      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-2">
        <h3 className="text-white font-bold text-sm sm:text-base">{t.priceChartTitle}</h3>
        <div className="flex items-center gap-3 sm:gap-4 text-xs flex-wrap">
          {legend.map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={cn('w-3 sm:w-4 h-0.5 inline-block rounded', color)} />
              <span className="text-gray-400 text-[11px] sm:text-xs">{label}</span>
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cryptoPriceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#7c3aed" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1f35" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false} axisLine={false} interval={14} />
          <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={fmtAxis} domain={['auto', 'auto']} width={70} />
          <Tooltip content={<CryptoPriceTooltip t={t} />} />
          <Area type="monotone" dataKey="close" fill="url(#cryptoPriceGrad)"
            stroke="#7c3aed" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ema20"  stroke="#22d3ee"
            strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="ema50"  stroke="#f59e0b"
            strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="ema200" stroke="#f87171"
            strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Stochastic RSI 차트
 * ───────────────────────────────────────────── */
function StochRSIChart({ rows, latestK, latestD, t }: {
  rows: CryptoChartRow[];
  latestK: number | null;
  latestD: number | null;
  t: CryptoT;
}) {
  const kVal  = latestK ?? 50;
  const zone  = kVal >= 80
    ? { text: t.overbought, c: 'text-rose-400',  b: 'bg-rose-500/10',    bd: 'border-rose-500/30' }
    : kVal <= 20
    ? { text: t.oversold,   c: 'text-cyan-400',  b: 'bg-cyan-500/10',    bd: 'border-cyan-500/30' }
    : { text: t.neutralZone, c: 'text-gray-300', b: 'bg-gray-700/30',    bd: 'border-gray-600/30' };

  return (
    <div className="bg-[#0a0f1e] border border-violet-900/30 rounded-2xl p-3 sm:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3 flex-wrap gap-2">
        <h3 className="text-white font-bold text-sm sm:text-base">
          {t.stochTitle}{' '}
          <span className="text-gray-500 font-normal text-xs sm:text-sm">{t.stochSub}</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', zone.b, zone.bd, zone.c)}>
            %K {kVal.toFixed(1)} · {zone.text}
          </div>
          {latestD != null && (
            <div className="text-xs text-orange-400 font-semibold">
              %D {latestD.toFixed(1)}
            </div>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-3 mb-2">
        {[
          { color: 'bg-violet-400', label: '%K' },
          { color: 'bg-orange-400', label: '%D (signal)' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn('w-4 h-0.5 inline-block rounded', color)} />
            <span className="text-gray-500 text-[11px]">{label}</span>
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={rows} margin={{ top: 5, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1f35" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false} axisLine={false} interval={14} />
          <YAxis domain={[0, 100]} tick={{ fill: '#4b5563', fontSize: 10 }}
            tickLine={false} axisLine={false} ticks={[0, 20, 50, 80, 100]} width={24} />
          <Tooltip content={<StochTooltip t={t} />} />
          <ReferenceArea y1={80} y2={100} fill="#ef4444" fillOpacity={0.07} />
          <ReferenceArea y1={0}  y2={20}  fill="#22d3ee" fillOpacity={0.07} />
          <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.5}
            label={{ value: t.overbought, position: 'insideTopRight', fill: '#ef4444', fontSize: 9 }} />
          <ReferenceLine y={20} stroke="#22d3ee" strokeDasharray="4 3" strokeOpacity={0.5}
            label={{ value: t.oversold,   position: 'insideBottomRight', fill: '#22d3ee', fontSize: 9 }} />
          <ReferenceLine y={50} stroke="#374151" strokeDasharray="2 4" strokeOpacity={0.5} />
          <Line type="monotone" dataKey="stochK" stroke="#a78bfa"
            strokeWidth={2} dot={false} connectNulls name="%K" />
          <Line type="monotone" dataKey="stochD" stroke="#fb923c"
            strokeWidth={1.5} dot={false} connectNulls strokeDasharray="4 2" name="%D" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 크립토 프로필 카드
 * ───────────────────────────────────────────── */
function CryptoProfileCard({
  data, onRefresh, isLoading, t,
}: {
  data: CryptoData;
  onRefresh: () => void;
  isLoading: boolean;
  t: CryptoT;
}) {
  const isPos  = data.changePercent >= 0;
  const range  = data.week52High - data.week52Low;
  const curPct = range > 0
    ? Math.round(((data.currentPrice - data.week52Low) / range) * 100)
    : 50;

  return (
    <div className="bg-[#0a0f1e] border border-violet-900/30 rounded-2xl p-4 sm:p-6">
      <div className="flex flex-col md:flex-row md:items-start gap-4 sm:gap-6">
        {/* 코인 이름 & 티커 */}
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-violet-600/30 to-purple-800/30 border border-violet-700/30 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">₿</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-white">{data.name}</h1>
              <span className="text-xs text-violet-300 bg-violet-500/15 border border-violet-500/25 px-2 py-0.5 rounded-full font-semibold">
                {data.ticker}
              </span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {data.currency}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1.5">
              {t.week52Range}: {fmtPrice(data.week52Low)} – {fmtPrice(data.week52High)}
            </p>
          </div>
        </div>

        {/* 가격 & 변동 */}
        <div className="md:text-right flex-shrink-0">
          <div className="flex items-baseline gap-2 sm:gap-3 md:justify-end flex-wrap">
            <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
              {fmtPrice(data.currentPrice)}
            </span>
            <div className={cn(
              'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-bold',
              isPos ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
            )}>
              {isPos
                ? <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                : <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              <span className="whitespace-nowrap">
                {isPos ? '+' : ''}{fmtPrice(Math.abs(data.change))} ({isPos ? '+' : ''}{data.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* 52주 범위 바 */}
          <div className="mt-2 sm:mt-3 md:flex md:flex-col md:items-end">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 md:justify-end">
              <span className="text-[11px]">{fmtPrice(data.week52Low)}</span>
              <span className="text-gray-600 text-[10px]">{t.week52Range}</span>
              <span className="text-[11px]">{fmtPrice(data.week52High)}</span>
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
      <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-violet-900/20 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {([
          { label: t.marketCap,  value: data.marketCap,  emoji: '🏦', accent: 'text-violet-400' },
          { label: t.volume24h,  value: data.volume,     emoji: '📊', accent: 'text-cyan-400' },
          { label: '52W High',   value: fmtPrice(data.week52High), emoji: '📈', accent: 'text-emerald-400' },
          { label: '52W Low',    value: fmtPrice(data.week52Low),  emoji: '📉', accent: 'text-rose-400' },
        ] as const).map(({ label, value, emoji, accent }) => (
          <div key={label} className="flex items-center gap-2 sm:gap-3">
            <div className={cn('w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gray-800/60 flex items-center justify-center flex-shrink-0 text-base', accent)}>
              {emoji}
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

/* ─────────────────────────────────────────────
 * 기술 지표 요약 배지 행
 * ───────────────────────────────────────────── */
function TechSummaryRow({ data, t }: { data: CryptoData; t: CryptoT }) {
  const items = [
    { label: 'RSI (14)',   value: data.latestRSI,    fmt: (v: number) => v.toFixed(1),   color: (v: number) => v >= 70 ? 'text-rose-400' : v <= 30 ? 'text-cyan-400' : 'text-gray-300' },
    { label: 'EMA 20',    value: data.latestEMA20,   fmt: fmtPrice, color: (_v: number) => 'text-cyan-400' },
    { label: 'EMA 50',    value: data.latestEMA50,   fmt: fmtPrice, color: (_v: number) => 'text-amber-400' },
    { label: 'EMA 200',   value: data.latestEMA200,  fmt: fmtPrice, color: (_v: number) => 'text-rose-400' },
    { label: 'Stoch %K',  value: data.latestStochK,  fmt: (v: number) => v.toFixed(1),   color: (v: number) => v >= 80 ? 'text-rose-400' : v <= 20 ? 'text-cyan-400' : 'text-violet-400' },
    { label: 'Stoch %D',  value: data.latestStochD,  fmt: (v: number) => v.toFixed(1),   color: (_v: number) => 'text-orange-400' },
  ] as const;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {items.map(({ label, value, fmt, color }) => (
        <div key={label}
          className="bg-[#0a0f1e] border border-violet-900/20 rounded-xl p-2 sm:p-3 text-center">
          <p className="text-[9px] sm:text-[10px] text-gray-600 mb-0.5 uppercase tracking-wider">{label}</p>
          <p className={cn('text-xs sm:text-sm font-bold', value != null ? color(value) : 'text-gray-700')}>
            {value != null ? fmt(value) : '—'}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 로딩 & 에러 화면
 * ───────────────────────────────────────────── */
function LoadingScreen({ ticker, t }: { ticker: string; t: CryptoT }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4"
      style={{ backgroundColor: '#060d1a' }}>
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-xl shadow-violet-500/30">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <div className="absolute -inset-2 rounded-3xl border-2 border-violet-500/30 animate-ping" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-lg">{t.loadingTitle(ticker)}</p>
        <p className="text-gray-500 text-sm mt-1">{t.loadingSubtitle}</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function ErrorScreen({ ticker, message, onRetry, t }: {
  ticker: string; message: string; onRetry: () => void; t: CryptoT;
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
        <div className="mt-4 bg-gray-900/80 border border-gray-800 rounded-2xl px-4 sm:px-5 py-4 text-left">
          <p className="text-rose-400/90 text-xs font-mono leading-relaxed break-all">{message}</p>
        </div>
        <p className="text-gray-600 text-xs mt-4 leading-relaxed">
          지원 예시: BTC, ETH, SOL, BNB, XRP, DOGE, ADA…
        </p>
      </div>
      <button onClick={onRetry}
        className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 rounded-xl text-sm font-semibold text-white transition-colors shadow-lg shadow-violet-500/20">
        <RefreshCw className="w-4 h-4" />
        {t.retryBtn}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 메인 대시보드
 * ───────────────────────────────────────────── */
export default function CryptoDashboard() {
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
  const t = translations[lang].crypto;

  /* ── UI 상태 ────────────────────────────────── */
  const [searchInput, setSearchInput] = useState('BTC');
  const [cryptoData, setCryptoData]   = useState<CryptoData | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [apiError, setApiError]       = useState<string | null>(null);
  const [lastTicker, setLastTicker]   = useState('BTC');

  /* ── 데이터 페치 ────────────────────────────── */
  const fetchData = useCallback(async (rawTicker: string) => {
    const q = rawTicker.trim();
    if (!q) return;
    setIsLoading(true);
    setApiError(null);
    setLastTicker(q);
    try {
      const res = await fetch(`/api/crypto?ticker=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data: CryptoData = await res.json();
      setCryptoData(data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData('BTC'); }, [fetchData]);

  const handleSearch = useCallback(() => {
    const q = searchInput.trim();
    if (q) fetchData(q);
  }, [searchInput, fetchData]);

  /* ── 검색 UI ────────────────────────────────── */
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
          style={{ backgroundColor: '#0d1120', borderColor: '#2d1f4a' }}
        />
      </div>
      <button
        onClick={handleSearch}
        disabled={isLoading}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0 disabled:opacity-60 flex items-center gap-1.5"
        style={{ backgroundColor: '#7c3aed' }}
      >
        {isLoading
          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{t.searching}</>
          : t.searchBtn}
      </button>
    </>
  );

  /* ── 화면 분기 ──────────────────────────────── */
  if (!cryptoData && isLoading)  return <LoadingScreen ticker={lastTicker} t={t} />;
  if (!cryptoData && apiError)   return (
    <ErrorScreen ticker={lastTicker} message={apiError} onRetry={() => fetchData(lastTicker)} t={t} />
  );

  /* ═══════════════════════════════════════════════
   * RENDER
   * ═══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060d1a', color: 'white' }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header
        style={{ borderBottom: '1px solid #1a1f35', backgroundColor: 'rgba(6,10,26,0.93)' }}
        className="sticky top-0 z-50 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">

            {/* 로고 */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-white text-lg tracking-tight">Stock-er</span>
              <span className="hidden sm:inline-flex text-[11px] text-violet-300 border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 rounded-full font-medium">
                {t.brandTag}
              </span>
            </div>

            {/* GNB 탭 */}
            <div className="flex gap-0.5 p-0.5 rounded-xl flex-shrink-0"
              style={{ backgroundColor: '#0d1120', border: '1px solid #2d1f4a' }}>
              <Link href="/"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors">
                {t.navStock}
              </Link>
              <div className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white">
                {t.navCrypto}
              </div>
            </div>

            {/* 검색창 */}
            <div className="order-last w-full flex gap-2 sm:order-none sm:w-auto sm:flex-1 sm:max-w-sm">
              {searchUI}
            </div>

            {/* 언어 토글 */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              <button
                onClick={toggleLang}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:border-violet-500/50 hover:text-violet-300"
                style={{ backgroundColor: '#0d1120', borderColor: '#2d1f4a', color: '#9ca3af' }}
                title="Switch language / 언어 변경"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{lang === 'ko' ? 'EN' : '한국어'}</span>
                <span className="xs:hidden">{lang === 'ko' ? 'EN' : 'KO'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── 로딩 오버레이 ─────────────────────────── */}
      {isLoading && cryptoData && (
        <div className="fixed top-[57px] sm:top-16 left-0 right-0 z-40 flex items-center justify-center py-2 bg-violet-700/90 backdrop-blur-sm">
          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
          <span className="text-xs font-medium text-white">{lastTicker} 데이터 로딩 중…</span>
        </div>
      )}

      {/* ── MAIN ────────────────────────────────────── */}
      {cryptoData && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">

          {/* 프로필 카드 */}
          <CryptoProfileCard
            data={cryptoData}
            onRefresh={() => fetchData(cryptoData.ticker)}
            isLoading={isLoading}
            t={t}
          />

          {/* 기술 지표 요약 배지 */}
          <TechSummaryRow data={cryptoData} t={t} />

          {/* ── 온체인 기본적 분석 ─────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                {t.onChainTitle}
              </p>
              <div className="flex-1 h-px bg-gray-800" />
              <Activity className="w-3.5 h-3.5 text-violet-700 flex-shrink-0" />
            </div>
            <p className="text-xs text-gray-600 mb-3">{t.onChainSub}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <OnChainCard
                emoji="🔗"
                title={t.nvtTitle}
                fullName={t.nvtFullName}
                desc={t.nvtDesc}
                guide={t.nvtGuide}
                metric={cryptoData.nvt}
                signalLabels={t.signalLabels}
                indicatorZones={t.indicatorZones as string[]}
              />
              <OnChainCard
                emoji="⚖️"
                title={t.mvrvTitle}
                fullName={t.mvrvFullName}
                desc={t.mvrvDesc}
                guide={t.mvrvGuide}
                metric={cryptoData.mvrv}
                signalLabels={t.signalLabels}
                indicatorZones={t.indicatorZones as string[]}
              />
              <OnChainCard
                emoji="⛏️"
                title={t.puellTitle}
                fullName={t.puellFullName}
                desc={t.puellDesc}
                guide={t.puellGuide}
                metric={cryptoData.puell}
                signalLabels={t.signalLabels}
                indicatorZones={t.indicatorZones as string[]}
              />
            </div>

            {/* 면책 노트 */}
            <p className="text-[10px] text-gray-700 mt-2 leading-relaxed">
              {t.onChainNote}
            </p>
          </div>

          {/* ── 기술적 차트 ────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                Technical Chart
              </p>
              <div className="flex-1 h-px bg-gray-800" />
              <BarChart2 className="w-3.5 h-3.5 text-violet-700 flex-shrink-0" />
            </div>

            <div className="space-y-4 sm:space-y-5">
              <CryptoPriceChart rows={cryptoData.chartRows} t={t} />
              <StochRSIChart
                rows={cryptoData.chartRows}
                latestK={cryptoData.latestStochK}
                latestD={cryptoData.latestStochD}
                t={t}
              />
            </div>
          </div>

        </main>
      )}

      {/* ── FOOTER ──────────────────────────────────── */}
      <footer className="mt-8 sm:mt-12 py-5 sm:py-6 text-center px-4"
        style={{ borderTop: '1px solid #1a1f35' }}>
        <p className="text-xs text-gray-700">
          Stock-er · {t.footerData} — {t.footerNote}
        </p>
        <p className="text-[10px] text-gray-800 mt-1">{t.disclaimer}</p>
      </footer>
    </div>
  );
}
