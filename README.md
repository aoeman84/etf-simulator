# 📈 ETF 시뮬레이터

SCHD, VOO, QQQ 등 미국 ETF 적립식 투자 시뮬레이터 웹앱.  
Next.js 14 + Prisma + NextAuth + Recharts 기반 풀스택 앱.

## 주요 기능
- 📊 **시뮬레이터** — 월 투자금, 기간, 환율, DRIP 설정으로 복리 계산
- 🔴 **실시간 주가 연동** — Yahoo Finance API (RapidAPI)
- 📉 **ETF 비교** — SCHD / VOO / QQQ / VYM / JEPI 동시 비교
- 💾 **포트폴리오 저장** — 로그인 후 설정 저장 & 불러오기
- 🔐 **회원가입 / 로그인** — NextAuth + bcrypt

---

## 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
```bash
cp .env.example .env.local
```
`.env.local` 파일을 열어 아래 값을 채우세요:

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 (Supabase/Neon 무료 사용 가능) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` 로 생성 |
| `RAPIDAPI_KEY` | [RapidAPI](https://rapidapi.com/sparior/api/yahoo-finance15) 에서 발급 (무료 플랜 가능) |

### 3. 데이터베이스 마이그레이션
```bash
npx prisma db push
npx prisma generate
```

### 4. 개발 서버 실행
```bash
npm run dev
```
→ http://localhost:3000

---

## 배포 (Vercel 권장)

```bash
# Vercel CLI
npm i -g vercel
vercel

# 환경변수는 Vercel 대시보드 > Settings > Environment Variables 에 추가
```

**추천 무료 인프라 조합:**
- DB: [Neon](https://neon.tech) (PostgreSQL 무료)
- 호스팅: [Vercel](https://vercel.com) (무료)
- 실시간 가격: [RapidAPI Yahoo Finance](https://rapidapi.com) (월 500회 무료)

---

## 프로젝트 구조

```
etf-simulator/
├── app/
│   ├── api/
│   │   ├── auth/          # NextAuth + 회원가입
│   │   ├── etf-price/     # 실시간 주가 API
│   │   └── portfolio/     # 포트폴리오 CRUD
│   ├── dashboard/         # 메인 시뮬레이터
│   ├── compare/           # ETF 비교
│   ├── portfolio/         # 저장된 포트폴리오
│   ├── login/
│   └── register/
├── components/
│   ├── Navbar.tsx
│   └── charts/
│       ├── SimChart.tsx   # 스택 바차트
│       └── CompareChart.tsx # 라인 비교차트
├── lib/
│   ├── simulator.ts       # 시뮬레이션 엔진
│   └── prisma.ts
├── prisma/
│   └── schema.prisma      # User + Portfolio 모델
└── types/index.ts
```

---

## ETF 추가 방법

`lib/simulator.ts` 의 `ETF_DATA` 객체에 항목 추가:

```ts
DGRW: {
  ticker: 'DGRW',
  name: 'WisdomTree US Quality Dividend Growth',
  price: 72.0,
  divYield: 1.8,
  divGrowthCAGR: 10.0,
  priceCAGR: 12.5,
  color: '#db2777',
},
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS |
| 차트 | Recharts |
| 인증 | NextAuth.js v4 |
| DB ORM | Prisma |
| DB | PostgreSQL |
| 실시간 가격 | Yahoo Finance (RapidAPI) |
