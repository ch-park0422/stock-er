'use client';

/**
 * QAHarnessMonitor.tsx
 * 개발자용 QA 테스트 하네스 모니터
 *
 * 우측 하단 플로팅 버튼 → 슬라이드업 패널
 * 시나리오별 Pass/Fail 배지, Latency(ms), 어설션 상세 드릴다운
 */

import React, { useState, useCallback, useTransition } from 'react';
import { runAllTests, type HarnessResult, type ScenarioTestResult, type AssertionResult } from '@/lib/testHarness';

/* ─────────────────────────────────────────────
 * 하위 컴포넌트: 배지
 * ───────────────────────────────────────────── */
function Badge({ passed }: { passed: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase font-mono',
        passed
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      ].join(' ')}
    >
      <span className={['w-1.5 h-1.5 rounded-full', passed ? 'bg-emerald-400' : 'bg-rose-400'].join(' ')} />
      {passed ? 'PASS' : 'FAIL'}
    </span>
  );
}

/* ─────────────────────────────────────────────
 * 하위 컴포넌트: 어설션 행
 * ───────────────────────────────────────────── */
function AssertionRow({ a }: { a: AssertionResult }) {
  return (
    <div
      className={[
        'grid grid-cols-[16px_1fr] gap-x-2 py-1 px-2 rounded text-[11px] font-mono',
        a.passed ? 'text-slate-400' : 'bg-rose-500/8 text-rose-300',
      ].join(' ')}
    >
      <span className={a.passed ? 'text-emerald-500' : 'text-rose-500'}>
        {a.passed ? '✓' : '✗'}
      </span>
      <div className="min-w-0">
        <div className="text-slate-300 truncate">{a.name}</div>
        {!a.passed && a.error && (
          <div className="text-rose-400 text-[10px] mt-0.5 break-words leading-relaxed">
            {a.error}
          </div>
        )}
        {a.passed && a.actual && (
          <div className="text-slate-600 text-[10px] mt-0.5 truncate">
            → {a.actual}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 하위 컴포넌트: 시나리오 카드
 * ───────────────────────────────────────────── */
function ScenarioCard({ result }: { result: ScenarioTestResult }) {
  const [expanded, setExpanded] = useState(false);
  const passRate = Math.round((result.stats.passed / result.stats.total) * 100);

  return (
    <div
      className={[
        'rounded-lg border overflow-hidden transition-all duration-200',
        result.passed
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : 'border-rose-500/30 bg-rose-500/5',
      ].join(' ')}
    >
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
      >
        {/* 시나리오 ID 칩 */}
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-slate-500 border border-white/10">
          {result.scenarioId}
        </span>

        {/* 이름 */}
        <span className="flex-1 text-[13px] font-medium text-slate-200 truncate">
          {result.scenarioName}
        </span>

        {/* 통과율 진행 바 */}
        <span className="shrink-0 text-[11px] font-mono text-slate-500">
          {result.stats.passed}/{result.stats.total}
        </span>

        {/* 레이턴시 */}
        <span
          className={[
            'shrink-0 text-[11px] font-mono tabular-nums',
            result.passed ? 'text-emerald-500/70' : 'text-rose-500/70',
          ].join(' ')}
        >
          {result.executionTime}
        </span>

        {/* Pass/Fail 배지 */}
        <Badge passed={result.passed} />

        {/* 펼치기 화살표 */}
        <svg
          className={['w-3.5 h-3.5 text-slate-600 transition-transform duration-200 shrink-0', expanded ? 'rotate-180' : ''].join(' ')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 진행 바 */}
      <div className="h-[2px] bg-white/5 mx-4">
        <div
          className={['h-full rounded-full transition-all duration-500', result.passed ? 'bg-emerald-500/50' : 'bg-rose-500/50'].join(' ')}
          style={{ width: `${passRate}%` }}
        />
      </div>

      {/* 실패 요약 */}
      {!result.passed && result.errorLog && !expanded && (
        <div className="px-4 py-2 text-[10px] font-mono text-rose-400/80 border-t border-rose-500/10 truncate">
          ⚠ {result.errorLog.split(' | ')[0]}
        </div>
      )}

      {/* 어설션 상세 (펼쳤을 때) */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-0.5 max-h-72 overflow-y-auto scrollbar-thin">
          {result.assertions.map((a, i) => (
            <AssertionRow key={i} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
 * 메인 컴포넌트: QAHarnessMonitor
 * ───────────────────────────────────────────── */
export default function QAHarnessMonitor() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<HarnessResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const runTests = useCallback(() => {
    startTransition(() => {
      const r = runAllTests();
      setResult(r);
    });
  }, []);

  // 패널 열 때 자동 실행
  const handleToggle = useCallback(() => {
    // 처음 열 때 자동으로 테스트 실행
    // (setOpen updater 밖에서 startTransition 호출 — React 규칙 준수)
    if (!open && !result) {
      startTransition(() => {
        setResult(runAllTests());
      });
    }
    setOpen(v => !v);
  }, [open, result]);

  const allPassed = result ? result.totalFailed === 0 : null;

  return (
    <>
      {/* ── 플로팅 토글 버튼 ────────────────── */}
      <button
        onClick={handleToggle}
        title="QA 테스트 하네스 토글"
        className={[
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full',
          'border font-mono text-[11px] font-semibold tracking-wider uppercase',
          'shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95',
          open
            ? 'bg-[#0d1b2e] border-[#1e3a5f] text-slate-300'
            : result === null
              ? 'bg-[#0d1b2e]/90 border-[#1e3a5f] text-slate-400 hover:text-slate-200 hover:border-slate-500'
              : allPassed
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/15',
        ].join(' ')}
      >
        {/* 상태 등 */}
        <span className={[
          'w-2 h-2 rounded-full',
          isPending ? 'bg-amber-400 animate-pulse' :
          result === null ? 'bg-slate-600' :
          allPassed ? 'bg-emerald-400' : 'bg-rose-400',
        ].join(' ')} />

        <span>
          {open ? '▼ QA' : '▲ QA'}
        </span>

        {result && (
          <span className="text-[10px] opacity-70">
            {result.totalPassed}/{result.results.length}
          </span>
        )}
      </button>

      {/* ── 슬라이드업 패널 ─────────────────── */}
      <div
        className={[
          'fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* 패널 본체 */}
        <div className="mx-auto max-w-4xl mb-0">
          <div className="bg-[#060d1a]/95 backdrop-blur-xl border border-[#1e3a5f] border-b-0 rounded-t-2xl shadow-2xl">

            {/* 터미널 타이틀 바 */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1e3a5f]">
              {/* 트래픽 라이트 (장식) */}
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/60" />
                <span className="w-3 h-3 rounded-full bg-amber-500/60" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>

              <span className="font-mono text-[11px] text-slate-500 tracking-widest uppercase flex-1">
                ~/stock-er/qa-harness
                <span className="text-slate-700 mx-2">—</span>
                <span className="text-slate-600">test runner v1.0</span>
              </span>

              {/* 전체 결과 요약 */}
              {result && (
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-emerald-500">
                    ✓ {result.totalPassed} passed
                  </span>
                  {result.totalFailed > 0 && (
                    <span className="text-rose-500">
                      ✗ {result.totalFailed} failed
                    </span>
                  )}
                  <span className="text-slate-600">
                    in {result.totalTime}
                  </span>
                </div>
              )}

              {/* Re-run 버튼 */}
              <button
                onClick={runTests}
                disabled={isPending}
                className={[
                  'flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono font-semibold',
                  'border transition-all duration-150',
                  isPending
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 cursor-wait'
                    : 'border-[#1e3a5f] bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 active:scale-95',
                ].join(' ')}
              >
                {isPending ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Running…
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.93-5M20 15a9 9 0 01-15.93 5" />
                    </svg>
                    Re-run
                  </>
                )}
              </button>

              {/* 닫기 */}
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-white/10 transition-colors"
              >
                ×
              </button>
            </div>

            {/* 본문 */}
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">

              {/* 실행 중 스피너 */}
              {isPending && (
                <div className="flex items-center justify-center gap-3 py-8 text-slate-500 font-mono text-sm">
                  <svg className="w-4 h-4 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>시나리오 실행 중…</span>
                </div>
              )}

              {/* 결과 없음 */}
              {!isPending && !result && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-600 font-mono text-sm">
                  <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Re-run 버튼을 눌러 테스트를 시작하세요.</span>
                </div>
              )}

              {/* 시나리오 카드 목록 */}
              {!isPending && result && result.results.map(r => (
                <ScenarioCard key={r.scenarioId} result={r} />
              ))}

              {/* 최종 결과 요약 줄 */}
              {!isPending && result && (
                <div className={[
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg border font-mono text-[11px]',
                  allPassed
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                    : 'border-rose-500/20 bg-rose-500/5 text-rose-400',
                ].join(' ')}>
                  <span>{allPassed ? '✓' : '✗'}</span>
                  <span className="flex-1">
                    {allPassed
                      ? `전체 ${result.results.reduce((s, r) => s + r.stats.total, 0)}개 어설션 모두 통과 — 로직 무결성 확인됨`
                      : `${result.results.reduce((s, r) => s + r.stats.failed, 0)}개 어설션 실패 — 위 카드에서 상세 확인`}
                  </span>
                  <span className="text-slate-600">{result.totalTime}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 배경 딤처리 (패널 열렸을 때) */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
