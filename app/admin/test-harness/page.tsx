'use client';

/**
 * app/admin/test-harness/page.tsx
 * QA 테스트 하네스 — 독립 관리자 페이지
 *
 * Section 1: API 헬스체크
 *   - /api/stock?ticker={t} 엔드포인트 응답 속도·상태·소스 측정
 *   - 오작동 시뮬레이션: 유효하지 않은 티커 / 빈 티커 주입
 *
 * Section 2: 극단 시나리오 알고리즘 테스트
 *   - lib/testHarness.ts의 runAllTests() 실행
 *   - Pass/Fail 배지 + 어설션 드릴다운
 */

import React, { useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import {
  BarChart2, FlaskConical, ArrowLeft, RefreshCw,
  CheckCircle2, XCircle, Clock, Wifi, WifiOff,
  ChevronDown, ChevronUp, Play, PlayCircle,
  AlertTriangle, Terminal, Activity,
} from 'lucide-react';
import { runAllTests, type ScenarioTestResult, type AssertionResult } from '@/lib/testHarness';
import type { StockData } from '@/lib/types';
import type { HealthCheckResult } from '@/lib/types';

/* ─────────────────────────────────────────────
 * 0. 유틸
 * ───────────────────────────────────────────── */
function cn(...c: (string | boolean | undefined | null)[]): string {
  return c.filter(Boolean).join(' ');
}

/* ─────────────────────────────────────────────
 * 내장 테스트 케이스 목록
 * (API 헬스체크 — 정상 + 엣지 케이스)
 * ───────────────────────────────────────────── */
interface ApiTestCase {
  id: string;
  ticker: string;
  label: string;
  description: string;
  expectMock?: boolean;   // true: source='mock' 예상
  expectError?: boolean;  // true: 오류 응답 예상
  category: 'normal' | 'edge' | 'simulation';
}

const BUILT_IN_TEST_CASES: ApiTestCase[] = [
  { id: 'aapl',     ticker: 'AAPL',        label: 'AAPL',             description: 'Apple Inc. 정상 조회', category: 'normal' },
  { id: 'tsla',     ticker: 'TSLA',        label: 'TSLA',             description: 'Tesla Inc. 정상 조회', category: 'normal' },
  { id: 'msft',     ticker: 'MSFT',        label: 'MSFT',             description: 'Microsoft 정상 조회', category: 'normal' },
  { id: 'googl',    ticker: 'GOOGL',       label: 'GOOGL',            description: 'Alphabet 정상 조회', category: 'normal' },
  { id: 'unknown',  ticker: 'ZZZZINVALID', label: '잘못된 티커',      description: '존재하지 않는 티커 → Mock 폴백 확인', expectMock: true, category: 'simulation' },
  { id: 'numeric',  ticker: '12345',       label: '숫자 티커',        description: '숫자만으로 구성된 티커 → 방어 처리 확인', expectMock: true, category: 'simulation' },
  { id: 'longname', ticker: 'VERYLONGTICKERSYMBOLTEST', label: '과도하게 긴 티커', description: '비정상적으로 긴 티커 → 처리 확인', expectMock: true, category: 'edge' },
];

/* ─────────────────────────────────────────────
 * 1. API 단일 호출 함수
 * ───────────────────────────────────────────── */
async function runApiHealthCheck(ticker: string): Promise<HealthCheckResult> {
  const start = performance.now();
  try {
    const res = await fetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`, {
      cache: 'no-store', // 헬스체크는 캐시 우회
    });
    const elapsed = performance.now() - start;

    if (!res.ok) {
      return {
        ticker,
        status: 'error',
        httpStatus: res.status,
        responseTimeMs: Math.round(elapsed),
        errorMessage: `HTTP ${res.status}`,
        fetchedAt: new Date().toISOString(),
      };
    }

    const data: StockData = await res.json();

    // 필수 필드 유효성 체크
    const missingFields: string[] = [];
    if (!data.ticker)       missingFields.push('ticker');
    if (!data.chartRows?.length) missingFields.push('chartRows');
    if (data.latestRSI !== null && (data.latestRSI! < 0 || data.latestRSI! > 100)) {
      missingFields.push('latestRSI(범위오류)');
    }

    return {
      ticker,
      status:         'ok',
      httpStatus:     res.status,
      responseTimeMs: Math.round(elapsed),
      source:         data.source,
      currentPrice:   data.currentPrice,
      dataPoints:     data.allPrices?.length ?? 0,
      note:           data.note ?? (missingFields.length > 0 ? `필드 이상: ${missingFields.join(', ')}` : undefined),
      fetchedAt:      data.fetchedAt,
    };
  } catch (err) {
    const elapsed = performance.now() - start;
    return {
      ticker,
      status: 'error',
      responseTimeMs: Math.round(elapsed),
      errorMessage: err instanceof Error ? err.message : String(err),
      fetchedAt: new Date().toISOString(),
    };
  }
}

/* ─────────────────────────────────────────────
 * 2. 헬스체크 결과 행 컴포넌트
 * ───────────────────────────────────────────── */
function HealthRow({ tc, result, onRun, isRunning }: {
  tc: ApiTestCase;
  result: HealthCheckResult | null;
  onRun: () => void;
  isRunning: boolean;
}) {
  const catColor: Record<ApiTestCase['category'], string> = {
    normal:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
    edge:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
    simulation: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  const catLabel: Record<ApiTestCase['category'], string> = {
    normal: '정상', edge: '엣지', simulation: '시뮬',
  };

  return (
    <div className={cn(
      'grid grid-cols-[1fr_auto] gap-3 px-4 py-3 rounded-xl border transition-all duration-200',
      result?.status === 'ok'    ? 'border-emerald-500/15 bg-emerald-500/3 hover:bg-emerald-500/5' :
      result?.status === 'error' ? 'border-rose-500/20 bg-rose-500/3'     :
                                   'border-white/5 bg-white/2 hover:bg-white/4',
    )}>
      {/* 왼쪽: 정보 */}
      <div className="min-w-0 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* 상태 아이콘 */}
          <span className="shrink-0">
            {result?.status === 'ok'    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
             result?.status === 'error' ? <XCircle      className="w-4 h-4 text-rose-400" />    :
             result?.status === 'pending' ? <RefreshCw  className="w-4 h-4 text-amber-400 animate-spin" /> :
             <div className="w-4 h-4 rounded-full border border-gray-700" />}
          </span>

          {/* 티커 */}
          <code className="text-sm font-bold text-white font-mono">{tc.ticker}</code>

          {/* 카테고리 뱃지 */}
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', catColor[tc.category])}>
            {catLabel[tc.category]}
          </span>

          {/* 설명 */}
          <span className="text-xs text-gray-500 truncate">{tc.description}</span>
        </div>

        {/* 결과 세부 정보 */}
        {result && result.status !== 'pending' && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono pl-6">
            {/* 응답 시간 */}
            {result.responseTimeMs !== undefined && (
              <span className={cn('flex items-center gap-1',
                result.responseTimeMs < 300  ? 'text-emerald-400' :
                result.responseTimeMs < 1000 ? 'text-amber-400'   : 'text-rose-400')}>
                <Clock className="w-3 h-3" />
                {result.responseTimeMs}ms
              </span>
            )}

            {/* HTTP 상태 */}
            {result.httpStatus !== undefined && (
              <span className={cn(result.httpStatus === 200 ? 'text-emerald-500' : 'text-rose-400')}>
                HTTP {result.httpStatus}
              </span>
            )}

            {/* 데이터 소스 */}
            {result.source && (
              <span className={cn('flex items-center gap-1',
                result.source === 'live' ? 'text-emerald-400' : 'text-slate-400')}>
                {result.source === 'live'
                  ? <><Wifi    className="w-3 h-3" /> LIVE</>
                  : <><WifiOff className="w-3 h-3" /> MOCK</>}
              </span>
            )}

            {/* 현재가 */}
            {result.currentPrice !== undefined && (
              <span className="text-slate-300">${result.currentPrice.toFixed(2)}</span>
            )}

            {/* 데이터 포인트 수 */}
            {result.dataPoints !== undefined && (
              <span className="text-slate-500">{result.dataPoints}pts</span>
            )}

            {/* 에러 메시지 */}
            {result.errorMessage && (
              <span className="text-rose-400 break-all">{result.errorMessage}</span>
            )}

            {/* note */}
            {result.note && !result.errorMessage && (
              <span className="text-amber-400/80">{result.note}</span>
            )}
          </div>
        )}
      </div>

      {/* 오른쪽: 실행 버튼 */}
      <button onClick={onRun} disabled={isRunning}
        className={cn(
          'self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold',
          'border transition-all active:scale-95',
          isRunning
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 cursor-wait'
            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200',
        )}>
        {isRunning
          ? <RefreshCw className="w-3 h-3 animate-spin" />
          : <Play      className="w-3 h-3" />}
        {isRunning ? '실행 중' : '실행'}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 3. 어설션 행 컴포넌트
 * ───────────────────────────────────────────── */
function AssertionRow({ a }: { a: AssertionResult }) {
  return (
    <div className={cn(
      'grid grid-cols-[16px_1fr] gap-x-2 py-1 px-2 rounded text-[11px] font-mono',
      a.passed ? 'text-slate-400' : 'bg-rose-500/8 text-rose-300',
    )}>
      <span className={a.passed ? 'text-emerald-500' : 'text-rose-500'}>
        {a.passed ? '✓' : '✗'}
      </span>
      <div className="min-w-0">
        <div className="text-slate-300 break-words">{a.name}</div>
        {!a.passed && a.error && (
          <div className="text-rose-400 text-[10px] mt-0.5 break-words leading-relaxed">
            {a.error}
          </div>
        )}
        {a.passed && a.actual && (
          <div className="text-slate-600 text-[10px] mt-0.5 truncate">→ {a.actual}</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 4. 시나리오 카드 컴포넌트
 * ───────────────────────────────────────────── */
function ScenarioCard({ result }: { result: ScenarioTestResult }) {
  const [expanded, setExpanded] = useState(false);
  const passRate = Math.round((result.stats.passed / result.stats.total) * 100);

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all duration-200',
      result.passed
        ? 'border-emerald-500/20 bg-emerald-500/4'
        : 'border-rose-500/30 bg-rose-500/4',
    )}>
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors">

        {/* 시나리오 ID 칩 */}
        <code className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-slate-500 border border-white/10">
          {result.scenarioId}
        </code>

        {/* 이름 */}
        <span className="flex-1 text-[13px] font-medium text-slate-200 truncate">
          {result.scenarioName}
        </span>

        {/* 통과 수 */}
        <span className="shrink-0 text-[11px] font-mono text-slate-500">
          {result.stats.passed}/{result.stats.total}
        </span>

        {/* 레이턴시 */}
        <span className={cn(
          'shrink-0 text-[11px] font-mono tabular-nums',
          result.passed ? 'text-emerald-500/70' : 'text-rose-500/70',
        )}>
          {result.executionTime}
        </span>

        {/* Pass/Fail 배지 */}
        <span className={cn(
          'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase font-mono',
          result.passed
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', result.passed ? 'bg-emerald-400' : 'bg-rose-400')} />
          {result.passed ? 'PASS' : 'FAIL'}
        </span>

        {/* 진행 바 (배경) */}
        {expanded
          ? <ChevronUp   className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
      </button>

      {/* 진행 바 */}
      <div className="h-[2px] bg-white/5 mx-4">
        <div
          className={cn('h-full rounded-full transition-all duration-500',
            result.passed ? 'bg-emerald-500/50' : 'bg-rose-500/50')}
          style={{ width: `${passRate}%` }}
        />
      </div>

      {/* 실패 요약 (축소 상태) */}
      {!result.passed && result.errorLog && !expanded && (
        <div className="px-4 py-2 text-[10px] font-mono text-rose-400/80 border-t border-rose-500/10 truncate">
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          {result.errorLog.split(' | ')[0]}
        </div>
      )}

      {/* 어설션 드릴다운 */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-0.5 max-h-80 overflow-y-auto">
          {result.assertions.map((a, i) => (
            <AssertionRow key={i} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 5. 메인 페이지
 * ───────────────────────────────────────────── */
export default function TestHarnessPage() {
  /* ── API 헬스체크 상태 ─────────────────── */
  const [healthResults, setHealthResults] = useState<Record<string, HealthCheckResult>>({});
  const [runningIds, setRunningIds]       = useState<Set<string>>(new Set());
  const [customTicker, setCustomTicker]   = useState('');
  const [customResult, setCustomResult]   = useState<HealthCheckResult | null>(null);
  const [customRunning, setCustomRunning] = useState(false);

  /* ── 시나리오 테스트 상태 ──────────────── */
  const [scenarioResults, setScenarioResults] = useState<ScenarioTestResult[] | null>(null);
  const [totalTime, setTotalTime]             = useState<string | null>(null);
  const [isScenarioPending, startScenarioTransition] = useTransition();

  /* ── API 단일 실행 ─────────────────────── */
  const runSingle = useCallback(async (tc: ApiTestCase) => {
    setRunningIds(prev => new Set(prev).add(tc.id));
    setHealthResults(prev => ({ ...prev, [tc.id]: { ...prev[tc.id], ticker: tc.ticker, status: 'pending' } }));
    const result = await runApiHealthCheck(tc.ticker);
    setHealthResults(prev => ({ ...prev, [tc.id]: result }));
    setRunningIds(prev => { const s = new Set(prev); s.delete(tc.id); return s; });
  }, []);

  /* ── API 전체 실행 (순차, Rate Limit 보호) ── */
  const runAll = useCallback(async () => {
    for (const tc of BUILT_IN_TEST_CASES) {
      await runSingle(tc);
      // 연속 호출 시 API Rate Limit 방지: 400ms 간격
      await new Promise(r => setTimeout(r, 400));
    }
  }, [runSingle]);

  /* ── 커스텀 티커 실행 ─────────────────── */
  const runCustom = useCallback(async () => {
    const t = customTicker.trim().toUpperCase();
    if (!t) return;
    setCustomRunning(true);
    setCustomResult({ ticker: t, status: 'pending' });
    const result = await runApiHealthCheck(t);
    setCustomResult(result);
    setCustomRunning(false);
  }, [customTicker]);

  /* ── 시나리오 테스트 실행 ─────────────── */
  const runScenarios = useCallback(() => {
    startScenarioTransition(() => {
      const r = runAllTests();
      setScenarioResults(r.results);
      setTotalTime(r.totalTime);
    });
  }, []);

  /* ── 요약 통계 ─────────────────────────── */
  const healthStats = {
    total:  BUILT_IN_TEST_CASES.length,
    done:   Object.values(healthResults).filter(r => r.status !== 'pending').length,
    ok:     Object.values(healthResults).filter(r => r.status === 'ok').length,
    error:  Object.values(healthResults).filter(r => r.status === 'error').length,
    avgMs:  (() => {
      const times = Object.values(healthResults)
        .filter(r => r.status === 'ok' && r.responseTimeMs !== undefined)
        .map(r => r.responseTimeMs!);
      return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
    })(),
  };

  const scenarioStats = scenarioResults ? {
    total:        scenarioResults.length,
    passed:       scenarioResults.filter(r => r.passed).length,
    assertions:   scenarioResults.reduce((s, r) => s + r.stats.total, 0),
    assertPass:   scenarioResults.reduce((s, r) => s + r.stats.passed, 0),
  } : null;

  const allRunning = runningIds.size === BUILT_IN_TEST_CASES.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#060d1a', color: 'white' }}>

      {/* ── HEADER ─────────────────────────── */}
      <header style={{ borderBottom: '1px solid #1a2535', backgroundColor: 'rgba(6,13,26,0.95)' }}
        className="sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">

          {/* 뒤로가기 */}
          <Link href="/"
            className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">대시보드</span>
          </Link>

          <div className="w-px h-5 bg-gray-800" />

          {/* 로고 + 페이지 제목 */}
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              <FlaskConical className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white">QA Test Harness</span>
            <span className="text-[11px] text-purple-400 border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 rounded-full font-medium">
              Admin
            </span>
          </div>

          {/* 요약 칩 */}
          {scenarioStats && (
            <div className={cn(
              'hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border',
              scenarioStats.passed === scenarioStats.total
                ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-400'
                : 'border-rose-500/30 bg-rose-500/8 text-rose-400',
            )}>
              {scenarioStats.passed === scenarioStats.total ? '✓' : '✗'}
              {scenarioStats.assertPass}/{scenarioStats.assertions} assertions
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ══════════════════════════════════════════
         * SECTION 1: API 헬스체크
         * ══════════════════════════════════════════ */}
        <section>
          {/* 섹션 헤더 */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">API 헬스체크 &amp; 응답 속도</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  /api/stock 엔드포인트 · 실시간 응답 시간 · 데이터 소스 확인
                </p>
              </div>
            </div>

            {/* 요약 통계 */}
            {healthStats.done > 0 && (
              <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono text-gray-500">
                {healthStats.avgMs !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> avg {healthStats.avgMs}ms
                  </span>
                )}
                <span className="text-emerald-400">✓ {healthStats.ok}</span>
                {healthStats.error > 0 && <span className="text-rose-400">✗ {healthStats.error}</span>}
              </div>
            )}

            {/* 전체 실행 버튼 */}
            <button onClick={runAll} disabled={allRunning || runningIds.size > 0}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95',
                allRunning || runningIds.size > 0
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 cursor-wait'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15',
              )}>
              {runningIds.size > 0
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> 실행 중 ({runningIds.size})</>
                : <><PlayCircle className="w-4 h-4" /> 전체 실행</>}
            </button>
          </div>

          {/* 빌트인 테스트 케이스 목록 */}
          <div className="space-y-2 mb-5">
            {BUILT_IN_TEST_CASES.map(tc => (
              <HealthRow
                key={tc.id}
                tc={tc}
                result={healthResults[tc.id] ?? null}
                onRun={() => runSingle(tc)}
                isRunning={runningIds.has(tc.id)}
              />
            ))}
          </div>

          {/* 커스텀 티커 입력 */}
          <div className="rounded-xl border border-white/8 bg-white/2 p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-gray-500" />
              커스텀 티커 직접 입력 (시뮬레이션 자유 입력)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTicker}
                onChange={e => setCustomTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && runCustom()}
                placeholder="티커 입력 후 Enter 또는 실행 클릭…"
                className="flex-1 bg-[#111827] border border-[#1f2d3d] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none font-mono focus:border-blue-500/50 transition-colors"
              />
              <button onClick={runCustom} disabled={customRunning || !customTicker.trim()}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95',
                  customRunning || !customTicker.trim()
                    ? 'border-white/5 bg-white/5 text-gray-600 cursor-not-allowed'
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15',
                )}>
                {customRunning
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Play       className="w-4 h-4" />}
                실행
              </button>
            </div>

            {/* 커스텀 결과 */}
            {customResult && customResult.status !== 'pending' && (
              <div className={cn(
                'mt-3 rounded-lg px-4 py-3 border font-mono text-[11px]',
                customResult.status === 'ok'
                  ? 'border-emerald-500/15 bg-emerald-500/5'
                  : 'border-rose-500/20 bg-rose-500/5',
              )}>
                <div className="flex flex-wrap items-center gap-3">
                  {customResult.status === 'ok'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    : <XCircle      className="w-3.5 h-3.5 text-rose-400" />}
                  <code className="text-white font-bold">{customResult.ticker}</code>
                  {customResult.responseTimeMs !== undefined && (
                    <span className="text-slate-400">{customResult.responseTimeMs}ms</span>
                  )}
                  {customResult.source && (
                    <span className={customResult.source === 'live' ? 'text-emerald-400' : 'text-slate-400'}>
                      {customResult.source === 'live' ? '● LIVE' : '● MOCK'}
                    </span>
                  )}
                  {customResult.currentPrice !== undefined && (
                    <span className="text-slate-300">${customResult.currentPrice.toFixed(2)}</span>
                  )}
                  {customResult.dataPoints !== undefined && (
                    <span className="text-slate-500">{customResult.dataPoints} pts</span>
                  )}
                  {customResult.errorMessage && (
                    <span className="text-rose-400">{customResult.errorMessage}</span>
                  )}
                </div>
                {customResult.note && (
                  <p className="mt-1.5 text-amber-400/80 pl-5">{customResult.note}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════
         * SECTION 2: 극단 시나리오 알고리즘 검증
         * ══════════════════════════════════════════ */}
        <section>
          {/* 섹션 헤더 */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">극단 시나리오 알고리즘 검증</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  DCF · RSI · MACD 수학적 경계 조건 · Seed 기반 재현 가능 테스트
                </p>
              </div>
            </div>

            {/* 요약 통계 */}
            {scenarioStats && (
              <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono">
                <span className="text-emerald-400">✓ {scenarioStats.assertPass} passed</span>
                {scenarioStats.assertPass < scenarioStats.assertions && (
                  <span className="text-rose-400">✗ {scenarioStats.assertions - scenarioStats.assertPass} failed</span>
                )}
                {totalTime && <span className="text-slate-600">in {totalTime}</span>}
              </div>
            )}

            {/* 실행 버튼 */}
            <button onClick={runScenarios} disabled={isScenarioPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95',
                isScenarioPending
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 cursor-wait'
                  : 'border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/15',
              )}>
              {isScenarioPending
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> 실행 중…</>
                : <><PlayCircle className="w-4 h-4" /> 전체 실행</>}
            </button>
          </div>

          {/* 시나리오 카드 */}
          <div className="space-y-3">
            {isScenarioPending && (
              <div className="flex items-center justify-center gap-3 py-10 text-slate-500 font-mono text-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                시나리오 실행 중…
              </div>
            )}

            {!isScenarioPending && !scenarioResults && (
              <div className="flex flex-col items-center justify-center gap-4 py-14 border border-white/5 rounded-2xl bg-white/2">
                <Terminal className="w-8 h-8 text-gray-700" />
                <div className="text-center">
                  <p className="text-gray-400 font-medium text-sm">아직 실행하지 않았습니다</p>
                  <p className="text-gray-600 text-xs mt-1">
                    &ldquo;전체 실행&rdquo; 버튼을 눌러 71개 어설션을 검증하세요
                  </p>
                </div>
                <button onClick={runScenarios}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-semibold text-white transition-colors">
                  <PlayCircle className="w-4 h-4" />
                  테스트 시작
                </button>
              </div>
            )}

            {!isScenarioPending && scenarioResults && (
              <>
                {scenarioResults.map(r => (
                  <ScenarioCard key={r.scenarioId} result={r} />
                ))}

                {/* 최종 결과 요약 */}
                <div className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border font-mono text-[11px]',
                  scenarioStats?.passed === scenarioStats?.total
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                    : 'border-rose-500/20 bg-rose-500/5 text-rose-400',
                )}>
                  <span className="text-base">
                    {scenarioStats?.passed === scenarioStats?.total ? '✓' : '✗'}
                  </span>
                  <span className="flex-1">
                    {scenarioStats?.passed === scenarioStats?.total
                      ? `전체 ${scenarioStats?.assertions ?? 0}개 어설션 모두 통과 — 로직 무결성 확인됨`
                      : `${scenarioStats ? scenarioStats.assertions - scenarioStats.assertPass : 0}개 어설션 실패 — 위 카드에서 상세 확인`}
                  </span>
                  {totalTime && <span className="text-slate-600">{totalTime}</span>}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── 링크 푸터 ─────────────────────── */}
        <footer className="border-t border-gray-800/80 pt-6 flex items-center justify-between text-xs text-gray-700">
          <span>Stock-er QA Harness v1.0</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 hover:text-gray-400 transition-colors">
              <BarChart2 className="w-3.5 h-3.5" />
              메인 대시보드로
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
