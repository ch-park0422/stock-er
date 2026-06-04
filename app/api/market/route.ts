/**
 * app/api/market/route.ts
 * Market Pulse API — 실시간 마켓 무버 + 주도 섹터 데이터
 *
 * 현재: DomesticStockData 인터페이스 기반 시뮬레이션 Mock 데이터
 *
 * 스위칭 가이드:
 *  1. 한국투자증권 Open API (KIS) 연동:
 *     - FLTT_TYPE=2 (등락율 기준) → GET /uapi/domestic-stock/v1/ranking/fluctuation
 *     - 환경변수 KIS_APP_KEY / KIS_APP_SECRET 설정
 *  2. DART OpenAPI 연동 (기업 공시·재무):
 *     - 환경변수 DART_API_KEY 설정
 *     - GET https://opendart.fss.or.kr/api/list.json
 *  3. dataSource 필드를 'live'로 변경하면 프론트엔드에서 라이브 배지 표시 가능
 */

import { NextResponse } from 'next/server';
import type { MarketPulseData, MarketMover, TrendingSector } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* ══════════════════════════════════════════════════════════════
 * 시뮬레이션 마켓 무버 데이터
 * 실 API 연동 시 아래 상수들을 KIS API 응답으로 교체하세요.
 * ══════════════════════════════════════════════════════════════ */

const KR_GAINERS: MarketMover[] = [
  { rank: 1, ticker: '042700', name: '한미반도체',   market: 'KR', exchange: 'KOSPI', currentPrice: 152300, changePercent: 12.53, changeAmount: 16950, volume: '1,842만주', currency: 'KRW' },
  { rank: 2, ticker: '247540', name: '에코프로비엠',  market: 'KR', exchange: 'KOSDAQ', currentPrice: 85400, changePercent: 9.77, changeAmount: 7600,  volume: '956만주',  currency: 'KRW' },
  { rank: 3, ticker: '007660', name: '이수페타시스',  market: 'KR', exchange: 'KOSPI', currentPrice: 45200, changePercent: 8.65, changeAmount: 3600,  volume: '724만주',  currency: 'KRW' },
  { rank: 4, ticker: '322310', name: '오로스테크',    market: 'KR', exchange: 'KOSDAQ', currentPrice: 12850, changePercent: 7.28, changeAmount: 875,   volume: '1,205만주', currency: 'KRW' },
  { rank: 5, ticker: '140860', name: '파크시스템스',  market: 'KR', exchange: 'KOSDAQ', currentPrice: 182000, changePercent: 6.90, changeAmount: 11750, volume: '48만주',   currency: 'KRW' },
];

const KR_LOSERS: MarketMover[] = [
  { rank: 1, ticker: '035720', name: '카카오',       market: 'KR', exchange: 'KOSPI', currentPrice: 38600,  changePercent: -6.18, changeAmount: -2550, volume: '3,412만주', currency: 'KRW' },
  { rank: 2, ticker: '352820', name: '하이브',        market: 'KR', exchange: 'KOSPI', currentPrice: 145200, changePercent: -5.79, changeAmount: -8900, volume: '624만주',  currency: 'KRW' },
  { rank: 3, ticker: '259960', name: '크래프톤',      market: 'KR', exchange: 'KOSPI', currentPrice: 286500, changePercent: -4.68, changeAmount: -14050, volume: '215만주', currency: 'KRW' },
  { rank: 4, ticker: '068270', name: '셀트리온',      market: 'KR', exchange: 'KOSPI', currentPrice: 192000, changePercent: -4.28, changeAmount: -8600, volume: '512만주',  currency: 'KRW' },
  { rank: 5, ticker: '323410', name: '카카오뱅크',    market: 'KR', exchange: 'KOSPI', currentPrice: 28100,  changePercent: -3.94, changeAmount: -1150, volume: '2,184만주', currency: 'KRW' },
];

const KR_VOLUME: MarketMover[] = [
  { rank: 1, ticker: '005930', name: '삼성전자',      market: 'KR', exchange: 'KOSPI', currentPrice: 84200,  changePercent: 2.06,  changeAmount: 1700,  volume: '4.2억주',   currency: 'KRW' },
  { rank: 2, ticker: '000660', name: 'SK하이닉스',    market: 'KR', exchange: 'KOSPI', currentPrice: 252000, changePercent: 4.15,  changeAmount: 10050, volume: '2.1억주',   currency: 'KRW' },
  { rank: 3, ticker: '005490', name: 'POSCO홀딩스',   market: 'KR', exchange: 'KOSPI', currentPrice: 385000, changePercent: 3.63,  changeAmount: 13500, volume: '1.8억주',   currency: 'KRW' },
  { rank: 4, ticker: '015760', name: '한국전력',       market: 'KR', exchange: 'KOSPI', currentPrice: 21350,  changePercent: -1.20, changeAmount: -260,  volume: '1.5억주',   currency: 'KRW' },
  { rank: 5, ticker: '005380', name: '현대차',         market: 'KR', exchange: 'KOSPI', currentPrice: 238000, changePercent: 1.83,  changeAmount: 4300,  volume: '1.2억주',   currency: 'KRW' },
];

const US_GAINERS: MarketMover[] = [
  { rank: 1, ticker: 'SMCI',  name: 'Super Micro Computer', market: 'US', exchange: 'NASDAQ', currentPrice: 1485.20, changePercent: 11.24, changeAmount: 149.60, volume: '18.4M', currency: 'USD' },
  { rank: 2, ticker: 'MSTR',  name: 'MicroStrategy',        market: 'US', exchange: 'NASDAQ', currentPrice: 1820.50, changePercent: 9.71,  changeAmount: 161.20, volume: '12.7M', currency: 'USD' },
  { rank: 3, ticker: 'NVDA',  name: 'NVIDIA',                market: 'US', exchange: 'NASDAQ', currentPrice: 1312.80, changePercent: 8.34,  changeAmount: 101.20, volume: '52.1M', currency: 'USD' },
  { rank: 4, ticker: 'AMD',   name: 'Advanced Micro Devices',market: 'US', exchange: 'NASDAQ', currentPrice: 248.60,  changePercent: 6.12,  changeAmount: 14.30,  volume: '38.9M', currency: 'USD' },
  { rank: 5, ticker: 'PLTR',  name: 'Palantir Technologies', market: 'US', exchange: 'NYSE',   currentPrice: 58.40,   changePercent: 5.82,  changeAmount: 3.22,   volume: '84.3M', currency: 'USD' },
];

const US_LOSERS: MarketMover[] = [
  { rank: 1, ticker: 'RIVN',  name: 'Rivian Automotive',    market: 'US', exchange: 'NASDAQ', currentPrice: 8.25,  changePercent: -7.41, changeAmount: -0.66, volume: '62.4M', currency: 'USD' },
  { rank: 2, ticker: 'SNAP',  name: 'Snap Inc.',             market: 'US', exchange: 'NYSE',   currentPrice: 9.18,  changePercent: -6.82, changeAmount: -0.67, volume: '48.2M', currency: 'USD' },
  { rank: 3, ticker: 'LYFT',  name: 'Lyft Inc.',             market: 'US', exchange: 'NASDAQ', currentPrice: 12.35, changePercent: -5.91, changeAmount: -0.77, volume: '31.8M', currency: 'USD' },
  { rank: 4, ticker: 'PLUG',  name: 'Plug Power',            market: 'US', exchange: 'NASDAQ', currentPrice: 2.84,  changePercent: -5.32, changeAmount: -0.16, volume: '55.6M', currency: 'USD' },
  { rank: 5, ticker: 'BYND',  name: 'Beyond Meat',           market: 'US', exchange: 'NASDAQ', currentPrice: 3.12,  changePercent: -4.82, changeAmount: -0.16, volume: '22.1M', currency: 'USD' },
];

const US_VOLUME: MarketMover[] = [
  { rank: 1, ticker: 'TSLA',  name: 'Tesla',                 market: 'US', exchange: 'NASDAQ', currentPrice: 285.40, changePercent: 3.18, changeAmount: 8.80,  volume: '124.5M', currency: 'USD' },
  { rank: 2, ticker: 'AAPL',  name: 'Apple',                 market: 'US', exchange: 'NASDAQ', currentPrice: 214.80, changePercent: 1.52, changeAmount: 3.22,  volume: '88.7M',  currency: 'USD' },
  { rank: 3, ticker: 'AMZN',  name: 'Amazon',                market: 'US', exchange: 'NASDAQ', currentPrice: 228.60, changePercent: 2.71, changeAmount: 6.02,  volume: '67.3M',  currency: 'USD' },
  { rank: 4, ticker: 'MSFT',  name: 'Microsoft',             market: 'US', exchange: 'NASDAQ', currentPrice: 484.20, changePercent: 1.92, changeAmount: 9.12,  volume: '42.8M',  currency: 'USD' },
  { rank: 5, ticker: 'SPY',   name: 'SPDR S&P 500 ETF',      market: 'US', exchange: 'NYSE',   currentPrice: 589.30, changePercent: 0.82, changeAmount: 4.82,  volume: '38.5M',  currency: 'USD' },
];

/* ══════════════════════════════════════════════════════════════
 * 시뮬레이션 트렌딩 섹터 데이터
 * ══════════════════════════════════════════════════════════════ */

const TRENDING_SECTORS: TrendingSector[] = [
  {
    id: 'semiconductor-hbm',
    emoji: '💾',
    name: {
      ko: '반도체 / HBM',
      en: 'Semiconductor / HBM',
    },
    theme: {
      ko: 'HBM4 양산 경쟁 · CoWoS 2.5D 패키징 · AI 서버 메모리 폭주',
      en: 'HBM4 mass production · CoWoS 2.5D packaging · AI server memory surge',
    },
    reason: {
      ko: 'NVIDIA Blackwell Ultra 출하 가속화로 HBM4 수요가 공급을 압도하고 있습니다. SK하이닉스의 HBM4 독점 선탑재 계약이 확인되며 메모리 섹터 전반에 재평가 바람이 불고 있습니다.',
      en: "Accelerating NVIDIA Blackwell Ultra shipments are overwhelming HBM4 supply. SK Hynix's confirmed exclusive HBM4 pre-supply deal has triggered a broad rerating across the memory sector.",
    },
    colorKey: 'blue',
    stocks: [
      {
        ticker: '000660',
        name: 'SK하이닉스',
        market: 'KR',
        exchange: 'KOSPI',
        role: 'leader',
        reason: {
          ko: 'HBM3E·HBM4 NVIDIA 독점 공급 계약 확정. TSMC CoWoS 패키징 협업으로 기술 해자 심화. 메모리 섹터 시총 1위 독보적 입지.',
          en: "Confirmed exclusive HBM3E & HBM4 supply contract with NVIDIA. Technology moat deepened via TSMC CoWoS packaging partnership. Dominant #1 position by market cap in the memory sector.",
        },
        changePercent: 4.15,
        currentPrice: 252000,
        currency: 'KRW',
      },
      {
        ticker: '042700',
        name: '한미반도체',
        market: 'KR',
        exchange: 'KOSPI',
        role: 'issue',
        reason: {
          ko: 'TC본더(열압착 본딩 장비) 글로벌 점유율 85% 독점. HBM 패키징 필수 공정 장비로 SK하이닉스·삼성전자 모두 주요 고객. HBM 수주잔고 급증.',
          en: 'Holds 85% global market share in TC bonder equipment — a critical step in HBM packaging. Both SK Hynix and Samsung Electronics are key customers. HBM order backlog surging.',
        },
        changePercent: 12.53,
        currentPrice: 152300,
        currency: 'KRW',
      },
    ],
  },
  {
    id: 'ai-robotics',
    emoji: '🤖',
    name: {
      ko: 'AI 인프라 / 로보틱스',
      en: 'AI Infrastructure / Robotics',
    },
    theme: {
      ko: 'Blackwell GB200 NVL72 · AI 에이전트 데이터센터 · 인간형 로봇 상용화',
      en: 'Blackwell GB200 NVL72 · AI agent datacenters · Humanoid robot commercialization',
    },
    reason: {
      ko: 'AI 데이터센터 전력 수요가 전례 없는 수준으로 급증하며 NVIDIA를 중심으로 인프라 투자가 폭발하고 있습니다. 동시에 삼성·현대·보스턴다이내믹스발 인간형 로봇 상용화 로드맵이 가시화되며 로보틱스 섹터도 주목받고 있습니다.',
      en: 'AI datacenter power demand is surging at an unprecedented pace, fueling explosive infrastructure investment led by NVIDIA. Meanwhile, commercialization roadmaps from Samsung, Hyundai, and Boston Dynamics are putting robotics firmly in the spotlight.',
    },
    colorKey: 'violet',
    stocks: [
      {
        ticker: 'NVDA',
        name: 'NVIDIA',
        market: 'US',
        exchange: 'NASDAQ',
        role: 'leader',
        reason: {
          ko: 'AI 데이터센터 GPU 시장 점유율 80%+ 유지. Blackwell Ultra GB300 사전 예약 폭주. FY2026 데이터센터 매출 연간 +120% 예상. AI 인프라 섹터 기준주.',
          en: 'Maintaining 80%+ share of the AI datacenter GPU market. Blackwell Ultra GB300 pre-orders overwhelming supply. FY2026 datacenter revenue forecast up +120% YoY. Undisputed benchmark stock for AI infrastructure.',
        },
        changePercent: 8.34,
        currentPrice: 1312.80,
        currency: 'USD',
      },
      {
        ticker: '277810',
        name: '레인보우로보틱스',
        market: 'KR',
        exchange: 'KOSDAQ',
        role: 'issue',
        reason: {
          ko: '삼성전자 로보틱스 사업부 자회사 편입 기대감 재점화. 이족보행 로봇 RB-Y1 양산 계획 발표 임박 소문. 국내 로보틱스 순수 플레이 대표주.',
          en: "Renewed speculation over Samsung Electronics absorbing the company into its robotics division. Rumors of imminent mass-production announcement for biped robot RB-Y1. Korea's leading pure-play robotics stock.",
        },
        changePercent: 9.41,
        currentPrice: 31500,
        currency: 'KRW',
      },
    ],
  },
  {
    id: 'energy-smr',
    emoji: '⚛️',
    name: {
      ko: '차세대 에너지 / SMR',
      en: 'Next-Gen Energy / SMR',
    },
    theme: {
      ko: '체코 원전 수주 이행 · 미국 SMR 인허가 가속 · AI 전력난 해법',
      en: 'Czech NPP contract fulfillment · US SMR licensing fast-track · AI power crisis solution',
    },
    reason: {
      ko: 'AI 데이터센터의 기하급수적 전력 수요가 SMR(소형모듈원자로)을 청정·안정 전력 공급의 핵심 솔루션으로 부상시키고 있습니다. 한국의 체코 APR1400 수주 이행과 미국 NRC의 SMR 인허가 간소화 정책이 맞물려 원자력 섹터가 재조명되고 있습니다.',
      en: "The exponential power demands of AI datacenters are positioning SMRs (Small Modular Reactors) as a key clean and stable power solution. Korea's APR1400 contract delivery in the Czech Republic, combined with the NRC's streamlined SMR licensing policy, is shining a fresh spotlight on the nuclear sector.",
    },
    colorKey: 'amber',
    stocks: [
      {
        ticker: '034020',
        name: '두산에너빌리티',
        market: 'KR',
        exchange: 'KOSPI',
        role: 'leader',
        reason: {
          ko: 'APR1400 체코 두코바니 원전 5호기 수주 이행 본격화. 미국 뉴스케일(NuScale) SMR 핵심 기자재 공급 계약 체결. 국내 원전 섹터 시총 1위 대장주.',
          en: 'APR1400 contract execution for Czech Dukovany Unit 5 entering full swing. Core equipment supply agreement signed for US NuScale SMR project. Largest-cap nuclear stock in Korea.',
        },
        changePercent: 5.84,
        currentPrice: 25400,
        currency: 'KRW',
      },
      {
        ticker: '083650',
        name: '비에이치아이',
        market: 'KR',
        exchange: 'KOSPI',
        role: 'issue',
        reason: {
          ko: 'SMR 핵심 부품 격납 용기·증기발생기 국산화 성공. 두산에너빌리티 1차 협력사로 원전 수주 연동 실적 자동 수혜. 소형주 고밸류 리레이팅 기대.',
          en: 'Successfully domesticated containment vessel and steam generator components for SMR. Tier-1 supplier to Doosan Enerbility — automatically benefits from every nuclear contract win. Small-cap re-rating thesis building.',
        },
        changePercent: 7.23,
        currentPrice: 55800,
        currency: 'KRW',
      },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════
 * GET /api/market
 * ══════════════════════════════════════════════════════════════ */
export async function GET(): Promise<NextResponse> {
  const payload: MarketPulseData = {
    movers: {
      kr: { gainers: KR_GAINERS, losers: KR_LOSERS, volume: KR_VOLUME },
      us: { gainers: US_GAINERS, losers: US_LOSERS, volume: US_VOLUME },
    },
    sectors: TRENDING_SECTORS,
    fetchedAt: new Date().toISOString(),
    dataSource: 'mock',
  };

  return NextResponse.json(payload, {
    headers: {
      // 브라우저 캐시 30초 (실 API 연동 시 60 이상으로 조정)
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
