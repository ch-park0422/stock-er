/**
 * app/api/market/route.ts  v2
 * Market Pulse API — 한국투자증권(KIS) Open API 실전 연동 + Mock 폴백
 *
 * ── 데이터 전략 ──────────────────────────────────────────────
 * │ 데이터 종류       │ 공급처               │ 폴백             │
 * ├───────────────────┼──────────────────────┼──────────────────┤
 * │ KR 급등주 Top 5   │ KIS (HHDFS76200100) │ Mock 상수        │
 * │ KR 급락주 Top 5   │ KIS (HHDFS76200100) │ Mock 상수        │
 * │ KR 거래량 Top 5   │ KIS (FHPST01720000) │ Mock 상수        │
 * │ US 급등/급락/거래량│ Mock 상수            │ —                │
 * │ 트렌딩 섹터       │ 큐레이션 Mock         │ —                │
 * └───────────────────────────────────────────────────────────┘
 *
 * ── 폴백 조건 ────────────────────────────────────────────────
 * · KIS 환경변수(KIS_URL, KIS_APP_KEY, KIS_APP_SECRET) 미설정
 * · KIS API 호출 오류 (네트워크, 인증 실패, Rate Limit 등)
 * · KIS 응답 rt_cd ≠ "0" (업무 오류)
 * → 위 조건 중 하나라도 해당 시 Mock 데이터로 자동 폴백
 *
 * ── KIS API 명세 ─────────────────────────────────────────────
 * 등락 상위: GET /uapi/domestic-stock/v1/ranking/fluctuation
 *   tr_id: HHDFS76200100
 *   파라미터: FID_COND_MRKT_DIV_CODE=J, FID_PRCPAT_CLAS=2(상승)/3(하락)
 *
 * 거래량 상위: GET /uapi/domestic-stock/v1/ranking/volume
 *   tr_id: FHPST01720000
 */

import { NextResponse } from 'next/server';
import type { MarketPulseData, MarketMover, TrendingSector } from '@/lib/types';
import { getKISAccessToken, isKISConfigured } from '@/lib/kis';

export const dynamic = 'force-dynamic';

/* ══════════════════════════════════════════════════════════════
 * KIS API 응답 타입 (필요 필드만 정의)
 * ══════════════════════════════════════════════════════════════ */

/** 등락 상위 / 거래량 상위 API output 한 항목 */
interface KISRankItem {
  /** 단축종목코드 (6자리) */
  stck_shrn_iscd?: string;
  /** HTS 한글 종목명 */
  hts_kor_isnm?: string;
  /** 주식 현재가 (원) */
  stck_prpr?: string;
  /** 전일 대비율 (%, 소수점 포함 문자열: "12.53" / "-6.18") */
  prdy_ctrt?: string;
  /** 전일 대비 (원) */
  prdy_vrss?: string;
  /** 누적 거래량 (주) */
  acml_vol?: string;
  /** 누적 거래대금 (원) */
  acml_tr_pbmn?: string;
  /** 시장 구분 코드 (일부 응답에만 포함) */
  bstp_cls_code?: string;
}

interface KISResponse {
  /** "0" = 정상, 그 외 = 오류 */
  rt_cd: string;
  msg_cd?: string;
  msg1?: string;
  /** 등락 상위 응답 배열 */
  output?: KISRankItem[];
  /** 일부 API는 output1/output2로 분리 */
  output1?: KISRankItem[];
}

/* ══════════════════════════════════════════════════════════════
 * Mock 폴백 상수 (KIS 미설정 / 오류 시 사용)
 * ══════════════════════════════════════════════════════════════ */

const MOCK_KR_GAINERS: MarketMover[] = [
  { rank: 1, ticker: '042700', name: '한미반도체',  market: 'KR', exchange: 'KOSPI',  currentPrice: 152300, changePercent: 12.53, changeAmount:  16950, volume: '1,842만주', currency: 'KRW' },
  { rank: 2, ticker: '247540', name: '에코프로비엠', market: 'KR', exchange: 'KOSDAQ', currentPrice:  85400, changePercent:  9.77, changeAmount:   7600, volume: '956만주',   currency: 'KRW' },
  { rank: 3, ticker: '007660', name: '이수페타시스', market: 'KR', exchange: 'KOSPI',  currentPrice:  45200, changePercent:  8.65, changeAmount:   3600, volume: '724만주',   currency: 'KRW' },
  { rank: 4, ticker: '322310', name: '오로스테크',   market: 'KR', exchange: 'KOSDAQ', currentPrice:  12850, changePercent:  7.28, changeAmount:    875, volume: '1,205만주', currency: 'KRW' },
  { rank: 5, ticker: '140860', name: '파크시스템스', market: 'KR', exchange: 'KOSDAQ', currentPrice: 182000, changePercent:  6.90, changeAmount:  11750, volume: '48만주',    currency: 'KRW' },
];

const MOCK_KR_LOSERS: MarketMover[] = [
  { rank: 1, ticker: '035720', name: '카카오',    market: 'KR', exchange: 'KOSPI', currentPrice:  38600, changePercent: -6.18, changeAmount:  -2550, volume: '3,412만주', currency: 'KRW' },
  { rank: 2, ticker: '352820', name: '하이브',     market: 'KR', exchange: 'KOSPI', currentPrice: 145200, changePercent: -5.79, changeAmount:  -8900, volume: '624만주',   currency: 'KRW' },
  { rank: 3, ticker: '259960', name: '크래프톤',   market: 'KR', exchange: 'KOSPI', currentPrice: 286500, changePercent: -4.68, changeAmount: -14050, volume: '215만주',   currency: 'KRW' },
  { rank: 4, ticker: '068270', name: '셀트리온',   market: 'KR', exchange: 'KOSPI', currentPrice: 192000, changePercent: -4.28, changeAmount:  -8600, volume: '512만주',   currency: 'KRW' },
  { rank: 5, ticker: '323410', name: '카카오뱅크', market: 'KR', exchange: 'KOSPI', currentPrice:  28100, changePercent: -3.94, changeAmount:  -1150, volume: '2,184만주', currency: 'KRW' },
];

const MOCK_KR_VOLUME: MarketMover[] = [
  { rank: 1, ticker: '005930', name: '삼성전자',   market: 'KR', exchange: 'KOSPI', currentPrice:  84200, changePercent:  2.06, changeAmount:  1700, volume: '4.2억주',  currency: 'KRW' },
  { rank: 2, ticker: '000660', name: 'SK하이닉스', market: 'KR', exchange: 'KOSPI', currentPrice: 252000, changePercent:  4.15, changeAmount: 10050, volume: '2.1억주',  currency: 'KRW' },
  { rank: 3, ticker: '005490', name: 'POSCO홀딩스',market: 'KR', exchange: 'KOSPI', currentPrice: 385000, changePercent:  3.63, changeAmount: 13500, volume: '1.8억주',  currency: 'KRW' },
  { rank: 4, ticker: '015760', name: '한국전력',   market: 'KR', exchange: 'KOSPI', currentPrice:  21350, changePercent: -1.20, changeAmount:  -260, volume: '1.5억주',  currency: 'KRW' },
  { rank: 5, ticker: '005380', name: '현대차',     market: 'KR', exchange: 'KOSPI', currentPrice: 238000, changePercent:  1.83, changeAmount:  4300, volume: '1.2억주',  currency: 'KRW' },
];

const MOCK_US_GAINERS: MarketMover[] = [
  { rank: 1, ticker: 'SMCI', name: 'Super Micro Computer', market: 'US', exchange: 'NASDAQ', currentPrice: 1485.20, changePercent: 11.24, changeAmount: 149.60, volume: '18.4M',  currency: 'USD' },
  { rank: 2, ticker: 'MSTR', name: 'MicroStrategy',        market: 'US', exchange: 'NASDAQ', currentPrice: 1820.50, changePercent:  9.71, changeAmount: 161.20, volume: '12.7M',  currency: 'USD' },
  { rank: 3, ticker: 'NVDA', name: 'NVIDIA',               market: 'US', exchange: 'NASDAQ', currentPrice: 1312.80, changePercent:  8.34, changeAmount: 101.20, volume: '52.1M',  currency: 'USD' },
  { rank: 4, ticker: 'AMD',  name: 'Advanced Micro Devices',market: 'US', exchange: 'NASDAQ', currentPrice:  248.60, changePercent:  6.12, changeAmount:  14.30, volume: '38.9M',  currency: 'USD' },
  { rank: 5, ticker: 'PLTR', name: 'Palantir Technologies', market: 'US', exchange: 'NYSE',   currentPrice:   58.40, changePercent:  5.82, changeAmount:   3.22, volume: '84.3M',  currency: 'USD' },
];

const MOCK_US_LOSERS: MarketMover[] = [
  { rank: 1, ticker: 'RIVN', name: 'Rivian Automotive', market: 'US', exchange: 'NASDAQ', currentPrice:  8.25, changePercent: -7.41, changeAmount: -0.66, volume: '62.4M', currency: 'USD' },
  { rank: 2, ticker: 'SNAP', name: 'Snap Inc.',          market: 'US', exchange: 'NYSE',   currentPrice:  9.18, changePercent: -6.82, changeAmount: -0.67, volume: '48.2M', currency: 'USD' },
  { rank: 3, ticker: 'LYFT', name: 'Lyft Inc.',          market: 'US', exchange: 'NASDAQ', currentPrice: 12.35, changePercent: -5.91, changeAmount: -0.77, volume: '31.8M', currency: 'USD' },
  { rank: 4, ticker: 'PLUG', name: 'Plug Power',         market: 'US', exchange: 'NASDAQ', currentPrice:  2.84, changePercent: -5.32, changeAmount: -0.16, volume: '55.6M', currency: 'USD' },
  { rank: 5, ticker: 'BYND', name: 'Beyond Meat',        market: 'US', exchange: 'NASDAQ', currentPrice:  3.12, changePercent: -4.82, changeAmount: -0.16, volume: '22.1M', currency: 'USD' },
];

const MOCK_US_VOLUME: MarketMover[] = [
  { rank: 1, ticker: 'TSLA', name: 'Tesla',           market: 'US', exchange: 'NASDAQ', currentPrice: 285.40, changePercent: 3.18, changeAmount: 8.80, volume: '124.5M', currency: 'USD' },
  { rank: 2, ticker: 'AAPL', name: 'Apple',           market: 'US', exchange: 'NASDAQ', currentPrice: 214.80, changePercent: 1.52, changeAmount: 3.22, volume: '88.7M',  currency: 'USD' },
  { rank: 3, ticker: 'AMZN', name: 'Amazon',          market: 'US', exchange: 'NASDAQ', currentPrice: 228.60, changePercent: 2.71, changeAmount: 6.02, volume: '67.3M',  currency: 'USD' },
  { rank: 4, ticker: 'MSFT', name: 'Microsoft',       market: 'US', exchange: 'NASDAQ', currentPrice: 484.20, changePercent: 1.92, changeAmount: 9.12, volume: '42.8M',  currency: 'USD' },
  { rank: 5, ticker: 'SPY',  name: 'SPDR S&P 500 ETF', market: 'US', exchange: 'NYSE',  currentPrice: 589.30, changePercent: 0.82, changeAmount: 4.82, volume: '38.5M',  currency: 'USD' },
];

/* ══════════════════════════════════════════════════════════════
 * 트렌딩 섹터 (큐레이션 — KIS와 무관하게 항상 표시)
 * ══════════════════════════════════════════════════════════════ */
const TRENDING_SECTORS: TrendingSector[] = [
  {
    id: 'semiconductor-hbm',
    emoji: '💾',
    name:   { ko: '반도체 / HBM',          en: 'Semiconductor / HBM' },
    theme:  { ko: 'HBM4 양산 경쟁 · CoWoS 2.5D 패키징 · AI 서버 메모리 폭주',
              en: 'HBM4 mass production · CoWoS 2.5D packaging · AI server memory surge' },
    reason: { ko: 'NVIDIA Blackwell Ultra 출하 가속화로 HBM4 수요가 공급을 압도하고 있습니다. SK하이닉스의 HBM4 독점 선탑재 계약이 확인되며 메모리 섹터 전반에 재평가 바람이 불고 있습니다.',
              en: "Accelerating NVIDIA Blackwell Ultra shipments are overwhelming HBM4 supply. SK Hynix's confirmed exclusive HBM4 pre-supply deal has triggered a broad rerating across the memory sector." },
    colorKey: 'blue',
    stocks: [
      { ticker: '000660', name: 'SK하이닉스', market: 'KR', exchange: 'KOSPI', role: 'leader',
        reason: { ko: 'HBM3E·HBM4 NVIDIA 독점 공급 계약 확정. TSMC CoWoS 패키징 협업으로 기술 해자 심화.',
                  en: "Confirmed exclusive HBM3E & HBM4 supply contract with NVIDIA. Technology moat deepened via TSMC CoWoS packaging partnership." },
        changePercent: 4.15, currentPrice: 252000, currency: 'KRW' },
      { ticker: '042700', name: '한미반도체', market: 'KR', exchange: 'KOSPI', role: 'issue',
        reason: { ko: 'TC본더 글로벌 점유율 85% 독점. HBM 패키징 필수 공정 장비.',
                  en: 'Holds 85% global market share in TC bonder equipment — a critical step in HBM packaging.' },
        changePercent: 12.53, currentPrice: 152300, currency: 'KRW' },
    ],
  },
  {
    id: 'ai-robotics',
    emoji: '🤖',
    name:   { ko: 'AI 인프라 / 로보틱스',          en: 'AI Infrastructure / Robotics' },
    theme:  { ko: 'Blackwell GB200 NVL72 · AI 에이전트 데이터센터 · 인간형 로봇',
              en: 'Blackwell GB200 NVL72 · AI agent datacenters · Humanoid robots' },
    reason: { ko: 'AI 데이터센터 전력 수요가 전례 없는 수준으로 급증하며 NVIDIA를 중심으로 인프라 투자가 폭발하고 있습니다.',
              en: 'AI datacenter power demand is surging at an unprecedented pace, fueling explosive infrastructure investment led by NVIDIA.' },
    colorKey: 'violet',
    stocks: [
      { ticker: 'NVDA', name: 'NVIDIA', market: 'US', exchange: 'NASDAQ', role: 'leader',
        reason: { ko: 'AI 데이터센터 GPU 시장 점유율 80%+. Blackwell Ultra GB300 사전 예약 폭주.',
                  en: 'Maintaining 80%+ AI datacenter GPU market share. Blackwell Ultra GB300 pre-orders overwhelming supply.' },
        changePercent: 8.34, currentPrice: 1312.80, currency: 'USD' },
      { ticker: '277810', name: '레인보우로보틱스', market: 'KR', exchange: 'KOSDAQ', role: 'issue',
        reason: { ko: '삼성전자 로보틱스 사업부 자회사 편입 기대감 재점화. 이족보행 로봇 RB-Y1 양산 임박.',
                  en: "Renewed speculation over Samsung absorbing the company. Biped robot RB-Y1 mass-production imminent." },
        changePercent: 9.41, currentPrice: 31500, currency: 'KRW' },
    ],
  },
  {
    id: 'energy-smr',
    emoji: '⚛️',
    name:   { ko: '차세대 에너지 / SMR',        en: 'Next-Gen Energy / SMR' },
    theme:  { ko: '체코 원전 수주 이행 · 미국 SMR 인허가 가속 · AI 전력난 해법',
              en: 'Czech NPP contract · US SMR licensing fast-track · AI power crisis' },
    reason: { ko: 'AI 데이터센터의 기하급수적 전력 수요가 SMR을 청정·안정 전력 공급의 핵심 솔루션으로 부상시키고 있습니다.',
              en: "The exponential power demands of AI datacenters are positioning SMRs as a key clean and stable power solution." },
    colorKey: 'amber',
    stocks: [
      { ticker: '034020', name: '두산에너빌리티', market: 'KR', exchange: 'KOSPI', role: 'leader',
        reason: { ko: 'APR1400 체코 두코바니 원전 5호기 수주 이행 본격화. 뉴스케일 SMR 기자재 계약.',
                  en: 'APR1400 contract for Czech Dukovany Unit 5 in full swing. NuScale SMR equipment supply signed.' },
        changePercent: 5.84, currentPrice: 25400, currency: 'KRW' },
      { ticker: '083650', name: '비에이치아이', market: 'KR', exchange: 'KOSPI', role: 'issue',
        reason: { ko: 'SMR 격납 용기·증기발생기 국산화 성공. 두산에너빌리티 1차 협력사 수혜.',
                  en: 'Successfully domesticated SMR containment vessel & steam generator. Tier-1 supplier to Doosan Enerbility.' },
        changePercent: 7.23, currentPrice: 55800, currency: 'KRW' },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════
 * KIS API 헬퍼
 * ══════════════════════════════════════════════════════════════ */

/**
 * 거래량 포맷: 주 단위 → "1,234만주" / "2.1억주"
 */
function fmtKorVolume(volStr: string | undefined): string {
  const v = parseInt(volStr ?? '0', 10);
  if (!v || isNaN(v)) return '-';
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억주`;
  if (v >= 10_000)      return `${Math.round(v / 10_000)}만주`;
  return `${v.toLocaleString()}주`;
}

/**
 * 종목코드 앞자리로 KOSPI/KOSDAQ 추정
 * 정확한 구분은 KIS 응답의 시장구분 코드(bstp_cls_code 등) 활용 필요
 * 본 헤리스틱은 근사치 — 실무 적용 시 개선 권장
 */
function guessExchange(ticker: string): 'KOSPI' | 'KOSDAQ' {
  // 일반적으로 코스피 종목 앞자리: 0, 1 / 코스닥: 여러 패턴
  // 완벽한 판별 불가 → KOSPI 기본값
  const first = parseInt(ticker[0] ?? '0', 10);
  return first >= 2 && first <= 9 ? 'KOSDAQ' : 'KOSPI';
}

/**
 * KIS RankItem → MarketMover 변환
 */
function kisItemToMover(item: KISRankItem, rank: number): MarketMover {
  const ticker        = item.stck_shrn_iscd ?? '';
  const currentPrice  = parseInt(item.stck_prpr  ?? '0', 10);
  const changePercent = parseFloat(item.prdy_ctrt ?? '0');
  const changeAmount  = parseInt(item.prdy_vrss   ?? '0', 10);

  return {
    rank,
    ticker,
    name:          item.hts_kor_isnm ?? ticker,
    market:        'KR',
    exchange:      guessExchange(ticker),
    currentPrice,
    changePercent,
    changeAmount,
    volume:        fmtKorVolume(item.acml_vol),
    currency:      'KRW',
  };
}

/**
 * KIS 등락 상위 API 호출
 *
 * @param token  Bearer access token
 * @param type   '2' = 상승률 상위 | '3' = 하락률 상위
 * @param limit  반환 최대 건수 (기본 5)
 */
async function fetchKISFluctuation(
  token:  string,
  type:   '2' | '3',
  limit = 5,
): Promise<MarketMover[]> {
  const base      = process.env.KIS_URL!;
  const appKey    = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'J',           // 주식(KOSPI+KOSDAQ 통합)
    FID_COND_SCR_DIV_CODE:  '20171',
    FID_INPUT_ISCD:          '0000',        // 전체 종목
    FID_RANK_SORT_CLS_CODE:  '0',
    FID_INPUT_CNT_1:         '0',
    FID_PRCPAT_CLAS:         type,          // 2=상승 / 3=하락
    FID_TRGT_EXLS_CLS_CODE:  '0000000000',
    FID_TRGT_CLS_CODE:       '111111111',
  });

  const res = await fetch(
    `${base}/uapi/domestic-stock/v1/ranking/fluctuation?${params}`,
    {
      method:  'GET',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'authorization': `Bearer ${token}`,
        'appkey':        appKey,
        'appsecret':     appSecret,
        'tr_id':         'HHDFS76200100',
        'custtype':      'P',              // P=개인, B=법인
      },
      // Next.js 데이터 캐시: 60초간 동일 요청 캐싱 (KIS Rate Limit 완화)
      next: { revalidate: 60 },
    },
  );

  if (!res.ok) {
    throw new Error(`[KIS/fluctuation] HTTP ${res.status} ${res.statusText}`);
  }

  const data: KISResponse = await res.json();

  if (data.rt_cd !== '0') {
    throw new Error(
      `[KIS/fluctuation] 업무 오류 rt_cd=${data.rt_cd} msg=${data.msg1}`,
    );
  }

  const items = data.output ?? data.output1 ?? [];
  return items.slice(0, limit).map((item, i) => kisItemToMover(item, i + 1));
}

/**
 * KIS 거래량 상위 API 호출
 *
 * @param token  Bearer access token
 * @param limit  반환 최대 건수 (기본 5)
 */
async function fetchKISVolume(
  token:  string,
  limit = 5,
): Promise<MarketMover[]> {
  const base      = process.env.KIS_URL!;
  const appKey    = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;

  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'J',
    FID_COND_SCR_DIV_CODE:  '20171',
    FID_INPUT_ISCD:          '0000',
    FID_BLNG_CLS_CODE:       '0',   // 0=평균 거래량
    FID_TRGT_CLS_CODE:       '111111111',
    FID_TRGT_EXLS_CLS_CODE:  '0000000000',
    FID_INPUT_PRICE_1:       '',
    FID_INPUT_PRICE_2:       '',
    FID_VOL_CNT:             '999999999',
    FID_INPUT_DATE_1:        '',
  });

  const res = await fetch(
    `${base}/uapi/domestic-stock/v1/ranking/volume?${params}`,
    {
      method:  'GET',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'authorization': `Bearer ${token}`,
        'appkey':        appKey,
        'appsecret':     appSecret,
        'tr_id':         'FHPST01720000',
        'custtype':      'P',
      },
      next: { revalidate: 60 },
    },
  );

  if (!res.ok) {
    throw new Error(`[KIS/volume] HTTP ${res.status} ${res.statusText}`);
  }

  const data: KISResponse = await res.json();

  if (data.rt_cd !== '0') {
    throw new Error(
      `[KIS/volume] 업무 오류 rt_cd=${data.rt_cd} msg=${data.msg1}`,
    );
  }

  const items = data.output ?? data.output1 ?? [];
  return items.slice(0, limit).map((item, i) => kisItemToMover(item, i + 1));
}

/* ══════════════════════════════════════════════════════════════
 * GET /api/market
 * ══════════════════════════════════════════════════════════════ */
export async function GET(): Promise<NextResponse> {
  /* ── KR 마켓 무버 초기화 (Mock 기본값) ── */
  let krGainers: MarketMover[] = MOCK_KR_GAINERS;
  let krLosers:  MarketMover[] = MOCK_KR_LOSERS;
  let krVolume:  MarketMover[] = MOCK_KR_VOLUME;
  let dataSource: 'live' | 'mock' = 'mock';
  let kisError: string | null = null;

  /* ── KIS 환경변수 설정 여부 확인 ── */
  if (isKISConfigured()) {
    try {
      /* ① 토큰 발급 (캐시 우선) */
      const token = await getKISAccessToken();

      /* ② 3개 엔드포인트 병렬 호출 */
      const [liveGainers, liveLosers, liveVolume] = await Promise.allSettled([
        fetchKISFluctuation(token, '2'),   // 급등주
        fetchKISFluctuation(token, '3'),   // 급락주
        fetchKISVolume(token),             // 거래량
      ]);

      let anyLive = false;

      if (liveGainers.status === 'fulfilled' && liveGainers.value.length > 0) {
        krGainers = liveGainers.value;
        anyLive   = true;
      } else if (liveGainers.status === 'rejected') {
        console.warn('[Market API] 급등주 KIS 호출 실패:', liveGainers.reason);
      }

      if (liveLosers.status === 'fulfilled' && liveLosers.value.length > 0) {
        krLosers = liveLosers.value;
        anyLive  = true;
      } else if (liveLosers.status === 'rejected') {
        console.warn('[Market API] 급락주 KIS 호출 실패:', liveLosers.reason);
      }

      if (liveVolume.status === 'fulfilled' && liveVolume.value.length > 0) {
        krVolume = liveVolume.value;
        anyLive  = true;
      } else if (liveVolume.status === 'rejected') {
        console.warn('[Market API] 거래량 KIS 호출 실패:', liveVolume.reason);
      }

      if (anyLive) dataSource = 'live';

    } catch (err) {
      /*
       * 토큰 발급 단계에서 실패 (환경변수 오류, 네트워크 등)
       * → Mock 데이터로 전체 폴백
       */
      kisError = err instanceof Error ? err.message : String(err);
      console.error('[Market API] KIS 인증 실패, Mock 폴백:', kisError);
    }
  }

  /* ── 응답 페이로드 조합 ── */
  const payload: MarketPulseData & { kisError?: string } = {
    movers: {
      kr: { gainers: krGainers, losers: krLosers, volume: krVolume },
      us: { gainers: MOCK_US_GAINERS, losers: MOCK_US_LOSERS, volume: MOCK_US_VOLUME },
    },
    sectors:    TRENDING_SECTORS,
    fetchedAt:  new Date().toISOString(),
    dataSource,
    /* kisError는 디버깅용 — 프로덕션에서 제거 가능 */
    ...(kisError ? { kisError } : {}),
  };

  return NextResponse.json(payload, {
    headers: {
      /*
       * · live: no-cache (항상 최신 KIS 데이터)
       * · mock: 30초 캐시
       */
      'Cache-Control': dataSource === 'live'
        ? 'no-cache, no-store, must-revalidate'
        : 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
