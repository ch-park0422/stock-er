/**
 * lib/i18n.ts
 * KO / EN 번역 딕셔너리
 *
 * 사용법:
 *   const t = translations[lang];
 *   t.dashboard.searchBtn  →  '검색' | 'Search'
 */

// ─────────────────────────────────────────────
// Dashboard (app/page.tsx)
// ─────────────────────────────────────────────
const dashboard = {
  ko: {
    /* Header */
    brandTag:          'AI 주가 분석',
    searchPlaceholder: '티커·종목명 입력 (AAPL, 삼성전자…)',
    searchBtn:         '검색',
    searching:         '조회 중',
    loadingOverlay:    (t: string) => `${t} 데이터 로딩 중…`,
    qaLink:            'QA',

    /* 면책 배너 */
    bannerText: '본 서비스는 투자 편의를 위한 분석 시스템으로, 투자 결과에 대한 책임을 지지 않습니다.',
    bannerLink: '서비스 분석 기준 및 면책조항 보기 →',

    /* LoadingScreen */
    loadingTitle:    (t: string) => `${t} 분석 중…`,
    loadingSubtitle: '실시간 데이터를 불러오고 있습니다',

    /* ErrorScreen */
    errorTitle:   'API 호출 불가',
    errorSubtitle: (t: string) => `${t} 데이터를 불러올 수 없습니다.`,
    errorDetail:  '오류 상세',
    errorHint:    'API 키를 확인하거나 잠시 후 다시 시도해 주세요.',
    errorHintSub: '.env.local → STOCK_API_KEY / FINNHUB_API_KEY',
    retryBtn:     '다시 시도',

    /* ProfileCard */
    dataRefresh: '데이터 새로고침',
    week52Range: '52주 범위',
    week52Pos:   (pct: number) => `52주 범위의 ${pct}% 위치`,
    marketCap:   '시가총액',
    peRatio:     'P/E 비율',
    volume:      '거래량',
    employees:   '임직원',

    /* Tabs */
    tabFundamental: '📊  기업 펀더멘탈 분석',
    tabTechnical:   '📈  기술적 차트 분석',

    /* Section dividers */
    secMetrics:    '주요 투자 지표',
    secDCF:        'DCF 내재가치 분석 (실시간 계산)',
    secAI:         'AI 종합 투자 매력도',
    secPriceChart: '주가 차트 (SMA20 · SMA60)',
    secIndicators: '보조지표 (RSI · MACD)',

    /* MetricCard labels & descriptions */
    perLabel: 'PER (주가수익비율)',
    perDesc:  '낮을수록 이익 대비 저평가. 성장주는 업종 평균보다 높게 형성.',
    pbrLabel: 'PBR (주가순자산비율)',
    pbrDesc:  '낮을수록 자산 대비 저평가. 1배 미만은 청산가치 이하를 의미.',
    roeLabel: 'ROE (자기자본이익률)',
    roeDesc:  '높을수록 자본 활용 효율 우수. 워런 버핏이 중요시하는 지표.',
    evLabel:  'EV/EBITDA',
    evDesc:   '기업가치 대비 현금 창출력. M&A 가치평가에 활용되는 부채 중립 지표.',
    metricGood:    '양호',
    metricCaution: '주의',
    industryAvg:   '업종평균',

    /* Valuation labels (from getValuationLabel) */
    valUnder: '저평가',
    valOver:  '고평가',
    valFair:  '적정',

    /* DCFGauge */
    dcfTitle:     'DCF 적정 주가 분석',
    dcfSub:       '현금흐름할인(DCF) 모델 · 슬라이더로 가정치 조정',
    dcfUnder:     '저평가',
    dcfOver:      '고평가',
    dcfFairLabel: '적정',
    dcfBear:      '🐻 Bear (-30%)',
    dcfCurrent:   '현재 주가',
    dcfBull:      '🐂 Bull (+40%)',
    pvFCFs:       'PV of FCFs',
    termVal:      'Terminal Value',
    ev:           'EV',
    dcfAdjust:    'DCF 가정치 조정',
    dcfReset:     '↺ 기본값',
    growthRate:   'FCF 성장률',
    growthSub:    '예상 연간 잉여현금흐름 성장률',
    wacc:         '할인율 (WACC)',
    waccSub:      '가중평균자본비용',
    termGrowth:   '영구 성장률',
    termSub:      '터미널 밸류 영구 성장 가정',

    /* FinancialHealth */
    healthTitle:      '수익성 & 재무 건전성',
    grossMargin:      '매출총이익률',
    operatingMargin:  '영업이익률',
    netMargin:        '순이익률',
    divYield:         '배당수익률',
    noDiv:            '없음',
    debtToEquity:     '부채비율(D/E)',
    currentRatio:     '유동비율',

    /* AIScoreWidget */
    aiTitle:    'AI 종합 투자 매력도',
    aiSubLabel: '슬라이더 조정 시 실시간 갱신',
    /* category 번역 맵 */
    aiCategories: {
      'DCF 내재가치':    'DCF 내재가치',
      'RSI 모멘텀':      'RSI 모멘텀',
      'MA 추세':         'MA 추세',
      '상대 밸류에이션': '상대 밸류에이션',
    } as Record<string, string>,
    /* grade 번역 맵 */
    aiGrades: {
      '★★★ 강력 매수': '★★★ 강력 매수',
      '★★ 매수':       '★★ 매수',
      '★ 중립':         '★ 중립',
      '⚠ 매도':         '⚠ 매도',
      '⛔ 강력 매도':   '⛔ 강력 매도',
    } as Record<string, string>,
    /* feedback 번역 맵 */
    aiFeedbacks: {
      '펀더멘탈·기술적 지표 모두 매수 우호적. 분할 매수 적극 검토 구간.':
        '펀더멘탈·기술적 지표 모두 매수 우호적. 분할 매수 적극 검토 구간.',
      '대부분의 지표가 긍정적. 리스크 관리 하에 매수 접근 권장.':
        '대부분의 지표가 긍정적. 리스크 관리 하에 매수 접근 권장.',
      '지표 혼조세. 방향성 확인 후 포지션 결정 권장.':
        '지표 혼조세. 방향성 확인 후 포지션 결정 권장.',
      '복수 지표에서 약세 신호. 보유 비중 축소 검토.':
        '복수 지표에서 약세 신호. 보유 비중 축소 검토.',
      '펀더멘탈·기술적 지표 모두 취약. 손절 또는 회피 권장.':
        '펀더멘탈·기술적 지표 모두 취약. 손절 또는 회피 권장.',
    } as Record<string, string>,

    /* Charts */
    priceChartTitle: '주가 차트 + 이동평균선 (SMA)',
    close:    '종가',
    open:     '시가',
    high:     '고가',
    low:      '저가',
    volumeLabel: '거래량',
    rsiTitle: 'RSI',
    rsiSub:   '(Wilder, 14)',
    overbought: '과매수',
    oversold:   '과매도',
    neutralZone: '중립',
    zone:       '구간',
    macdTitle:  'MACD',
    macdSub:    '(12, 26, 9)',

    /* Footer */
    footerData: '실시간 시장 데이터 (Alpha Vantage / Finnhub)',
    footerNote: '실제 투자 결정에 활용하지 마세요.',
    footerQA:   'QA 테스트 하네스',
  },

  en: {
    /* Header */
    brandTag:          'AI Stock Analysis',
    searchPlaceholder: 'Ticker or company name (AAPL, Samsung…)',
    searchBtn:         'Search',
    searching:         'Loading',
    loadingOverlay:    (t: string) => `Loading ${t} data…`,
    qaLink:            'QA',

    /* 면책 배너 */
    bannerText: 'This service is an analysis tool for reference only. We bear no responsibility for investment outcomes.',
    bannerLink: 'View Analysis Methodology & Disclaimer →',

    /* LoadingScreen */
    loadingTitle:    (t: string) => `Analyzing ${t}…`,
    loadingSubtitle: 'Fetching real-time market data',

    /* ErrorScreen */
    errorTitle:   'API Unavailable',
    errorSubtitle: (t: string) => `Unable to load data for ${t}.`,
    errorDetail:  'Error Details',
    errorHint:    'Please check your API keys or try again later.',
    errorHintSub: '.env.local → STOCK_API_KEY / FINNHUB_API_KEY',
    retryBtn:     'Retry',

    /* ProfileCard */
    dataRefresh: 'Refresh data',
    week52Range: '52-Week Range',
    week52Pos:   (pct: number) => `${pct}% of 52-week range`,
    marketCap:   'Market Cap',
    peRatio:     'P/E Ratio',
    volume:      'Volume',
    employees:   'Employees',

    /* Tabs */
    tabFundamental: '📊  Fundamental Analysis',
    tabTechnical:   '📈  Technical Analysis',

    /* Section dividers */
    secMetrics:    'Key Investment Metrics',
    secDCF:        'DCF Intrinsic Value (Real-time)',
    secAI:         'AI Investment Attractiveness',
    secPriceChart: 'Price Chart (SMA20 · SMA60)',
    secIndicators: 'Indicators (RSI · MACD)',

    /* MetricCard labels & descriptions */
    perLabel: 'P/E Ratio',
    perDesc:  'Lower indicates relatively undervalued vs earnings. Growth stocks often trade at a premium.',
    pbrLabel: 'P/B Ratio',
    pbrDesc:  'Lower means undervalued vs book value. Below 1× implies trading below liquidation value.',
    roeLabel: 'Return on Equity (ROE)',
    roeDesc:  'Higher means better capital efficiency. A key metric favored by Warren Buffett.',
    evLabel:  'EV/EBITDA',
    evDesc:   'Enterprise value vs cash generation. A debt-neutral metric widely used in M&A valuation.',
    metricGood:    'Good',
    metricCaution: 'Caution',
    industryAvg:   'Ind. Avg.',

    /* Valuation labels */
    valUnder: 'Undervalued',
    valOver:  'Overvalued',
    valFair:  'Fair Value',

    /* DCFGauge */
    dcfTitle:     'DCF Fair Value Analysis',
    dcfSub:       'Discounted Cash Flow model · Adjust assumptions with sliders',
    dcfUnder:     'Undervalued',
    dcfOver:      'Overvalued',
    dcfFairLabel: 'Fair',
    dcfBear:      '🐻 Bear (−30%)',
    dcfCurrent:   'Current Price',
    dcfBull:      '🐂 Bull (+40%)',
    pvFCFs:       'PV of FCFs',
    termVal:      'Terminal Value',
    ev:           'EV',
    dcfAdjust:    'Adjust DCF Assumptions',
    dcfReset:     '↺ Reset',
    growthRate:   'FCF Growth Rate',
    growthSub:    'Expected annual free cash flow growth',
    wacc:         'Discount Rate (WACC)',
    waccSub:      'Weighted average cost of capital',
    termGrowth:   'Terminal Growth Rate',
    termSub:      'Perpetual growth assumption for terminal value',

    /* FinancialHealth */
    healthTitle:      'Profitability & Financial Health',
    grossMargin:      'Gross Margin',
    operatingMargin:  'Operating Margin',
    netMargin:        'Net Margin',
    divYield:         'Dividend Yield',
    noDiv:            'None',
    debtToEquity:     'Debt / Equity',
    currentRatio:     'Current Ratio',

    /* AIScoreWidget */
    aiTitle:    'AI Investment Attractiveness',
    aiSubLabel: 'Updates in real-time with slider changes',
    aiCategories: {
      'DCF 내재가치':    'DCF Intrinsic Value',
      'RSI 모멘텀':      'RSI Momentum',
      'MA 추세':         'MA Trend',
      '상대 밸류에이션': 'Relative Valuation',
    } as Record<string, string>,
    aiGrades: {
      '★★★ 강력 매수': '★★★ Strong Buy',
      '★★ 매수':       '★★ Buy',
      '★ 중립':         '★ Neutral',
      '⚠ 매도':         '⚠ Sell',
      '⛔ 강력 매도':   '⛔ Strong Sell',
    } as Record<string, string>,
    aiFeedbacks: {
      '펀더멘탈·기술적 지표 모두 매수 우호적. 분할 매수 적극 검토 구간.':
        'Both fundamental and technical signals are bullish. Consider accumulating in tranches.',
      '대부분의 지표가 긍정적. 리스크 관리 하에 매수 접근 권장.':
        'Most indicators are positive. Buying with disciplined risk management is advisable.',
      '지표 혼조세. 방향성 확인 후 포지션 결정 권장.':
        'Mixed signals across indicators. Wait for directional confirmation before positioning.',
      '복수 지표에서 약세 신호. 보유 비중 축소 검토.':
        'Multiple indicators show bearish signals. Consider reducing exposure.',
      '펀더멘탈·기술적 지표 모두 취약. 손절 또는 회피 권장.':
        'Both fundamental and technical indicators are weak. Stop-loss or avoidance recommended.',
    } as Record<string, string>,

    /* Charts */
    priceChartTitle: 'Price Chart + Moving Averages (SMA)',
    close:    'Close',
    open:     'Open',
    high:     'High',
    low:      'Low',
    volumeLabel: 'Volume',
    rsiTitle: 'RSI',
    rsiSub:   '(Wilder, 14)',
    overbought: 'Overbought',
    oversold:   'Oversold',
    neutralZone: 'Neutral',
    zone:       'Zone',
    macdTitle:  'MACD',
    macdSub:    '(12, 26, 9)',

    /* Footer */
    footerData: 'Real-time market data (Alpha Vantage / Finnhub)',
    footerNote: 'Not for actual investment decisions.',
    footerQA:   'QA Test Harness',
  },
} as const;

// ─────────────────────────────────────────────
// About page (app/about/page.tsx)
// ─────────────────────────────────────────────
const about = {
  ko: {
    /* Navigation */
    backBtn:     '메인으로',
    pageSlug:    '서비스 안내',

    /* Hero */
    heroBadge:    '분석 기준 투명 공개',
    heroTitle:    '어떻게 분석하나요?',
    heroSubtitle: 'Stock-er가 주가를 평가하는 기준과 알고리즘을 투명하게 공개합니다.',
    heroNote:     '모든 분석은 참고용이며, 투자 판단의 최종 책임은 사용자 본인에게 있습니다.',
    toc: ['01 · 기업 펀더멘탈 분석', '02 · 기술적 차트 분석', '03 · 투자 면책조항'],

    /* Section 01 */
    s1Num: '01', s1Title: '기업 펀더멘탈 분석 기준',
    s1Sub: '주가가 기업의 실제 가치 대비 비싼지, 싼지를 판단하는 기준',

    /* PER card */
    perEmoji: '📊', perName: 'PER', perFull: '주가수익비율',
    perSummary: '현재 주가가 기업의 연간 이익의 몇 배에 거래되고 있는지를 나타냅니다.',
    perDetail: '낮을수록 이익 대비 주가가 저렴하다는 의미이며, 업종 평균 PER과 비교해 상대적 평가를 내립니다.',
    perExample: 'PER 20 = 지금 이익 수준을 유지한다면 20년치 이익을 주가에 선반영한 상태',
    perGood: '업종 평균보다 낮음 → 상대적 저평가 가능성 → AI 점수 상승',
    perBad:  '업종 평균보다 높음 → 고평가 우려 → AI 점수 하락',

    /* PBR card */
    pbrEmoji: '🏦', pbrName: 'PBR', pbrFull: '주가순자산비율',
    pbrSummary: '현재 주가가 기업의 장부상 자산 가치의 몇 배에 거래되고 있는지를 나타냅니다.',
    pbrDetail: '1배 미만은 주가가 청산가치 이하로 거래됨을 의미합니다. 업종 평균과 비교해 평가합니다.',
    pbrExample: 'PBR 3 = 주가가 장부상 자산의 3배 수준. 성장 기대감이 반영된 프리미엄',
    pbrGood: '업종 평균보다 낮음 → 자산 대비 저평가 → AI 점수 상승',
    pbrBad:  '업종 평균보다 높음 → 자산 대비 고평가 → AI 점수 하락',

    /* ROE card */
    roeEmoji: '💰', roeName: 'ROE', roeFull: '자기자본이익률',
    roeSummary: '주주가 맡긴 자본으로 기업이 얼마나 효율적으로 이익을 창출하는지를 나타냅니다.',
    roeDetail: '높을수록 자본 활용 효율이 우수한 기업. 업종 평균 ROE와 비교해 경쟁력을 평가합니다.',
    roeExample: 'ROE 20% = 주주 자본 100원으로 매년 20원의 순이익을 창출 (우량 기준)',
    roeGood: '업종 평균보다 높음 → 자본 효율 우수 → AI 점수 상승',
    roeBad:  '업종 평균보다 낮음 → 자본 활용 미흡 → AI 점수 하락',

    /* DCF card */
    dcfBadge:    'AI 점수 30점',
    dcfCardTitle: 'DCF 내재가치 분석 모델',
    dcfCardSub:   'Discounted Cash Flow · 핵심 밸류에이션 지표',
    dcfIntro: '기업이 미래에 벌어들일 현금을 현재 가치로 환산해 적정 주가를 계산하는 방법입니다. 주가의 등락과 무관하게 기업 본질 가치에 집중한다는 점에서 가장 기초적이고 신뢰받는 밸류에이션 방법으로 여겨집니다.',
    dcfSteps: [
      { step: '①', label: 'FCF 입력',    desc: '기업의 연간 잉여 현금흐름 (영업현금 − 설비투자)' },
      { step: '②', label: '성장률 적용', desc: '향후 10년간 FCF가 매년 몇 % 성장할지 가정' },
      { step: '③', label: '할인율 반영', desc: 'WACC(가중평균자본비용)으로 현재가치 환산' },
    ] as const,
    dcfFormula: '+ 영구성장가치(Terminal Value) → 기업 전체 가치(EV) ÷ 발행주식수 ÷ 부채 조정 = 적정 주가',
    dcfNote: 'DCF 적정 주가가 현재 주가보다 높으면 저평가(AI 점수 ↑), 낮으면 고평가(AI 점수 ↓)로 판단합니다. 대시보드의 슬라이더로 가정치를 직접 조정해 볼 수 있습니다.',
    dcfParams: [
      { label: 'FCF 성장률',  range: '1% ~ 40%',  desc: '향후 10년간 잉여현금흐름이 매년 얼마나 성장할지에 대한 가정입니다. 높게 설정할수록 미래가치가 커져 적정 주가가 올라갑니다.' },
      { label: '할인율 (WACC)', range: '5% ~ 15%', desc: '미래 현금을 현재 가치로 환산할 때 사용하는 비율입니다. 높을수록 미래가치를 보수적으로 평가하여 적정 주가가 낮아집니다.' },
      { label: '영구 성장률', range: '0.5% ~ 5%', desc: '10년 이후에도 기업이 영원히 성장한다고 가정하는 비율입니다. 일반적으로 GDP 성장률(2~3%)을 초과하지 않게 설정합니다.' },
    ] as const,

    /* Section 02 */
    s2Num: '02', s2Title: '기술적 차트 분석 기준',
    s2Sub: '주가 흐름의 패턴과 모멘텀으로 매수·매도 시그널을 포착',
    s2SmaTitle: '이동평균선 (SMA)', s2SmaSub: '20일선 · 60일선 교차 분석',
    s2SmaBadge: 'AI 점수 25점',
    s2SmaIntro: '과거 N일간의 평균 주가를 선으로 이은 것입니다. 단기선(20일)과 장기선(60일)의 교차 방향으로 추세 전환을 감지합니다.',
    s2SmaLegendShort: '단기(20일)선이 장기(60일)선 아래',
    s2SmaLegendLong:  '20일선이 60일선 위로 →',
    s2GoldenTitle: '골든크로스 (매수 시그널)', s2GoldenBadge: '점수 ↑',
    s2GoldenDesc:  '단기(20일)선이 장기(60일)선을 아래에서 위로 돌파할 때 발생합니다. 하락세가 끝나고 상승 추세로 전환되는 신호로 해석하여 AI 점수를 높입니다.',
    s2DeadTitle: '데드크로스 (매도 시그널)', s2DeadBadge: '점수 ↓',
    s2DeadDesc:  '단기(20일)선이 장기(60일)선을 위에서 아래로 돌파할 때 발생합니다. 상승세가 꺾이고 하락 추세로 전환되는 신호로 해석하여 AI 점수를 낮춥니다.',
    s2RsiTitle: 'RSI (상대강도지수)', s2RsiSub: 'Wilder RSI · 14일 기준',
    s2RsiBadge: 'AI 점수 25점',
    s2RsiIntro: '최근 14거래일의 상승폭과 하락폭 비율로 주가의 과열·침체 여부를 0~100 사이 숫자로 표현합니다. 급등 뒤의 조정, 급락 뒤의 반등 가능성을 포착하는 데 활용합니다.',
    s2RsiZone1: '과매도 ≤ 30', s2RsiZone2: '중립 30~70', s2RsiZone3: '과매수 ≥ 70',
    s2OversoldTitle: 'RSI ≤ 30 — 과매도 구간',
    s2OversoldDesc: '단기 급락으로 주가가 지나치게 내렸을 가능성을 시사합니다. 반등 기대감으로 AI 점수 상승 요인이 됩니다.',
    s2OverboughtTitle: 'RSI ≥ 70 — 과매수 구간',
    s2OverboughtDesc: '단기 급등으로 주가가 과열됐을 가능성을 시사합니다. 조정 우려로 AI 점수 하락 요인이 됩니다.',
    s2AiTitle: 'AI 종합 점수 100점 구성',
    s2AiSub:   '위 분석 기준이 어떻게 합산되나요?',
    s2AiItems: [
      { label: 'DCF 내재가치', pts: 30, desc: '현재가 vs 적정가 괴리율' },
      { label: 'RSI 모멘텀',   pts: 25, desc: '과매수·과매도 구간 판단' },
      { label: 'MA 추세',      pts: 25, desc: '골든·데드크로스 감지' },
      { label: '상대 밸류에이션', pts: 20, desc: 'PER·PBR 업종 평균 비교' },
    ] as const,
    s2AiGradeNote: '65점 이상 투자 매력 · 45~64점 중립 관망 · 44점 이하 리스크 주의로 분류됩니다.',

    /* Section 03 */
    s3Num: '03', s3Title: '투자 유의사항 및 면책조항',
    s3Sub: '서비스 이용 전 반드시 확인하시기 바랍니다',
    s3WarnTitle: '⚠️ 중요 고지 사항',
    s3WarnSub:   '투자 결정 전 반드시 읽어주세요',
    s3Disclaimer: '본 서비스에서 제공하는 모든 분석 데이터 및 AI 예측 점수는 야후 파이낸스의 공개 데이터를 기반으로 한 단순 참고용 계산 결과이며, 금융 투자 전문가의 조언을 대체할 수 없습니다. 모든 투자 판단의 최종 책임은 사용자 본인에게 있으며, 본 서비스는 어떠한 경우에도 투자 결과로 인한 손실에 대해 법적 책임을 지지 않습니다.',
    s3DisclaimerHighlights: ['단순 참고용 계산 결과', '사용자 본인', '법적 책임을 지지 않습니다'],
    s3Details: [
      { icon: '📡', title: '데이터 출처 및 정확성',  desc: 'Alpha Vantage 및 Yahoo Finance의 공개 API 데이터를 사용합니다. API 지연·장애·오류로 인해 실제 시세와 다를 수 있습니다.' },
      { icon: '🤖', title: 'AI 점수의 한계',        desc: 'AI 점수는 4개의 정량 지표만을 반영한 단순 알고리즘입니다. 거시경제·정치적 이벤트·기업 내부 정보 등은 반영되지 않습니다.' },
      { icon: '⏱️', title: '데이터 지연 가능성',    desc: '일봉(D) 기준 데이터를 사용하므로 장중 급변동·긴급 공시·실적 발표 등이 즉시 반영되지 않을 수 있습니다.' },
      { icon: '🌐', title: '분석 대상 범위',         desc: '미국·한국 주식 시장 상장 종목 위주로 설계되었습니다. 일부 시장 종목은 데이터가 불완전하거나 제공되지 않을 수 있습니다.' },
    ] as const,
    s3AddNote: '본 서비스는 개인 학습 및 편의 목적의 비영리 프로젝트입니다. 실제 투자 결정은 공인 금융투자업자의 조언과 본인의 충분한 조사를 바탕으로 하시기 바랍니다.',
    backBtnBottom: '메인 대시보드로 돌아가기',
    footerNote: '서비스 분석 기준 및 투자 면책조항 — 실제 투자 결정에 활용하지 마세요.',
  },

  en: {
    /* Navigation */
    backBtn:  'Back to Main',
    pageSlug: 'About',

    /* Hero */
    heroBadge:    'Transparent Methodology',
    heroTitle:    'How does it analyze?',
    heroSubtitle: 'Stock-er openly discloses the criteria and algorithms used to evaluate stocks.',
    heroNote:     'All analysis is for reference only. Users bear full responsibility for their own investment decisions.',
    toc: ['01 · Fundamental Analysis', '02 · Technical Analysis', '03 · Disclaimer'],

    /* Section 01 */
    s1Num: '01', s1Title: 'Fundamental Analysis Criteria',
    s1Sub: 'Determining whether a stock is expensive or cheap relative to its intrinsic business value',

    /* PER card */
    perEmoji: '📊', perName: 'P/E', perFull: 'Price-to-Earnings Ratio',
    perSummary: 'Shows how many times annual earnings the current stock price represents.',
    perDetail: 'Lower generally means relatively undervalued vs earnings. Compared against industry average P/E for relative assessment.',
    perExample: 'P/E 20 = at the current earnings level, 20 years of profit are priced into the stock today',
    perGood: 'Below industry avg → potential relative undervaluation → AI score rises',
    perBad:  'Above industry avg → overvaluation risk → AI score declines',

    /* PBR card */
    pbrEmoji: '🏦', pbrName: 'P/B', pbrFull: 'Price-to-Book Ratio',
    pbrSummary: 'Shows how many times its book (net asset) value the current stock price represents.',
    pbrDetail: 'Below 1× means the stock trades below liquidation value. Evaluated against the industry average P/B.',
    pbrExample: 'P/B 3 = stock trades at 3× book value — a premium reflecting growth expectations',
    pbrGood: 'Below industry avg → asset undervaluation → AI score rises',
    pbrBad:  'Above industry avg → asset overvaluation → AI score declines',

    /* ROE card */
    roeEmoji: '💰', roeName: 'ROE', roeFull: 'Return on Equity',
    roeSummary: 'Measures how efficiently a company generates profit using shareholders\' capital.',
    roeDetail: 'Higher means superior capital efficiency. Compared against industry average ROE to assess competitive strength.',
    roeExample: 'ROE 20% = the company generates ¥20 net profit per ¥100 of shareholder equity annually',
    roeGood: 'Above industry avg → strong capital efficiency → AI score rises',
    roeBad:  'Below industry avg → poor capital utilization → AI score declines',

    /* DCF card */
    dcfBadge:    '30 pts in AI Score',
    dcfCardTitle: 'DCF Intrinsic Value Model',
    dcfCardSub:   'Discounted Cash Flow · Core Valuation Methodology',
    dcfIntro: 'DCF calculates the fair value per share by discounting a company\'s projected future cash flows back to present value. Unlike market price, it focuses purely on the fundamental value of the business — making it the most foundational and widely respected valuation approach.',
    dcfSteps: [
      { step: '①', label: 'Input FCF',      desc: 'Annual free cash flow (Operating cash flow − Capex)' },
      { step: '②', label: 'Apply Growth',   desc: 'Assume how much FCF grows each year over 10 years' },
      { step: '③', label: 'Apply Discount', desc: 'Discount to present value using WACC' },
    ] as const,
    dcfFormula: '+ Terminal Value (perpetuity) → Enterprise Value ÷ Shares outstanding ÷ Debt adjustment = Fair Value per Share',
    dcfNote: 'If the DCF fair value exceeds the current price → Undervalued (AI score ↑). If lower → Overvalued (AI score ↓). Use the sliders on the dashboard to adjust the assumptions.',
    dcfParams: [
      { label: 'FCF Growth Rate', range: '1% – 40%', desc: 'How much you expect free cash flow to grow annually over 10 years. Higher values increase the fair value estimate.' },
      { label: 'Discount Rate (WACC)', range: '5% – 15%', desc: 'The rate used to discount future cash flows to present value. Higher values give a more conservative (lower) fair value estimate.' },
      { label: 'Terminal Growth Rate', range: '0.5% – 5%', desc: 'The perpetual growth rate assumed after year 10. Typically capped at or below the long-run GDP growth rate (2–3%).' },
    ] as const,

    /* Section 02 */
    s2Num: '02', s2Title: 'Technical Chart Analysis Criteria',
    s2Sub: 'Identifying buy/sell signals through price patterns and momentum',
    s2SmaTitle: 'Moving Averages (SMA)', s2SmaSub: '20-day & 60-day crossover analysis',
    s2SmaBadge: '25 pts in AI Score',
    s2SmaIntro: 'A moving average plots the average price over the past N days as a line. Crossovers between the short-term (20-day) and long-term (60-day) lines signal potential trend reversals.',
    s2SmaLegendShort: '← 20-day below 60-day',
    s2SmaLegendLong:  '20-day above 60-day →',
    s2GoldenTitle: 'Golden Cross (Buy Signal)', s2GoldenBadge: 'Score ↑',
    s2GoldenDesc:  'Occurs when the short-term (20-day) line crosses above the long-term (60-day) line. Interpreted as a trend reversal from downtrend to uptrend, raising the AI score.',
    s2DeadTitle: 'Death Cross (Sell Signal)', s2DeadBadge: 'Score ↓',
    s2DeadDesc:  'Occurs when the short-term (20-day) line crosses below the long-term (60-day) line. Interpreted as a trend reversal from uptrend to downtrend, lowering the AI score.',
    s2RsiTitle: 'RSI (Relative Strength Index)', s2RsiSub: 'Wilder RSI · 14-day period',
    s2RsiBadge: '25 pts in AI Score',
    s2RsiIntro: 'RSI expresses the ratio of gains to losses over the past 14 trading days as a number between 0 and 100, indicating whether the stock is overbought or oversold.',
    s2RsiZone1: 'Oversold ≤ 30', s2RsiZone2: 'Neutral 30–70', s2RsiZone3: 'Overbought ≥ 70',
    s2OversoldTitle: 'RSI ≤ 30 — Oversold Zone',
    s2OversoldDesc: 'Suggests the price may have fallen too sharply in the short term. The potential for a rebound raises the AI score.',
    s2OverboughtTitle: 'RSI ≥ 70 — Overbought Zone',
    s2OverboughtDesc: 'Suggests the price may be overheating after a sharp run-up. Correction risk lowers the AI score.',
    s2AiTitle: 'AI Score: 100-Point Breakdown',
    s2AiSub:   'How do the above criteria combine into a single score?',
    s2AiItems: [
      { label: 'DCF Intrinsic Value', pts: 30, desc: 'Gap between current price and fair value' },
      { label: 'RSI Momentum',        pts: 25, desc: 'Overbought / Oversold zone assessment' },
      { label: 'MA Trend',            pts: 25, desc: 'Golden / Death Cross detection' },
      { label: 'Relative Valuation',  pts: 20, desc: 'P/E & P/B vs. industry averages' },
    ] as const,
    s2AiGradeNote: '65+ = Attractive · 45–64 = Neutral · 44 or below = High Risk.',

    /* Section 03 */
    s3Num: '03', s3Title: 'Investment Notices & Disclaimer',
    s3Sub: 'Please read carefully before using this service',
    s3WarnTitle: '⚠️ Important Notice',
    s3WarnSub:   'Please read before making any investment decision',
    s3Disclaimer: 'All analysis data and AI predictive scores provided by this service are simple reference-based calculations derived from publicly available data through Yahoo Finance and do not constitute professional financial investment advice. The user bears full and sole responsibility for all investment decisions. This service shall not be held legally liable for any investment losses under any circumstances.',
    s3DisclaimerHighlights: ['simple reference-based calculations', 'user bears full and sole responsibility', 'shall not be held legally liable'],
    s3Details: [
      { icon: '📡', title: 'Data Source & Accuracy',  desc: 'Market data is sourced from Alpha Vantage and Yahoo Finance public APIs. Actual prices may differ due to API latency, outages, or errors.' },
      { icon: '🤖', title: 'Limitations of the AI Score', desc: 'The AI score is a simple algorithm based on only 4 quantitative indicators. Macro-economic factors, geopolitical events, and inside information are not reflected.' },
      { icon: '⏱️', title: 'Data Delay',               desc: 'Daily (D) candle data is used. Intraday price swings, breaking news, and earnings announcements may not be immediately reflected.' },
      { icon: '🌐', title: 'Coverage Scope',             desc: 'Primarily designed for US and Korean exchange-listed equities. Data may be incomplete or unavailable for securities on other exchanges.' },
    ] as const,
    s3AddNote: 'This service is a non-commercial project built for personal learning and convenience. Actual investment decisions should be based on advice from licensed financial professionals and your own thorough research.',
    backBtnBottom: 'Back to Main Dashboard',
    footerNote: 'Analysis Methodology & Disclaimer — Not for actual investment decisions.',
  },
} as const;

// ─────────────────────────────────────────────
// 공개 export
// ─────────────────────────────────────────────
export type Lang = 'ko' | 'en';

export const translations = {
  ko: { dashboard: dashboard.ko, about: about.ko },
  en: { dashboard: dashboard.en, about: about.en },
} as const;

// 두 언어 타입의 합집합 — KO/EN 모두 할당 가능
export type DashboardT = typeof translations['ko']['dashboard'] | typeof translations['en']['dashboard'];
export type AboutT     = typeof translations['ko']['about']     | typeof translations['en']['about'];
