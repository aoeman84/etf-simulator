# Sim K v1.35 통합 수정 스펙

## 1. 계산 로직 버그 수정 (lib/simulatorK.ts)

### 1-1. ISA 수익률 중복 적용 버그

현재 코드 흐름:
```
if (!isMatureYear) {
  isaBalance += isaContrib   // 납입
  isaCostBasis += isaContrib
}
isaBalance *= (1 + rISA)    // 수익 적용

if (isMatureYear) {
  // 만기 처리
  pensionBalance += isaAfterTax
  isaBalance = 0
  // 새 ISA 납입
  isaBalance += isaContrib   // ← 납입 후
  isaCostBasis += isaContrib
}
```

문제: 만기 해지 연도에 isaBalance = 0 한 뒤 새 납입을 추가하는데,
그 납입금에 대해 이미 위에서 `isaBalance *= (1 + rISA)`가 적용됐음.
즉 납입 전에 수익률이 먼저 적용되고 있음 → 순서 수정 필요.

올바른 순서:
```
1. 납입 (isMatureYear면 스킵)
2. 수익률 적용
3. 만기 처리 (해지 + 연금저축 이체 + 새 ISA 납입)
   → 새 ISA 납입은 수익률 적용 후 추가 (당해연도 수익 없이)
```

### 1-2. 연금저축 잔액 검증

24년차에 연금저축이 63억이 되는지 수동 검증:
- 연 1,500만원 납입 × 24년 = 3억 6,000만원 납입
- ISA 이체: 3년마다 약 6,000만원 × 8회 = 4억 8,000만원 추가
- 합계 약 8억 4,000만원이 원금
- SCHD+QQQ 혼합 수익률 약 11~13%로 24년 복리 → 약 20~30억 수준이어야 정상
- 63억은 과함 → 수익률 중복 적용 의심

`pensionBalance += pensionContrib` 이후
`pensionBalance += isaAfterTax` (ISA 이체) 이후
`pensionBalance *= (1 + rPension)` 이 한 번만 적용되는지 확인.
현재 코드에서 이미 한 번만 적용되고 있으나,
ISA 이체금액이 이체 연도에 즉시 수익률이 적용되는 것이 맞는지 검토.
ISA 이체는 연말 처리로 가정하면 당해연도 수익 미적용이 맞음.

수정:
```typescript
// 만기 연도
pensionBalance += pensionContrib  // 납입
pensionBalance *= (1 + rPension)  // 수익 (납입금 포함)
// 만기 처리 후 이체 (당해연도 수익 없이 잔액에 추가)
pensionBalance += isaAfterTax     // 이체금 추가 (이미 수익 적용된 후)
```

### 1-3. ISA 3년차 동년 재납입 검증

현재: isMatureYear일 때 만기 처리 블록 끝에 `isaBalance += isaContrib` 추가됨.
그런데 수익률 적용(`isaBalance *= (1 + rISA)`)이 이미 위에서 실행됐으므로,
새 납입금은 당해연도 수익 없이 추가됨 → 이건 정상.

단, `totalContributed += isaContrib`가 만기 연도에도 정상 집계되는지 확인.

---

## 2. UI 슬라이더 방식 변경 (app/simk/page.tsx)

### 2-1. 월 납입 상한 복구 (이전 방식으로)

기존 max 제한 복구:
- ISA: max 166만원/월 (연 2,000만원 ÷ 12)
- 연금저축: max 125만원/월 (연 1,500만원 ÷ 12)  
- IRP: max 25만원/월 (연 300만원 ÷ 12)

연초 일시납:
- ISA: max 2,000만원/년
- 연금저축: max 1,500만원/년
- IRP: max 300만원/년

단, 각 슬라이더/입력 아래에 설명 추가:
- ISA: "연 2,000만원 한도 · 166만원/월이 최대 효율"
- 연금저축: "세액공제 한도 600만원 · 초과 납입은 세혜택 없음"
- IRP: "연금저축+합산 900만원까지 세액공제"

---

## 3. ETF 슬라이더 색상 수정 (app/simk/page.tsx)

### 문제
- 맥북에서 VOO(초록), QQQ(보라) 슬라이더가 검은색으로 표시됨
- 아이폰에서는 정상 표시
- 원인: style={{ accentColor: hex }} 인라인 스타일이 macOS Chrome에서 무시됨

### 수정 방법
Tailwind accent 클래스를 동적으로 적용하되,
Tailwind는 동적 클래스를 purge하므로 조건부 클래스 대신 고정 매핑 사용:

```typescript
// 색상 매핑 객체 (Tailwind purge 방지용 고정 클래스)
const TICKER_SLIDER_CLASS: Record<string, string> = {
  SCHD: 'accent-blue-600',
  VOO:  'accent-green-600',
  QQQ:  'accent-purple-600',
}

// 사용
<input
  type="range"
  className={`w-full ${TICKER_SLIDER_CLASS[ticker] ?? 'accent-blue-600'}`}
  // style={{ accentColor }} 완전 제거
/>
```

모든 계좌(ISA, 연금저축, IRP)의 ETF 배분 슬라이더에 동일 적용.
기존 style={{ accentColor: etf.color }} 완전 제거.

---

## 4. 현재 나이 / 투자 시작 나이 분리 (app/simk/page.tsx + lib/simulatorK.ts)

### 문제
현재는 "현재 나이"를 투자 시작 나이로 그대로 사용.
이미 연금 계좌에 납입 중인 사람은 현재 나이가 투자 시작 나이가 아님.

### 수정: 입력 항목 분리

```
투자 시작 나이: [슬라이더] 20~60세  (언제부터 납입 시작했는지)
현재 나이:     [슬라이더] 투자시작나이~60세  (지금 몇 살인지)
연금 수령 나이: [슬라이더] 55~80세
```

### 로직 변경

총 납입 기간 = 연금 수령 나이 - 투자 시작 나이
이미 납입한 기간 = 현재 나이 - 투자 시작 나이

시뮬레이션은 투자 시작 나이부터 전체 기간을 계산하되,
결과 표에서 "현재" 시점을 강조 표시 (현재 나이 행을 굵게/색상으로 구분).

예: 투자시작 35세, 현재 41세, 수령 65세
→ 총 30년 시뮬레이션, 1~6년차(35~40세)는 "과거" 구간으로 회색 표시
→ 7년차(41세)부터 "현재~미래" 구간으로 정상 표시

SimKParams에 추가:
```typescript
startAge: number    // 투자 시작 나이 (기존 currentAge 대체)
currentAge: number  // 현재 나이 (표에서 강조 표시용)
retirementAge: number
```

---

## 5. 버전 업데이트

- components/Footer.tsx: v1.35
- app/login/page.tsx: v1.35
- 커밋 메시지: "fix: v1.35 - 계산 로직 수정, 슬라이더 색상, 투자시작나이 분리"
- git push까지 완료
