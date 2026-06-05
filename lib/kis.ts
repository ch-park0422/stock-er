/**
 * lib/kis.ts
 * 한국투자증권(KIS) Open API 인증 토큰 관리 유틸리티
 *
 * ── 주요 기능 ───────────────────────────────────────────────
 * · Access Token 발급 (`POST /oauth2/tokenP`)
 * · 모듈 레벨 인메모리 캐시 — 만료 5분 전에 자동 갱신
 * · 환경변수 누락 시 명확한 에러 메시지로 조기 실패
 *
 * ── 프로덕션 고려사항 ─────────────────────────────────────
 * · KIS 토큰 발급 횟수 제한: 하루 ~1,000회 (무분별한 재발급 금지)
 * · Serverless(Vercel Edge) Cold Start 시 캐시가 초기화되므로
 *   고빈도 인스턴스 환경에서는 Upstash Redis 등 외부 캐시 권장
 * · 실전/모의 투자 구분:
 *   실전: https://openapi.koreainvestment.com:29443 (현재 .env.local)
 *   모의: https://openapivts.koreainvestment.com:29443
 *
 * ── 환경변수 ──────────────────────────────────────────────
 * KIS_URL       = https://openapi.koreainvestment.com:29443
 * KIS_APP_KEY   = 한투 개발자 포털 발급 앱키
 * KIS_APP_SECRET= 한투 개발자 포털 발급 앱시크릿
 */

/** /oauth2/tokenP 응답 형식 */
interface KISTokenResponse {
  /** Bearer 토큰 문자열 */
  access_token: string;
  /** 항상 "Bearer" */
  token_type: string;
  /** 유효 기간 (초 단위, 보통 86400 = 24시간) */
  expires_in: number;
  /** 만료 일시 (ISO 문자열, 한투 응답에 포함되는 경우 있음) */
  access_token_token_expired?: string;
}

/** 인메모리 캐시 구조 */
interface KISTokenCache {
  accessToken: string;
  /** Date.now() + (expires_in − 60) × 1000 */
  expiresAt: number;
}

/** 모듈 레벨 캐시 변수 — 프로세스 재시작 시 초기화 */
let _tokenCache: KISTokenCache | null = null;

/** 만료 5분 전 갱신 여유 (ms) */
const REFRESH_BUFFER_MS = 5 * 60 * 1_000;

/* ─────────────────────────────────────────────
 * 환경변수 검증
 * ───────────────────────────────────────────── */
function assertEnv(): { base: string; appKey: string; appSecret: string } {
  const base      = process.env.KIS_URL;
  const appKey    = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!base)
    throw new Error('[KIS] KIS_URL 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.');
  if (!appKey)
    throw new Error('[KIS] KIS_APP_KEY 환경변수가 설정되지 않았습니다.');
  if (!appSecret)
    throw new Error('[KIS] KIS_APP_SECRET 환경변수가 설정되지 않았습니다.');

  return { base, appKey, appSecret };
}

/* ─────────────────────────────────────────────
 * 공개 API
 * ───────────────────────────────────────────── */

/**
 * KIS Access Token 반환 (캐시 우선 / 만료 임박 시 자동 갱신)
 *
 * @throws 환경변수 미설정 or KIS 서버 오류 시 Error
 */
export async function getKISAccessToken(): Promise<string> {
  const now = Date.now();

  /* 유효 캐시 히트 */
  if (_tokenCache && _tokenCache.expiresAt - now > REFRESH_BUFFER_MS) {
    return _tokenCache.accessToken;
  }

  const { base, appKey, appSecret } = assertEnv();

  /* 토큰 신규 발급 */
  const res = await fetch(`${base}/oauth2/tokenP`, {
    method:  'POST',
    headers: { 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey:     appKey,
      appsecret:  appSecret,
    }),
    // 토큰 발급 요청은 캐시 없이 항상 최신 발급
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[KIS] 토큰 발급 실패 — HTTP ${res.status}: ${body}`);
  }

  const data: KISTokenResponse = await res.json();

  if (!data.access_token) {
    throw new Error(`[KIS] access_token 누락 — 응답: ${JSON.stringify(data)}`);
  }

  /*
   * KIS 토큰 기본 유효기간: 86400초 (24시간)
   * 안전을 위해 60초 추가 차감 후 캐시에 저장
   */
  const ttlSec = (data.expires_in ?? 86_400) - 60;

  _tokenCache = {
    accessToken: data.access_token,
    expiresAt:   now + ttlSec * 1_000,
  };

  return _tokenCache.accessToken;
}

/**
 * 토큰 캐시 강제 초기화 (테스트 / 디버그용)
 */
export function clearKISTokenCache(): void {
  _tokenCache = null;
}

/**
 * KIS 환경변수가 모두 설정되어 있는지 확인
 * 설정 여부에 따라 live / mock 모드를 분기하는 데 사용
 */
export function isKISConfigured(): boolean {
  return !!(
    process.env.KIS_URL &&
    process.env.KIS_APP_KEY &&
    process.env.KIS_APP_SECRET
  );
}
