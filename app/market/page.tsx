'use client';

/**
 * app/market/page.tsx
 * Market Pulse — 실시간 마켓 동향 & 주도 섹터 대시보드
 *
 * · 실시간 마켓 무버 (급등/급락/거래량 Top5 — KR/US)
 * · 주도 섹터 3선 + 대장주·이슈주 인라인 확장 (클릭 펼치기)
 * · 빠른 탐색 동선 → 주식/크립토 개별 분석 페이지
 * · 한국투자증권 KIS / DART API 스위칭을 위한 DomesticStockData 아키텍처
 * · KO / EN 다국어 토글 (localStorage 공유)
 * · 모바일 완전 반응형
 * · 상업용 투자 면책조항 하단 고정
 */

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Globe, TrendingUp, TrendingDown, BarChart2,
  Activity, ChevronDown, ChevronUp, RefreshCw,
  ArrowUpRight, ArrowDownRight, Zap, AlertTriangle,
} from 'lucide-react';

import type { MarketPulseData, MarketMover, TrendingSector, SectorStock } from '@/lib/types';
import { translations, type Lang, type MarketT } from '@/lib/i18n';

/* ─────────────────────────────────────────────
 * 유틸
 * ───────────────────────────────────────────── */
function cn(...c: (string | boolean | undefined | null)[]): string {
  return c.filter(Boolean).join(' ');
}

/** 한국 가격 포맷 */
function fmtKRW(v: number): string {
  return `₩${v.toLocaleString('ko-KR')}`;
}

/** 미국 가격 포맷 */
function fmtUSD(v: number): string {
  if (v >= 1000) return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${v.toFixed(2)}`;
}

/** 통화에 따른 가격 포맷 */
function fmtPrice(v: number, currency: 'KRW' | 'USD'): string {
  return currency === 'KRW' ? fmtKRW(v) : fmtUSD(v);
}

/**
 * 등락률 텍스트 색상
 * - KR: 상승=rose(한국 관례 빨강), 하락=blue(파랑)
 * - US: 상승=emerald(초록), 하락=blue(파랑)
 */
function changeColor(pct: number, market: 'KR' | 'US'): string {
  if (pct === 0) return 'text-gray-400';
  if (pct > 0) return market === 'KR' ? 'text-rose-400' : 'text-emerald-400';
  return 'text-blue-400';
}

/** 등락률 배경 배지 색상 */
function changeBadge(pct: number, market: 'KR' | 'US'): string {
  if (pct === 0) return 'bg-gray-800/60 text-gray-400 border-gray-700/30';
  if (pct > 0)
    return market === 'KR'
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
}

/* ─────────────────────────────────────────────
 * 섹터 색상 맵
 * ───────────────────────────────────────────── */
const SECTOR_COLORS: Record<'blue' | 'violet' | 'amber', {
  card:       string;
  border:     string;
  badge:      string;
  badgeText:  string;
  icon:       string;
  iconBg:     string;
  glow:       string;
  expandBg:   string;
  leaderBadge: string;
  issueBadge: string;
}> = {
  blue: {
    card:        'bg-[#060e1f] hover:border-blue-500/30',
    border:      'border-blue-900/30',
    badge:       'bg-blue-500/10 border-blue-500/20',
    badgeText:   'text-blue-300',
    icon:        'text-blue-400',
    iconBg:      'bg-blue-500/10 border-blue-500/20',
    glow:        'shadow-blue-500/5',
    expandBg:    'bg-blue-950/20',
    leaderBadge: 'bg-blue-500/15 border-blue-500/25 text-blue-300',
    issueBadge:  'bg-cyan-500/15 border-cyan-500/25 text-cyan-300',
  },
  violet: {
    card:        'bg-[#0a0614] hover:border-violet-500/30',
    border:      'border-violet-900/30',
    badge:       'bg-violet-500/10 border-violet-500/20',
    badgeText:   'text-violet-300',
    icon:        'text-violet-400',
    iconBg:      'bg-violet-500/10 border-violet-500/20',
    glow:        'shadow-violet-500/5',
    expandBg:    'bg-violet-950/20',
    leaderBadge: 'bg-violet-500/15 border-violet-500/25 text-violet-300',
    issueBadge:  'bg-fuchsia-500/15 border-fuchsia-500/25 text-fuchsia-300',
  },
  amber: {
    card:        'bg-[#100c00] hover:border-amber-500/30',
    border:      'border-amber-900/30',
    badge:       'bg-amber-500/10 border-amber-500/20',
    badgeText:   'text-amber-300',
    icon:        'text-amber-400',
    iconBg:      'bg-amber-500/10 border-amber-500/20',
    glow:        'shadow-amber-500/5',
    expandBg:    'bg-amber-950/20',
    leaderBadge: 'bg-amber-500/15 border-amber-500/25 text-amber-300',
    issueBadge:  'bg-orange-500/15 border-orange-500/25 text-orange-300',
  },
};

/* ═══════════════════════════════════════════════════════════════
 * 1. MoverRow
 * ═══════════════════════════════════════════════════════════════ */
function MoverRow({
  mover, market, showVolume,
}: {
  mover: MarketMover;
  market: 'kr' | 'us';
  showVolume: boolean;
}) {
  const mkt = market === 'kr' ? 'KR' : 'US';
  const isPos = mover.changePercent > 0;
  const isNeg = mover.changePercent < 0;
  const arrow = isPos
    ? <ArrowUpRight className="w-3 h-3 flex-shrink-0" />
    : isNeg
    ? <ArrowDownRight className="w-3 h-3 flex-shrink-0" />
    : null;

  return (
    <div className={cn(
      'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3',
      'border-b border-gray-800/40 last:border-b-0',
      'hover:bg-white/[0.02] transition-colors',
    )}>
      {/* 순위 */}
      <span className={cn(
        'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
        mover.rank === 1
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          : mover.rank === 2
          ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
          : mover.rank === 3
          ? 'bg-orange-700/20 text-orange-400 border border-orange-700/30'
          : 'bg-gray-800/60 text-gray-600 border border-gray-700/30',
      )}>
        {mover.rank}
      </span>

      {/* 종목명 + 거래소 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs sm:text-sm font-semibold text-white truncate">{mover.name}</span>
          <span className="text-[10px] text-gray-600 bg-gray-800/60 px-1.5 py-0.5 rounded-md flex-shrink-0">
            {mover.exchange}
          </span>
        </div>
        <span className="text-[10px] text-gray-600 font-mono">{mover.ticker}</span>
      </div>

      {/* 현재가 */}
      <div className="text-right flex-shrink-0">
        <p className="text-xs sm:text-sm font-bold text-white">
          {fmtPrice(mover.currentPrice, mover.currency)}
        </p>
        {showVolume && (
          <p className="text-[10px] text-gray-600">{mover.volume}</p>
        )}
      </div>

      {/* 등락률 배지 */}
      <div className={cn(
        'flex-shrink-0 flex items-center gap-0.5',
        'text-xs font-bold px-2 py-1 rounded-lg border',
        changeBadge(mover.changePercent, mkt),
      )}>
        {arrow}
        <span>{mover.changePercent > 0 ? '+' : ''}{mover.changePercent.toFixed(2)}%</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 2. MarketMoversSection
 * ═══════════════════════════════════════════════════════════════ */
type MarketKey   = 'kr' | 'us';
type CategoryKey = 'gainers' | 'losers' | 'volume';

function MarketMoversSection({
  data, t,
}: {
  data: MarketPulseData;
  t: MarketT;
}) {
  const [marketTab,   setMarketTab]   = useState<MarketKey>('kr');
  const [categoryTab, setCategoryTab] = useState<CategoryKey>('gainers');

  const movers: MarketMover[] = data.movers[marketTab][categoryTab];
  const isVolume = categoryTab === 'volume';

  const mktBtns: { key: MarketKey; label: string }[] = [
    { key: 'kr', label: t.tabKR },
    { key: 'us', label: t.tabUS },
  ];
  const catBtns: { key: CategoryKey; label: string; icon: React.ReactNode }[] = [
    { key: 'gainers', label: t.tabGainers, icon: <TrendingUp className="w-3 h-3" /> },
    { key: 'losers',  label: t.tabLosers,  icon: <TrendingDown className="w-3 h-3" /> },
    { key: 'volume',  label: t.tabVolume,  icon: <Activity className="w-3 h-3" /> },
  ];

  return (
    <div className="bg-[#080d1c] border border-teal-900/30 rounded-2xl overflow-hidden shadow-lg shadow-teal-500/3">
      {/* 헤더 */}
      <div className="px-4 sm:px-5 py-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-sm sm:text-base">{t.moversTitle}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{t.moversSub}</p>
          </div>
          {/* KR 데이터 출처 배지 */}
          {marketTab === 'kr' && (
            data.dataSource === 'live' ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/25 text-emerald-400 flex-shrink-0">
                KIS Live
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-gray-800/60 border-gray-700/40 text-gray-500 flex-shrink-0">
                Mock
              </span>
            )
          )}
        </div>
      </div>

      {/* KR / US 탭 */}
      <div className="flex border-b border-gray-800/50">
        {mktBtns.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMarketTab(key)}
            className={cn(
              'flex-1 py-2.5 text-xs sm:text-sm font-semibold transition-colors',
              marketTab === key
                ? 'text-teal-300 bg-teal-500/8 border-b-2 border-teal-400'
                : 'text-gray-500 hover:text-gray-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 급등/급락/거래량 탭 */}
      <div className="flex border-b border-gray-800/50">
        {catBtns.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setCategoryTab(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors',
              categoryTab === key
                ? key === 'gainers'
                  ? marketTab === 'kr' ? 'text-rose-400 bg-rose-500/5 border-b border-rose-500/40'
                                       : 'text-emerald-400 bg-emerald-500/5 border-b border-emerald-500/40'
                  : key === 'losers'
                  ? 'text-blue-400 bg-blue-500/5 border-b border-blue-500/40'
                  : 'text-amber-400 bg-amber-500/5 border-b border-amber-500/40'
                : 'text-gray-600 hover:text-gray-400',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* 행 목록 */}
      <div>
        {movers.map(mover => (
          <MoverRow
            key={mover.ticker}
            mover={mover}
            market={marketTab}
            showVolume={isVolume}
          />
        ))}
      </div>

      {/* 색상 규칙 안내 */}
      <div className="px-4 py-2.5 border-t border-gray-800/40">
        <p className="text-[10px] text-gray-700 text-center">{t.gainNote}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 3. SectorStockCard — 섹터 내 개별 종목 카드
 * ═══════════════════════════════════════════════════════════════ */
function SectorStockCard({
  stock, colorKey, lang, t,
}: {
  stock: SectorStock;
  colorKey: 'blue' | 'violet' | 'amber';
  lang: Lang;
  t: MarketT;
}) {
  const cs = SECTOR_COLORS[colorKey];
  const isLeader = stock.role === 'leader';
  const isPos = stock.changePercent >= 0;

  return (
    <div className={cn(
      'rounded-xl border p-3 sm:p-4 flex flex-col gap-2.5',
      cs.expandBg,
      isLeader ? cs.border : 'border-gray-700/30',
    )}>
      {/* 역할 배지 + 거래소 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0',
          isLeader ? cs.leaderBadge : cs.issueBadge,
        )}>
          {isLeader ? t.leaderTag : t.issueTag}
        </span>
        <span className="text-[10px] text-gray-600 bg-gray-800/60 px-1.5 py-0.5 rounded-md">
          {stock.exchange}
        </span>
        <span className="text-[10px] text-gray-600 font-mono">{stock.ticker}</span>
      </div>

      {/* 종목명 + 가격 */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-white leading-tight">{stock.name}</p>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-white">
            {fmtPrice(stock.currentPrice, stock.currency)}
          </p>
          <p className={cn('text-[11px] font-semibold flex items-center gap-0.5 justify-end',
            changeColor(stock.changePercent, stock.market))}>
            {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {isPos ? '+' : ''}{stock.changePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* 선정 사유 */}
      <div className="border-t border-gray-800/40 pt-2">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">
          {t.reasonLabel}
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">
          {lang === 'ko' ? stock.reason.ko : stock.reason.en}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 4-A. SectorSummaryCard — 섹터 요약 카드 (컴팩트, 3열 그리드용)
 *
 * 핵심 결정: 확장 패널을 이 카드 안에 두지 않음.
 * 이유: md:grid-cols-3 컬럼 너비(~280px)에서 긴 선정 사유 텍스트와
 *       sm:grid-cols-2 종목 카드가 동시에 렌더링될 때 콘텐츠가 컬럼
 *       경계를 벗어나는 overflow 문제가 발생한다.
 * 해결: 확장 패널을 그리드 외부(TrendingSectorsSection)에서 전체 너비로 렌더링.
 * ═══════════════════════════════════════════════════════════════ */
function SectorSummaryCard({
  sector, lang, t, isActive, onToggle,
}: {
  sector: TrendingSector;
  lang: Lang;
  t: MarketT;
  isActive: boolean;
  onToggle: () => void;
}) {
  const cs = SECTOR_COLORS[sector.colorKey];

  return (
    <div className={cn(
      'border rounded-2xl overflow-hidden transition-colors duration-200 shadow-lg',
      cs.card,
      /* 활성 섹터는 테두리를 밝게 */
      isActive ? cn(cs.border, '[box-shadow:0_0_0_1px_inset_rgba(255,255,255,0.06)]') : cs.border,
    )}>
      {/* 요약 본문 */}
      <div className="p-4">
        {/* 이모지 + 섹터명 */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            'w-10 h-10 rounded-xl border flex items-center justify-center text-xl flex-shrink-0',
            cs.iconBg,
          )}>
            {sector.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-bold text-sm leading-tight">
              {lang === 'ko' ? sector.name.ko : sector.name.en}
            </h3>
            <p className={cn('text-[10px] mt-0.5 font-semibold leading-relaxed', cs.badgeText)}>
              {lang === 'ko' ? sector.theme.ko : sector.theme.en}
            </p>
          </div>
        </div>

        {/* 선정 이유 — 2줄 클램프 */}
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mb-3">
          {lang === 'ko' ? sector.reason.ko : sector.reason.en}
        </p>

        {/* 대장주·이슈주 미리보기 칩 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {sector.stocks.map(s => (
            <span key={s.ticker}
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                s.role === 'leader' ? cs.leaderBadge : cs.issueBadge,
              )}>
              {s.role === 'leader' ? t.leaderTag : t.issueTag}: {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* 토글 버튼 */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold',
          'border-t transition-colors',
          'border-gray-800/50',
          isActive
            ? cn(cs.badgeText, cs.expandBg, 'hover:brightness-110')
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]',
        )}
      >
        {isActive
          ? <><ChevronUp className="w-3.5 h-3.5" /> {t.closeDetail}</>
          : <><ChevronDown className="w-3.5 h-3.5" /> {t.viewDetail}</>
        }
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 4-B. SectorDetailPanel — 전체 너비 확장 패널
 *
 * 그리드 바깥에서 렌더링되므로 페이지 전체 너비를 자유롭게 사용.
 * sm:grid-cols-2 종목 카드와 긴 선정 사유 텍스트 모두 오버플로 없이 표시됨.
 * ═══════════════════════════════════════════════════════════════ */
function SectorDetailPanel({
  sector, lang, t, onClose,
}: {
  sector: TrendingSector;
  lang: Lang;
  t: MarketT;
  onClose: () => void;
}) {
  const cs = SECTOR_COLORS[sector.colorKey];

  return (
    <div className={cn(
      'mt-3 rounded-2xl border overflow-hidden shadow-xl',
      cs.expandBg,
      cs.border,
    )}>
      {/* 패널 헤더: 섹터명 + 닫기 버튼 */}
      <div className={cn(
        'flex items-center justify-between gap-3',
        'px-4 sm:px-5 py-3 border-b border-gray-800/50',
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{sector.emoji}</span>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">
              {lang === 'ko' ? sector.name.ko : sector.name.en}
            </p>
            <p className={cn('text-[10px] font-semibold truncate', cs.badgeText)}>
              {lang === 'ko' ? sector.theme.ko : sector.theme.en}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors',
            'text-gray-400 border-gray-700/50 hover:text-white hover:border-gray-500',
          )}
        >
          <ChevronUp className="w-3.5 h-3.5" />
          {t.closeDetail}
        </button>
      </div>

      {/* 종목 카드 그리드 — 전체 너비이므로 sm:grid-cols-2 안전 */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {sector.stocks.map(stock => (
            <SectorStockCard
              key={stock.ticker}
              stock={stock}
              colorKey={sector.colorKey}
              lang={lang}
              t={t}
            />
          ))}
        </div>

        {/* 섹터 선정 이유 — 전체 텍스트 (클램프 없음) */}
        <div className="mt-4 pt-4 border-t border-gray-800/40">
          <p className="text-[11px] text-gray-600 leading-relaxed">
            💡 {lang === 'ko' ? sector.reason.ko : sector.reason.en}
          </p>
          <p className="text-[10px] text-gray-700 mt-2">
            📊 {t.sectorsNote}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 5. TrendingSectorsSection
 * ═══════════════════════════════════════════════════════════════ */
function TrendingSectorsSection({
  sectors, lang, t,
}: {
  sectors: TrendingSector[];
  lang: Lang;
  t: MarketT;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const activeSector = sectors.find(s => s.id === expandedId) ?? null;

  return (
    <div>
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-3 mb-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
          {t.sectorsTitle}
        </p>
        <div className="flex-1 h-px bg-gray-800" />
        <TrendingUp className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
      </div>
      <p className="text-sm text-gray-400 mb-1">{t.sectorsSub}</p>
      <p className="text-[11px] text-gray-600 mb-4 leading-relaxed">
        📊 {t.sectorsNote}
      </p>

      {/* ── 섹터 요약 카드 그리드 (모바일 1열, sm 3열) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {sectors.map(sector => (
          <SectorSummaryCard
            key={sector.id}
            sector={sector}
            lang={lang}
            t={t}
            isActive={expandedId === sector.id}
            onToggle={() => toggle(sector.id)}
          />
        ))}
      </div>

      {/* ── 전체 너비 확장 패널 (그리드 외부 — 오버플로 없음) ── */}
      {activeSector && (
        <SectorDetailPanel
          key={activeSector.id}
          sector={activeSector}
          lang={lang}
          t={t}
          onClose={() => setExpandedId(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 6. SectionDivider
 * ═══════════════════════════════════════════════════════════════ */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
        {label}
      </p>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 7. QuickNavSection — 개별 분석 페이지 이동 동선
 * ═══════════════════════════════════════════════════════════════ */
function QuickNavSection({ t }: { t: MarketT }) {
  return (
    <div className="bg-[#080d1c] border border-gray-800/50 rounded-2xl p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
          <BarChart2 className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">{t.quickNavTitle}</h3>
          <p className="text-gray-500 text-xs mt-0.5">{t.quickNavSub}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/"
          className={cn(
            'flex items-center justify-center gap-2',
            'px-4 py-3 rounded-xl font-semibold text-sm',
            'bg-blue-600/90 hover:bg-blue-500 text-white',
            'border border-blue-500/30 transition-colors',
            'shadow-lg shadow-blue-500/10',
          )}>
          {t.toStockBtn}
        </Link>
        <Link href="/crypto"
          className={cn(
            'flex items-center justify-center gap-2',
            'px-4 py-3 rounded-xl font-semibold text-sm',
            'bg-violet-600/90 hover:bg-violet-500 text-white',
            'border border-violet-500/30 transition-colors',
            'shadow-lg shadow-violet-500/10',
          )}>
          {t.toCryptoBtn}
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 8. MarketDisclaimerBox — 상업용 투자 면책조항
 * ═══════════════════════════════════════════════════════════════ */
function MarketDisclaimerBox({ t }: { t: MarketT }) {
  return (
    <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/30 to-red-950/20 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="text-orange-300 font-bold text-xs sm:text-sm mb-1.5">
            {t.disclaimerTitle}
          </h3>
          <p className="text-orange-200/70 text-[11px] sm:text-xs leading-relaxed">
            {t.disclaimerBody}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 9. 로딩·에러 스켈레톤
 * ═══════════════════════════════════════════════════════════════ */
function LoadingView({ t }: { t: MarketT }) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-teal-500/30">
          <BarChart2 className="w-6 h-6 text-white" />
        </div>
        <div className="absolute -inset-2 rounded-3xl border-2 border-teal-500/30 animate-ping" />
      </div>
      <p className="text-gray-400 text-sm">{t.loading}</p>
    </div>
  );
}

function ErrorView({ t, onRetry }: { t: MarketT; onRetry: () => void }) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 text-center">
      <p className="text-white font-bold text-lg">{t.errorTitle}</p>
      <p className="text-gray-500 text-sm">{t.errorHint}</p>
      <button onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl text-sm font-semibold text-white transition-colors">
        <RefreshCw className="w-4 h-4" />
        {t.retryBtn}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * 10. Main: MarketPulseDashboard
 * ═══════════════════════════════════════════════════════════════ */
export default function MarketPulseDashboard() {
  /* ── 언어 ──────────────────────────── */
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
  const t = translations[lang].market;

  /* ── 데이터 페치 ────────────────────── */
  const [data,      setData]      = useState<MarketPulseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/market');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MarketPulseData = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─────────────── RENDER ─────────────────── */
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060d1a', color: 'white' }}>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header
        style={{ borderBottom: '1px solid #1a2535', backgroundColor: 'rgba(6,13,26,0.92)' }}
        className="sticky top-0 z-50 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">

            {/* 로고 */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
                <BarChart2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-white text-lg tracking-tight">Stock-er</span>
              <span className="hidden sm:inline-flex text-[11px] text-teal-300 border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 rounded-full font-medium">
                {t.brandTag}
              </span>
            </div>

            {/* GNB 탭: Market(active) / Stocks / Crypto */}
            <div className="flex gap-0.5 p-0.5 rounded-xl flex-shrink-0"
              style={{ backgroundColor: '#0d1a20', border: '1px solid #1a3040' }}>
              <div className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white">
                {t.navMarket}
              </div>
              <Link href="/"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors">
                {t.navStock}
              </Link>
              <Link href="/crypto"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors">
                {t.navCrypto}
              </Link>
            </div>

            {/* 언어 토글 */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={toggleLang}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:border-teal-500/50 hover:text-teal-300"
                style={{ backgroundColor: '#111827', borderColor: '#1f2d3d', color: '#9ca3af' }}
                title="Switch language / 언어 변경"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{lang === 'ko' ? 'EN' : '한국어'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── 데이터 안내 배너 (live/mock 분기) ──────────────── */}
      {data?.dataSource === 'live' ? (
        /* 실시간 KIS 연동 중 — 초록 배너 */
        <div className="w-full flex items-start gap-2 px-4 sm:px-6 py-2.5"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.07)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.20)',
          }}>
          <span className="text-emerald-400 text-sm flex-shrink-0 mt-0.5">🟢</span>
          <p className="text-emerald-200/80 text-xs leading-relaxed">
            {t.dataBannerLive}
          </p>
        </div>
      ) : (
        /* 시뮬레이션 / KIS 미연결 — 기존 teal 배너 */
        <div className="w-full flex items-start gap-2 px-4 sm:px-6 py-2.5"
          style={{
            backgroundColor: 'rgba(13, 148, 136, 0.08)',
            borderBottom: '1px solid rgba(20, 184, 166, 0.15)',
          }}>
          <span className="text-teal-400 text-sm flex-shrink-0 mt-0.5">💡</span>
          <p className="text-teal-200/70 text-xs leading-relaxed">
            {t.dataBannerText}
          </p>
        </div>
      )}

      {/* ── MAIN ────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6 sm:space-y-8">

        {/* ── 히어로 ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {t.heroTitle}
              </h1>
              {/* dataSource에 따른 배지 색상/문구 분기 */}
              {data?.dataSource === 'live' ? (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                  {t.heroBadgeLive}
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-300">
                  {t.heroBadge}
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm sm:text-base">{t.heroSub}</p>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-xs text-gray-600 flex-shrink-0">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full animate-pulse',
                data.dataSource === 'live' ? 'bg-emerald-400' : 'bg-teal-400',
              )} />
              {new Date(data.fetchedAt).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          )}
        </div>

        {/* ── 본문 ────────────────────────────────────────────── */}
        {isLoading ? (
          <LoadingView t={t} />
        ) : error ? (
          <ErrorView t={t} onRetry={fetchData} />
        ) : data ? (
          <>
            {/* 마켓 무버 + 트렌딩 섹터 — lg 이상 2열 */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6 items-start">
              {/* 마켓 무버 (lg: 2/5) */}
              <div className="lg:col-span-2">
                <MarketMoversSection data={data} t={t} />
              </div>

              {/* 트렌딩 섹터 (lg: 3/5) */}
              <div className="lg:col-span-3">
                <TrendingSectorsSection sectors={data.sectors} lang={lang} t={t} />
              </div>
            </div>

            {/* 빠른 탐색 */}
            <SectionDivider label={t.quickNavTitle} />
            <QuickNavSection t={t} />

            {/* 면책조항 */}
            <MarketDisclaimerBox t={t} />
          </>
        ) : null}
      </main>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="mt-8 py-5 text-center px-4" style={{ borderTop: '1px solid #1a2535' }}>
        <p className="text-xs text-gray-700">
          Stock-er · Market Pulse — {t.footerNote}
        </p>
      </footer>
    </div>
  );
}
