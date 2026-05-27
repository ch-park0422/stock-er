'use client';

/**
 * app/about/page.tsx
 * 서비스 분석 기준 및 투자 면책조항 안내 페이지
 * KO / EN 언어 토글 지원
 */

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart2, Calculator, AlertTriangle,
  Activity, Info, ChevronRight, Globe,
} from 'lucide-react';
import { translations, type Lang, type AboutT } from '@/lib/i18n';

/* ── 유틸 ── */
function cn(...c: (string | boolean | undefined | null)[]): string {
  return c.filter(Boolean).join(' ');
}

/* ─────────────────────────────────────────────
 * 섹션 헤더 컴포넌트
 * ───────────────────────────────────────────── */
function SectionHeader({
  num, icon: Icon, title, subtitle, accent,
}: {
  num: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border', accent)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-0.5">
          SECTION {num}
        </p>
        <h2 className="text-white font-extrabold text-xl tracking-tight leading-tight">{title}</h2>
        <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 밸류에이션 지표 카드 (PER / PBR / ROE)
 * ───────────────────────────────────────────── */
function ValuationCard({
  emoji, name, fullName, color, accent, summary, detail, example, goodLabel, badLabel,
}: {
  emoji: string; name: string; fullName: string;
  color: string; accent: string;
  summary: string; detail: string; example: string;
  goodLabel: string; badLabel: string;
}) {
  return (
    <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-5 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{emoji}</span>
        <div>
          <h3 className={cn('text-lg font-extrabold', color)}>{name}</h3>
          <p className="text-[11px] text-gray-600">{fullName}</p>
        </div>
      </div>
      <p className="text-gray-300 text-sm leading-relaxed mb-3">{summary}</p>
      <p className="text-gray-500 text-xs leading-relaxed mb-4">{detail}</p>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 border bg-emerald-500/5 border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-xs text-gray-400">{goodLabel}</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 border bg-rose-500/5 border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
          <span className="text-xs text-gray-400">{badLabel}</span>
        </div>
      </div>
      <div className={cn('mt-auto rounded-xl p-3 border text-[11px] leading-relaxed', accent)}>
        💡 {example}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 메인 페이지 (Client Component)
 * ───────────────────────────────────────────── */
export default function AboutPage() {
  /* ── 언어 상태 ─────────────────────────────── */
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
  const t: AboutT = translations[lang].about;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060d1a', color: 'white' }}>

      {/* ── 상단 헤더 (Sticky) ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md"
        style={{ borderBottom: '1px solid #1a2535', backgroundColor: 'rgba(6,13,26,0.95)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t.backBtn}
          </Link>
          <span className="text-gray-800 select-none">/</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <BarChart2 className="w-3 h-3 text-white" />
            </div>
            <span className="font-extrabold text-white text-sm">Stock-er</span>
          </div>
          <span className="text-gray-700 text-xs">{t.pageSlug}</span>

          {/* 언어 토글 */}
          <button onClick={toggleLang}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:border-blue-500/50 hover:text-blue-300"
            style={{ backgroundColor: '#111827', borderColor: '#1f2d3d', color: '#9ca3af' }}
            title="Switch language / 언어 변경">
            <Globe className="w-3.5 h-3.5" />
            {lang === 'ko' ? 'EN' : '한국어'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-20">

        {/* ── HERO ── */}
        <div className="text-center pt-4 pb-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full mb-6">
            <Info className="w-3.5 h-3.5" />
            {t.heroBadge}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-[1.1]">
            {t.heroTitle}
          </h1>
          <p className="text-gray-400 text-lg mt-5 max-w-2xl mx-auto leading-relaxed">
            {t.heroSubtitle}
          </p>
          <p className="text-gray-600 text-sm mt-2">{t.heroNote}</p>

          {/* 섹션 목차 */}
          <div className="mt-8 inline-flex flex-wrap justify-center gap-2 text-xs">
            {([
              { href: '#fundamental', idx: 0, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20' },
              { href: '#technical',   idx: 1, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20' },
              { href: '#disclaimer', idx: 2, color: 'text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20' },
            ] as const).map(({ href, idx, color }) => (
              <a key={href} href={href}
                className={cn('px-3 py-1.5 rounded-full border font-semibold transition-colors', color)}>
                {t.toc[idx]}
              </a>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
         * SECTION 01 — 기업 펀더멘탈 분석 기준
         * ═══════════════════════════════════════════ */}
        <section id="fundamental" className="scroll-mt-20">
          <SectionHeader
            num={t.s1Num}
            icon={Calculator}
            title={t.s1Title}
            subtitle={t.s1Sub}
            accent="bg-blue-500/10 text-blue-400 border-blue-500/25"
          />

          {/* PER / PBR / ROE 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <ValuationCard
              emoji={t.perEmoji} name={t.perName} fullName={t.perFull}
              color="text-blue-400"
              accent="bg-blue-500/8 border border-blue-500/20 text-gray-500"
              summary={t.perSummary} detail={t.perDetail} example={t.perExample}
              goodLabel={t.perGood} badLabel={t.perBad}
            />
            <ValuationCard
              emoji={t.pbrEmoji} name={t.pbrName} fullName={t.pbrFull}
              color="text-purple-400"
              accent="bg-purple-500/8 border border-purple-500/20 text-gray-500"
              summary={t.pbrSummary} detail={t.pbrDetail} example={t.pbrExample}
              goodLabel={t.pbrGood} badLabel={t.pbrBad}
            />
            <ValuationCard
              emoji={t.roeEmoji} name={t.roeName} fullName={t.roeFull}
              color="text-amber-400"
              accent="bg-amber-500/8 border border-amber-500/20 text-gray-500"
              summary={t.roeSummary} detail={t.roeDetail} example={t.roeExample}
              goodLabel={t.roeGood} badLabel={t.roeBad}
            />
          </div>

          {/* DCF 모델 상세 카드 */}
          <div className="bg-[#0d1929] border border-blue-500/20 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">{t.dcfCardTitle}</h3>
                <p className="text-gray-500 text-xs">{t.dcfCardSub}</p>
              </div>
              <span className="ml-auto text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full font-semibold">
                {t.dcfBadge}
              </span>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed mt-4 mb-7">
              {t.dcfIntro}
            </p>

            {/* 플로우 시각화 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-stretch mb-2">
              {([
                { item: t.dcfSteps[0], color: 'text-blue-400',   bg: 'bg-blue-500/8 border-blue-500/20' },
                null,
                { item: t.dcfSteps[1], color: 'text-purple-400', bg: 'bg-purple-500/8 border-purple-500/20' },
                null,
                { item: t.dcfSteps[2], color: 'text-amber-400',  bg: 'bg-amber-500/8 border-amber-500/20' },
              ] as const).map((entry, i) =>
                entry === null ? (
                  <div key={i} className="hidden sm:flex items-center justify-center text-gray-700 text-2xl">
                    →
                  </div>
                ) : (
                  <div key={i} className={cn('rounded-xl border p-4 text-center', entry.bg)}>
                    <p className={cn('text-xs font-black mb-2', entry.color)}>{entry.item.step}</p>
                    <p className="text-white text-sm font-bold leading-tight mb-2">{entry.item.label}</p>
                    <p className="text-gray-500 text-[11px] leading-relaxed">{entry.item.desc}</p>
                  </div>
                )
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 py-4 px-1">
              {t.dcfFormula.split('→').map((part, i, arr) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-gray-700">→</span>}
                  <span className={i === arr.length - 1 ? 'text-blue-400 font-bold' : ''}>{part.trim()}</span>
                </React.Fragment>
              ))}
            </div>

            <p className="text-xs text-gray-500 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 mb-6">
              📌 {t.dcfNote}
            </p>

            {/* 파라미터 설명 3열 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-gray-800">
              {([
                { color: 'text-blue-400',   border: 'border-blue-500/20',   ...t.dcfParams[0] },
                { color: 'text-purple-400', border: 'border-purple-500/20', ...t.dcfParams[1] },
                { color: 'text-amber-400',  border: 'border-amber-500/20',  ...t.dcfParams[2] },
              ] as const).map(item => (
                <div key={item.label} className={cn('bg-gray-900/60 rounded-xl p-4 border', item.border)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('text-sm font-bold', item.color)}>{item.label}</span>
                    <span className="text-[11px] text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                      {item.range}
                    </span>
                  </div>
                  <p className="text-gray-500 text-[12px] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
         * SECTION 02 — 기술적 차트 분석 기준
         * ═══════════════════════════════════════════ */}
        <section id="technical" className="scroll-mt-20">
          <SectionHeader
            num={t.s2Num}
            icon={Activity}
            title={t.s2Title}
            subtitle={t.s2Sub}
            accent="bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* 이동평균선 (SMA) 카드 */}
            <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">📈</span>
                <div>
                  <h3 className="text-white font-bold text-base">{t.s2SmaTitle}</h3>
                  <p className="text-[11px] text-gray-600">{t.s2SmaSub}</p>
                </div>
                <span className="ml-auto text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {t.s2SmaBadge}
                </span>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                {t.s2SmaIntro}
              </p>

              {/* 이동평균선 시각화 */}
              <div className="relative h-16 rounded-xl overflow-hidden bg-gray-900/60 border border-gray-800 mb-5">
                <svg viewBox="0 0 280 64" className="w-full h-full" preserveAspectRatio="none">
                  <path d="M0,52 Q70,50 140,38 Q210,26 280,20"
                    stroke="#f87171" strokeWidth="1.8" fill="none" strokeOpacity={0.7} />
                  <path d="M0,58 Q70,52 140,36 Q210,20 280,12"
                    stroke="#f97316" strokeWidth="1.8" fill="none" strokeOpacity={0.7} />
                  <circle cx="140" cy="37" r="4" fill="#10b981" opacity={0.9} />
                  <line x1="140" y1="0" x2="140" y2="64"
                    stroke="#10b981" strokeWidth="0.8" strokeDasharray="3,2" strokeOpacity={0.6} />
                  <text x="4"   y="60" fill="#6b7280" fontSize="7">{t.s2SmaLegendShort}</text>
                  <text x="148" y="60" fill="#10b981" fontSize="7">{t.s2SmaLegendLong}</text>
                </svg>
              </div>

              <div className="space-y-3">
                {/* 골든크로스 */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">✨</span>
                    <span className="text-emerald-400 font-bold text-sm">{t.s2GoldenTitle}</span>
                    <span className="ml-auto text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      {t.s2GoldenBadge}
                    </span>
                  </div>
                  <p className="text-gray-500 text-[12px] leading-relaxed">{t.s2GoldenDesc}</p>
                </div>

                {/* 데드크로스 */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">💀</span>
                    <span className="text-rose-400 font-bold text-sm">{t.s2DeadTitle}</span>
                    <span className="ml-auto text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                      {t.s2DeadBadge}
                    </span>
                  </div>
                  <p className="text-gray-500 text-[12px] leading-relaxed">{t.s2DeadDesc}</p>
                </div>
              </div>
            </div>

            {/* RSI 카드 */}
            <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="text-white font-bold text-base">{t.s2RsiTitle}</h3>
                  <p className="text-[11px] text-gray-600">{t.s2RsiSub}</p>
                </div>
                <span className="ml-auto text-[11px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                  {t.s2RsiBadge}
                </span>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-5">{t.s2RsiIntro}</p>

              {/* RSI 게이지 */}
              <div className="mb-5">
                <div className="relative h-10 rounded-full overflow-hidden mb-2" style={{ background: '#111827' }}>
                  <div className="absolute inset-y-0 left-0 w-[30%] bg-gradient-to-r from-emerald-700/50 to-emerald-500/30" />
                  <div className="absolute inset-y-0 right-0 w-[30%] bg-gradient-to-l from-rose-700/50 to-rose-500/30" />
                  <div className="absolute inset-y-0 left-[30%] w-px bg-gray-600/60" />
                  <div className="absolute inset-y-0 left-[70%] w-px bg-gray-600/60" />
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-[30%] text-center text-[11px] font-bold text-emerald-400">{t.s2RsiZone1}</span>
                    <span className="w-[40%] text-center text-[11px] text-gray-500">{t.s2RsiZone2}</span>
                    <span className="w-[30%] text-center text-[11px] font-bold text-rose-400">{t.s2RsiZone3}</span>
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-700 px-1">
                  <span>0</span><span>30</span><span className="text-gray-600">50</span><span>70</span><span>100</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                  <span className="text-xl flex-shrink-0">📉</span>
                  <div>
                    <p className="text-emerald-400 font-bold text-sm mb-1">{t.s2OversoldTitle}</p>
                    <p className="text-gray-500 text-[12px] leading-relaxed">{t.s2OversoldDesc}</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl bg-rose-500/5 border border-rose-500/20 p-4">
                  <span className="text-xl flex-shrink-0">📈</span>
                  <div>
                    <p className="text-rose-400 font-bold text-sm mb-1">{t.s2OverboughtTitle}</p>
                    <p className="text-gray-500 text-[12px] leading-relaxed">{t.s2OverboughtDesc}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI 점수 100점 구성표 */}
          <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xl">🤖</span>
              <div>
                <h3 className="text-white font-bold">{t.s2AiTitle}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{t.s2AiSub}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { color: 'text-blue-400',   bg: 'bg-blue-500/8 border-blue-500/20',   ...t.s2AiItems[0] },
                { color: 'text-violet-400', bg: 'bg-violet-500/8 border-violet-500/20', ...t.s2AiItems[1] },
                { color: 'text-emerald-400',bg: 'bg-emerald-500/8 border-emerald-500/20', ...t.s2AiItems[2] },
                { color: 'text-amber-400',  bg: 'bg-amber-500/8 border-amber-500/20',  ...t.s2AiItems[3] },
              ] as const).map(item => (
                <div key={item.label} className={cn('rounded-xl border p-4 text-center', item.bg)}>
                  <p className={cn('text-3xl font-black leading-none', item.color)}>{item.pts}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{lang === 'ko' ? '점' : 'pts'}</p>
                  <p className={cn('text-xs font-bold mt-2 leading-tight', item.color)}>{item.label}</p>
                  <p className="text-gray-600 text-[11px] mt-1.5 leading-tight">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 text-xs text-gray-600 bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{t.s2AiGradeNote}</span>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
         * SECTION 03 — 투자 유의사항 및 면책조항
         * ═══════════════════════════════════════════ */}
        <section id="disclaimer" className="scroll-mt-20">
          <SectionHeader
            num={t.s3Num}
            icon={AlertTriangle}
            title={t.s3Title}
            subtitle={t.s3Sub}
            accent="bg-rose-500/15 text-rose-400 border-rose-500/30"
          />

          {/* 메인 면책 박스 */}
          <div className="rounded-2xl border-2 border-rose-500/40 bg-rose-500/5 p-6 sm:p-8 mb-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-rose-200 font-extrabold text-xl">{t.s3WarnTitle}</h3>
                <p className="text-rose-400/70 text-sm mt-0.5">{t.s3WarnSub}</p>
              </div>
            </div>

            {/* 법적 면책조항 */}
            <div className="bg-rose-950/40 border border-rose-500/25 rounded-xl p-5 sm:p-6 mb-6">
              <p className="text-rose-100/90 text-sm sm:text-base leading-[1.9] font-medium">
                {(() => {
                  // as readonly string[] — union literal 배열에서 string 배열로 넓혀 includes() 사용
                  const hl = t.s3DisclaimerHighlights as readonly string[];
                  const hlSet = new Set<string>(hl);
                  const parts = t.s3Disclaimer.split(
                    new RegExp(`(${hl.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`)
                  );
                  return parts.map((part, i) =>
                    hlSet.has(part) ? (
                      <strong key={i} className="text-white underline decoration-rose-400/50 underline-offset-2">
                        {part}
                      </strong>
                    ) : (
                      <React.Fragment key={i}>{part}</React.Fragment>
                    )
                  );
                })()}
              </p>
            </div>

            {/* 세부 유의사항 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {t.s3Details.map(item => (
                <div key={item.title}
                  className="flex gap-3 bg-gray-900/50 border border-gray-800/70 rounded-xl p-4">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-gray-200 font-semibold text-sm mb-1">{item.title}</p>
                    <p className="text-gray-500 text-[12px] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 추가 안내 */}
          <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-5 text-sm text-gray-500 leading-relaxed">
            <p className="flex items-start gap-2">
              <Info className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
              {t.s3AddNote}
            </p>
          </div>
        </section>

        {/* ── 하단 돌아가기 버튼 ── */}
        <div className="flex justify-center pb-4">
          <Link href="/"
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 hover:bg-gray-800/50 transition-all text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" />
            {t.backBtnBottom}
          </Link>
        </div>
      </main>

      <footer className="py-6 text-center" style={{ borderTop: '1px solid #1a2535' }}>
        <p className="text-xs text-gray-700">
          Stock-er · {t.footerNote}
        </p>
      </footer>
    </div>
  );
}
