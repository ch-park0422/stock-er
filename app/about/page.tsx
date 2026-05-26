/**
 * app/about/page.tsx
 * 서비스 분석 기준 및 투자 면책조항 안내 페이지
 *
 * Server Component — 정적 콘텐츠만 포함하므로 'use client' 불필요
 */

import Link from 'next/link';
import {
  ArrowLeft, BarChart2, Calculator, AlertTriangle,
  Activity, Info, ChevronRight,
} from 'lucide-react';

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
      <div className={cn(
        'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border',
        accent,
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-0.5">
          SECTION {num}
        </p>
        <h2 className="text-white font-extrabold text-xl tracking-tight leading-tight">
          {title}
        </h2>
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
        <div className={cn(
          'flex items-center gap-2.5 rounded-xl px-3 py-2 border',
          'bg-emerald-500/8 border-emerald-500/20',
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-xs text-gray-400">{goodLabel}</span>
        </div>
        <div className={cn(
          'flex items-center gap-2.5 rounded-xl px-3 py-2 border',
          'bg-rose-500/8 border-rose-500/20',
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
          <span className="text-xs text-gray-400">{badLabel}</span>
        </div>
      </div>

      <div className={cn(
        'mt-auto rounded-xl p-3 border text-[11px] leading-relaxed',
        accent,
      )}>
        💡 {example}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 메인 페이지
 * ───────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060d1a', color: 'white' }}>

      {/* ── 상단 헤더 (Sticky) ── */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{ borderBottom: '1px solid #1a2535', backgroundColor: 'rgba(6,13,26,0.95)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            메인으로
          </Link>
          <span className="text-gray-800 select-none">/</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <BarChart2 className="w-3 h-3 text-white" />
            </div>
            <span className="font-extrabold text-white text-sm">Stock-er</span>
          </div>
          <span className="text-gray-700 text-xs">서비스 안내</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-20">

        {/* ── HERO ── */}
        <div className="text-center pt-4 pb-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full mb-6">
            <Info className="w-3.5 h-3.5" />
            분석 기준 투명 공개
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-[1.1]">
            어떻게 분석하나요?
          </h1>
          <p className="text-gray-400 text-lg mt-5 max-w-2xl mx-auto leading-relaxed">
            Stock-er가 주가를 평가하는 기준과 알고리즘을 투명하게 공개합니다.
          </p>
          <p className="text-gray-600 text-sm mt-2">
            모든 분석은 참고용이며, 투자 판단의 최종 책임은 사용자 본인에게 있습니다.
          </p>

          {/* 섹션 목차 */}
          <div className="mt-8 inline-flex flex-wrap justify-center gap-2 text-xs">
            {[
              { href: '#fundamental', label: '01 · 기업 펀더멘탈 분석', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20' },
              { href: '#technical',   label: '02 · 기술적 차트 분석',   color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20' },
              { href: '#disclaimer', label: '03 · 투자 면책조항',       color: 'text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20' },
            ].map(({ href, label, color }) => (
              <a
                key={href}
                href={href}
                className={cn('px-3 py-1.5 rounded-full border font-semibold transition-colors', color)}
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
         * SECTION 01 — 기업 펀더멘탈 분석 기준
         * ═══════════════════════════════════════════ */}
        <section id="fundamental" className="scroll-mt-20">
          <SectionHeader
            num="01"
            icon={Calculator}
            title="기업 펀더멘탈 분석 기준"
            subtitle="주가가 기업의 실제 가치 대비 비싼지, 싼지를 판단하는 기준"
            accent="bg-blue-500/10 text-blue-400 border-blue-500/25"
          />

          {/* PER / PBR / ROE 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <ValuationCard
              emoji="📊" name="PER" fullName="주가수익비율"
              color="text-blue-400"
              accent="bg-blue-500/8 border border-blue-500/20 text-gray-500"
              summary="현재 주가가 기업의 연간 이익의 몇 배에 거래되고 있는지를 나타냅니다."
              detail="낮을수록 이익 대비 주가가 저렴하다는 의미이며, 업종 평균 PER과 비교해 상대적 평가를 내립니다."
              example="PER 20 = 지금 이익 수준을 유지한다면 20년치 이익을 주가에 선반영한 상태"
              goodLabel="업종 평균보다 낮음 → 상대적 저평가 가능성 → AI 점수 상승"
              badLabel="업종 평균보다 높음 → 고평가 우려 → AI 점수 하락"
            />
            <ValuationCard
              emoji="🏦" name="PBR" fullName="주가순자산비율"
              color="text-purple-400"
              accent="bg-purple-500/8 border border-purple-500/20 text-gray-500"
              summary="현재 주가가 기업의 장부상 자산 가치의 몇 배에 거래되고 있는지를 나타냅니다."
              detail="1배 미만은 주가가 청산가치 이하로 거래됨을 의미합니다. 업종 평균과 비교해 평가합니다."
              example="PBR 3 = 주가가 장부상 자산의 3배 수준. 성장 기대감이 반영된 프리미엄"
              goodLabel="업종 평균보다 낮음 → 자산 대비 저평가 → AI 점수 상승"
              badLabel="업종 평균보다 높음 → 자산 대비 고평가 → AI 점수 하락"
            />
            <ValuationCard
              emoji="💰" name="ROE" fullName="자기자본이익률"
              color="text-amber-400"
              accent="bg-amber-500/8 border border-amber-500/20 text-gray-500"
              summary="주주가 맡긴 자본으로 기업이 얼마나 효율적으로 이익을 창출하는지를 나타냅니다."
              detail="높을수록 자본 활용 효율이 우수한 기업. 업종 평균 ROE와 비교해 경쟁력을 평가합니다."
              example="ROE 20% = 주주 자본 100원으로 매년 20원의 순이익을 창출 (우량 기준)"
              goodLabel="업종 평균보다 높음 → 자본 효율 우수 → AI 점수 상승"
              badLabel="업종 평균보다 낮음 → 자본 활용 미흡 → AI 점수 하락"
            />
          </div>

          {/* DCF 모델 상세 카드 */}
          <div className="bg-[#0d1929] border border-blue-500/20 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">DCF 내재가치 분석 모델</h3>
                <p className="text-gray-500 text-xs">Discounted Cash Flow · 핵심 밸류에이션 지표</p>
              </div>
              <span className="ml-auto text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full font-semibold">
                AI 점수 30점
              </span>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed mt-4 mb-7">
              DCF(현금흐름할인)란 기업이 미래에 벌어들일 현금을 현재 가치로 환산해 적정 주가를 계산하는 방법입니다.
              주가의 등락과 무관하게{' '}
              <span className="text-white font-medium">기업 본질 가치</span>에 집중한다는 점에서
              가장 기초적이고 신뢰받는 밸류에이션 방법으로 여겨집니다.
            </p>

            {/* 플로우 시각화 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-stretch mb-2">
              {([
                {
                  step: '①',
                  label: 'FCF 입력',
                  desc: '기업의 연간 잉여 현금흐름 (영업현금 − 설비투자)',
                  color: 'text-blue-400',
                  bg: 'bg-blue-500/8 border-blue-500/20',
                },
                null, // arrow
                {
                  step: '②',
                  label: '성장률 적용',
                  desc: '향후 10년간 FCF가 매년 몇 % 성장할지 가정',
                  color: 'text-purple-400',
                  bg: 'bg-purple-500/8 border-purple-500/20',
                },
                null,
                {
                  step: '③',
                  label: '할인율 반영',
                  desc: 'WACC(가중평균자본비용)으로 현재가치 환산',
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/8 border-amber-500/20',
                },
              ] as const).map((item, i) =>
                item === null ? (
                  <div key={i} className="hidden sm:flex items-center justify-center text-gray-700 text-2xl">
                    →
                  </div>
                ) : (
                  <div key={i} className={cn('rounded-xl border p-4 text-center', item.bg)}>
                    <p className={cn('text-xs font-black mb-2', item.color)}>{item.step}</p>
                    <p className="text-white text-sm font-bold leading-tight mb-2">{item.label}</p>
                    <p className="text-gray-500 text-[11px] leading-relaxed">{item.desc}</p>
                  </div>
                )
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 py-4 px-1">
              <span className="text-gray-700">+</span>
              <span className="text-gray-400">영구성장가치(Terminal Value)</span>
              <span className="text-gray-700">→</span>
              <span className="text-white font-semibold">기업 전체 가치(EV)</span>
              <span className="text-gray-700">÷</span>
              <span className="text-gray-400">발행주식수</span>
              <span className="text-gray-700">÷</span>
              <span className="text-gray-400">부채 조정</span>
              <span className="text-blue-400 font-bold text-sm">=</span>
              <span className="text-blue-400 font-bold">적정 주가</span>
            </div>

            <p className="text-xs text-gray-500 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 mb-6">
              📌 적정 주가가 현재 주가보다 <span className="text-emerald-400 font-semibold">높으면 저평가(AI 점수 ↑)</span>,
              낮으면 <span className="text-rose-400 font-semibold">고평가(AI 점수 ↓)</span>로 판단합니다.
              대시보드의 슬라이더로 가정치를 직접 조정해 볼 수 있습니다.
            </p>

            {/* 파라미터 설명 3열 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-gray-800">
              {[
                {
                  label: 'FCF 성장률',
                  range: '1% ~ 40%',
                  color: 'text-blue-400',
                  border: 'border-blue-500/20',
                  desc: '향후 10년간 잉여현금흐름이 매년 얼마나 성장할지에 대한 가정입니다. 높게 설정할수록 미래가치가 커져 적정 주가가 올라갑니다.',
                },
                {
                  label: '할인율 (WACC)',
                  range: '5% ~ 15%',
                  color: 'text-purple-400',
                  border: 'border-purple-500/20',
                  desc: '미래 현금을 현재 가치로 환산할 때 사용하는 비율입니다. 높을수록 미래가치를 보수적으로 평가하여 적정 주가가 낮아집니다.',
                },
                {
                  label: '영구 성장률',
                  range: '0.5% ~ 5%',
                  color: 'text-amber-400',
                  border: 'border-amber-500/20',
                  desc: '10년 이후에도 기업이 영원히 성장한다고 가정하는 비율입니다. 일반적으로 GDP 성장률(2~3%)을 초과하지 않게 설정합니다.',
                },
              ].map(item => (
                <div
                  key={item.label}
                  className={cn('bg-gray-900/60 rounded-xl p-4 border', item.border)}
                >
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
            num="02"
            icon={Activity}
            title="기술적 차트 분석 기준"
            subtitle="주가 흐름의 패턴과 모멘텀으로 매수·매도 시그널을 포착"
            accent="bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* 이동평균선 (SMA) 카드 */}
            <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">📈</span>
                <div>
                  <h3 className="text-white font-bold text-base">이동평균선 (SMA)</h3>
                  <p className="text-[11px] text-gray-600">20일선 · 60일선 교차 분석</p>
                </div>
                <span className="ml-auto text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  AI 점수 20점
                </span>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                N일간의 평균 주가를 선으로 이은 것입니다.
                <span className="text-orange-400 font-medium"> 단기(20일)</span>선과
                <span className="text-red-400 font-medium"> 장기(60일)</span>선의 교차 방향으로
                추세 전환 시점을 포착합니다.
              </p>

              {/* 이동평균선 시각화 */}
              <div className="relative h-16 rounded-xl overflow-hidden bg-gray-900/60 border border-gray-800 mb-5">
                <svg viewBox="0 0 280 64" className="w-full h-full" preserveAspectRatio="none">
                  {/* 60일선 (장기, 완만) */}
                  <path d="M0,52 Q70,50 140,38 Q210,26 280,20"
                    stroke="#f87171" strokeWidth="1.8" fill="none" strokeOpacity={0.7} />
                  {/* 20일선 (단기, 급격) */}
                  <path d="M0,58 Q70,52 140,36 Q210,20 280,12"
                    stroke="#f97316" strokeWidth="1.8" fill="none" strokeOpacity={0.7} />
                  {/* 교차점 */}
                  <circle cx="140" cy="37" r="4" fill="#10b981" opacity={0.9} />
                  <line x1="140" y1="0" x2="140" y2="64"
                    stroke="#10b981" strokeWidth="0.8" strokeDasharray="3,2" strokeOpacity={0.6} />
                  {/* 레이블 */}
                  <text x="4" y="60" fill="#6b7280" fontSize="7">20일 &lt; 60일</text>
                  <text x="148" y="60" fill="#10b981" fontSize="7">20일 &gt; 60일 →</text>
                </svg>
              </div>

              <div className="space-y-3">
                {/* 골든크로스 */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">✨</span>
                    <span className="text-emerald-400 font-bold text-sm">골든크로스 (매수 시그널)</span>
                    <span className="ml-auto text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      점수 ↑
                    </span>
                  </div>
                  <p className="text-gray-500 text-[12px] leading-relaxed">
                    단기(20일)선이 장기(60일)선을{' '}
                    <strong className="text-white">아래에서 위로 돌파</strong>할 때 발생합니다.
                    하락세가 끝나고 상승 추세로 전환되는 신호로 해석하여 AI 점수를 높입니다.
                  </p>
                </div>

                {/* 데드크로스 */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">💀</span>
                    <span className="text-rose-400 font-bold text-sm">데드크로스 (매도 시그널)</span>
                    <span className="ml-auto text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">
                      점수 ↓
                    </span>
                  </div>
                  <p className="text-gray-500 text-[12px] leading-relaxed">
                    단기(20일)선이 장기(60일)선을{' '}
                    <strong className="text-white">위에서 아래로 돌파</strong>할 때 발생합니다.
                    상승세가 꺾이고 하락 추세로 전환되는 신호로 해석하여 AI 점수를 낮춥니다.
                  </p>
                </div>
              </div>
            </div>

            {/* RSI 카드 */}
            <div className="bg-[#0d1929] border border-gray-800/80 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="text-white font-bold text-base">RSI (상대강도지수)</h3>
                  <p className="text-[11px] text-gray-600">Wilder RSI · 14일 기준</p>
                </div>
                <span className="ml-auto text-[11px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                  AI 점수 20점
                </span>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                최근 14거래일의 상승폭과 하락폭 비율로 주가의 과열·침체 여부를
                <strong className="text-white"> 0~100</strong> 사이 숫자로 표현합니다.
                급등 뒤의 조정, 급락 뒤의 반등 가능성을 포착하는 데 활용합니다.
              </p>

              {/* RSI 게이지 시각화 */}
              <div className="mb-5">
                <div className="relative h-10 rounded-full overflow-hidden mb-2" style={{ background: '#111827' }}>
                  {/* 구간 배경 */}
                  <div className="absolute inset-y-0 left-0 w-[30%] bg-gradient-to-r from-emerald-700/50 to-emerald-500/30" />
                  <div className="absolute inset-y-0 right-0 w-[30%] bg-gradient-to-l from-rose-700/50 to-rose-500/30" />
                  {/* 구분선 */}
                  <div className="absolute inset-y-0 left-[30%] w-px bg-gray-600/60" />
                  <div className="absolute inset-y-0 left-[70%] w-px bg-gray-600/60" />
                  {/* 레이블 */}
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-[30%] text-center text-[11px] font-bold text-emerald-400">
                      과매도 ≤ 30
                    </span>
                    <span className="w-[40%] text-center text-[11px] text-gray-500">
                      중립 30~70
                    </span>
                    <span className="w-[30%] text-center text-[11px] font-bold text-rose-400">
                      과매수 ≥ 70
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-700 px-1">
                  <span>0</span>
                  <span>30</span>
                  <span className="text-gray-600">50</span>
                  <span>70</span>
                  <span>100</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                  <span className="text-xl flex-shrink-0">📉</span>
                  <div>
                    <p className="text-emerald-400 font-bold text-sm mb-1">RSI ≤ 30 — 과매도 구간</p>
                    <p className="text-gray-500 text-[12px] leading-relaxed">
                      단기 급락으로 주가가 지나치게 내렸을 가능성을 시사합니다.
                      반등 기대감으로{' '}
                      <span className="text-emerald-400 font-semibold">AI 점수 상승</span> 요인이 됩니다.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl bg-rose-500/5 border border-rose-500/20 p-4">
                  <span className="text-xl flex-shrink-0">📈</span>
                  <div>
                    <p className="text-rose-400 font-bold text-sm mb-1">RSI ≥ 70 — 과매수 구간</p>
                    <p className="text-gray-500 text-[12px] leading-relaxed">
                      단기 급등으로 주가가 과열됐을 가능성을 시사합니다.
                      조정 우려로{' '}
                      <span className="text-rose-400 font-semibold">AI 점수 하락</span> 요인이 됩니다.
                    </p>
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
                <h3 className="text-white font-bold">AI 종합 점수 100점 구성</h3>
                <p className="text-gray-500 text-xs mt-0.5">위 분석 기준이 어떻게 합산되나요?</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                {
                  label: 'DCF 내재가치',
                  pts: 30,
                  color: 'text-blue-400',
                  bg: 'bg-blue-500/8 border-blue-500/20',
                  desc: '현재가 vs 적정가 괴리율',
                },
                {
                  label: 'RSI 시그널',
                  pts: 20,
                  color: 'text-violet-400',
                  bg: 'bg-violet-500/8 border-violet-500/20',
                  desc: '과매수·과매도 구간 판단',
                },
                {
                  label: 'MA 교차',
                  pts: 20,
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/8 border-emerald-500/20',
                  desc: '골든·데드크로스 감지',
                },
                {
                  label: 'PER 비교',
                  pts: 15,
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/8 border-amber-500/20',
                  desc: '업종 PER 대비 저·고평가',
                },
                {
                  label: 'PBR 비교',
                  pts: 15,
                  color: 'text-orange-400',
                  bg: 'bg-orange-500/8 border-orange-500/20',
                  desc: '업종 PBR 대비 저·고평가',
                },
              ].map(item => (
                <div
                  key={item.label}
                  className={cn('rounded-xl border p-4 text-center', item.bg)}
                >
                  <p className={cn('text-3xl font-black leading-none', item.color)}>{item.pts}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">점</p>
                  <p className={cn('text-xs font-bold mt-2 leading-tight', item.color)}>
                    {item.label}
                  </p>
                  <p className="text-gray-600 text-[11px] mt-1.5 leading-tight">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-600 bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              65점 이상 <span className="text-emerald-400 font-semibold mx-1">투자 매력</span>·
              45~64점 <span className="text-amber-400 font-semibold mx-1">중립 관망</span>·
              44점 이하 <span className="text-rose-400 font-semibold mx-1">리스크 주의</span>
              로 분류됩니다.
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════
         * SECTION 03 — 투자 유의사항 및 면책조항
         * ═══════════════════════════════════════════ */}
        <section id="disclaimer" className="scroll-mt-20">
          <SectionHeader
            num="03"
            icon={AlertTriangle}
            title="투자 유의사항 및 면책조항"
            subtitle="서비스 이용 전 반드시 확인하시기 바랍니다"
            accent="bg-rose-500/15 text-rose-400 border-rose-500/30"
          />

          {/* 메인 면책 박스 */}
          <div className="rounded-2xl border-2 border-rose-500/40 bg-rose-500/5 p-6 sm:p-8 mb-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-rose-200 font-extrabold text-xl">⚠️ 중요 고지 사항</h3>
                <p className="text-rose-400/70 text-sm mt-0.5">
                  투자 결정 전 반드시 읽어주세요
                </p>
              </div>
            </div>

            {/* 법적 면책조항 (원문 유지) */}
            <div className="bg-rose-950/40 border border-rose-500/25 rounded-xl p-5 sm:p-6 mb-6">
              <p className="text-rose-100/90 text-sm sm:text-base leading-[1.9] font-medium">
                본 서비스에서 제공하는 모든 분석 데이터 및 AI 예측 점수는{' '}
                <strong className="text-white underline decoration-rose-400/50 underline-offset-2">
                  야후 파이낸스의 공개 데이터를 기반으로 한 단순 참고용 계산 결과
                </strong>
                이며, 금융 투자 전문가의 조언을 대체할 수 없습니다.
                모든 투자 판단의 최종 책임은{' '}
                <strong className="text-white underline decoration-rose-400/50 underline-offset-2">
                  사용자 본인
                </strong>
                에게 있으며, 본 서비스는 어떠한 경우에도 투자 결과로 인한 손실에 대해{' '}
                <strong className="text-white underline decoration-rose-400/50 underline-offset-2">
                  법적 책임을 지지 않습니다.
                </strong>
              </p>
            </div>

            {/* 세부 유의사항 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: '📡',
                  title: '데이터 출처 및 정확성',
                  desc: 'Alpha Vantage 및 Yahoo Finance의 공개 API 데이터를 사용합니다. API 지연·장애·오류로 인해 실제 시세와 다를 수 있습니다.',
                },
                {
                  icon: '🤖',
                  title: 'AI 점수의 한계',
                  desc: 'AI 점수는 5개의 정량 지표만을 반영한 단순 알고리즘입니다. 거시경제·정치적 이벤트·기업 내부 정보 등은 반영되지 않습니다.',
                },
                {
                  icon: '⏱️',
                  title: '데이터 지연 가능성',
                  desc: '일봉(D) 기준 데이터를 사용하므로 장중 급변동·긴급 공시·실적 발표 등이 즉시 반영되지 않을 수 있습니다.',
                },
                {
                  icon: '🌐',
                  title: '분석 대상 범위',
                  desc: '미국 주식 시장(NYSE, NASDAQ) 상장 종목 위주로 설계되었습니다. 타 시장 종목은 데이터가 불완전하거나 제공되지 않을 수 있습니다.',
                },
              ].map(item => (
                <div
                  key={item.title}
                  className="flex gap-3 bg-gray-900/50 border border-gray-800/70 rounded-xl p-4"
                >
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
              본 서비스는 개인 학습 및 편의 목적의 비영리 프로젝트입니다.
              실제 투자 결정은 공인 금융투자업자의 조언과 본인의 충분한 조사를 바탕으로 하시기 바랍니다.
            </p>
          </div>
        </section>

        {/* ── 하단 돌아가기 버튼 ── */}
        <div className="flex justify-center pb-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 hover:bg-gray-800/50 transition-all text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            메인 대시보드로 돌아가기
          </Link>
        </div>

      </main>

      <footer className="py-6 text-center" style={{ borderTop: '1px solid #1a2535' }}>
        <p className="text-xs text-gray-700">
          Stock-er · 서비스 분석 기준 및 투자 면책조항 — 실제 투자 결정에 활용하지 마세요.
        </p>
      </footer>
    </div>
  );
}
