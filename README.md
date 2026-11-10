# quant — 개인용 시장 브리핑

비밀번호로 잠긴 개인용 시장 대시보드입니다. GitHub Actions가 한국 시간 06~24시 매시 공개 무료 자료를 모아
암호화한 뒤 GitHub Pages로 배포합니다. 다른 서비스의 화면·자료를 복제하지 않고, 아래 출처에서 직접 수집·계산합니다.

| 화면 | 내용 | 출처 |
|---|---|---|
| 홈 | 밤사이 큰 사건, 이번 주 일정, 지난 장 마감, AI 아침 브리핑, 평소와 다른 움직임, 시장 숫자, 공포탐욕, 테마·종목 | 아래 전부 |
| 뉴스 | 사건별로 묶은 기사(제목·링크만), 화제 키워드 | 네이버 증권 뉴스, 연합뉴스·연합인포맥스·매일경제·CNBC RSS, 구글 뉴스 |
| 시장 | 미국 CNN 공포탐욕 / 한국 공포탐욕(자체 계산), 한국 업종·테마, 미국 섹터·업종, 급등·급락 | CNN, 네이버 증권, Yahoo Finance |
| 매매 동향 | 코스피·코스닥 투자자별 순매수, 오른 종목 비율, CFTC 선물 포지션, 미국 내부자 매수 | 네이버 증권, CFTC, OpenInsider(SEC Form 4) |
| 경제 지표 | 미국 금리·환율·원자재·변동성, 주요 경제 발표(발표·예상·이전) | Yahoo Finance, Nasdaq |
| AI 브리핑 | 평일 06:47 Claude가 위 자료로 쓰는 아침 브리핑 | Claude Code(구독 토큰) |
| 일정 | 경제 지표, 대형주 실적, 한·미 옵션 만기 | Nasdaq, 자체 계산 |

## 추가 자료 (2차)
- 기준금리·SOFR: 뉴욕 연준 공개 API(키 없음) / 국채·회사채 가산금리·FOMC 거시 지표: FRED 공식 API(무료 키, Secret `FRED_API_KEY`)
- 옵션 기대 변동폭: CBOE 지연 시세(등가격 콜+풋 ÷ 주가)
- 커뮤니티 관심: ApeWisdom(Reddit 언급 집계), 네이버 증권 검색 상위
- 외국인·기관이 산 업종·종목: `stock-monitoring` 저장소 `data` 브랜치의 종목별 수급 자료를 같은 비밀번호로 풀어 재사용
- AI가 찾은 호재·악재: AI 리포트에 포함

## 종목 검색·상세, AI 종목 분석 (3차)
- 종목 자료는 `stock-monitoring` 저장소 `data` 브랜치(코스피 200 + 코스닥 150종목의 일봉·외국인/기관 수급)를 그대로 받아 씁니다.
- 빌드 때 종목별 파일(`s/<코드>.enc.json`)로 나눠 암호화하고, 화면에서 종목을 열 때만 읽습니다.
- AI 종목 분석: Actions → **AI 종목 분석** → Run workflow(종목 코드 입력). 결과는 `reports` 브랜치 `s/`에 암호화 저장. `stock-monitoring`에서 만든 리포트도 함께 보여 줍니다.

## 구성
- `scripts/collect.mjs` 수집 → `store.enc.json`(암호화, `data` 브랜치에 누적)
- `scripts/analyze.mjs` 계산 규칙(요약·평소 대비 z, 한국 공포탐욕, 뉴스 묶기, 일정)
- `scripts/build.mjs` 화면 자료를 페이지에 넣고 통째로 AES-256-GCM 암호화 → `dist/`
- `scripts/brief-data.mjs` + `prompts/brief.md` AI 브리핑(`.github/workflows/brief.yml`, 결과는 `reports` 브랜치에 암호화 저장)
- `site/` 화면(HTML·CSS·JS, 외부 라이브러리 없음)

## 필요한 설정
- Secrets: `SITE_PASSWORD`(사이트 비밀번호), `CLAUDE_CODE_OAUTH_TOKEN`(AI 브리핑)
- 선택 Variable: `CLAUDE_MODEL`(예: `opus`)
- Settings → Pages → Source: GitHub Actions

## 한국 공포탐욕 계산
주가 모멘텀(코스피/125일선), 20일 변동성(뒤집음), 외국인 20일 순매수, 원화 강세(원/달러 20일 변화 뒤집음),
코스닥 위험선호(코스닥/코스피 20일 상대수익), 오른 종목 비율(10일 평균)을 각각 최근 250거래일 안에서 백분위로 바꿔 평균합니다.

정보 제공 목적의 개인 자료이며 투자 권유가 아닙니다.
