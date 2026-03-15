# Sim K v1.30 수정 스펙 — 계좌별 ETF 배분

## 문제
현재 Sim K는 ETF를 전체 단위로 선택/해제만 가능.
실제로는 ISA / 연금저축 / IRP 각 계좌마다 다른 ETF 비율로 운용 가능.
예: ISA에는 SCHD 50% + QQQ 50%, 연금저축은 VOO 100%, IRP는 SCHD 100%

## 수정 내용

### 1. UI 변경 (app/simk/page.tsx)

기존 "ETF 선택" 버튼 방식 → 계좌별 ETF 비율 설정 UI로 교체

각 계좌(ISA / 연금저축 / IRP)마다 아래 구조:
```
┌─────────────────────────────────────┐
│ ISA                                 │
│ SCHD [____50____] %                 │
│ VOO  [____30____] %                 │
│ QQQ  [____20____] %                 │
│              합계: 100% ✅          │
└─────────────────────────────────────┘
```

- ETF별 % 입력 (숫자 직접 입력 or 슬라이더)
- 합계가 100%가 되어야 함 (실시간 체크, 100% 아니면 경고)
- 0%로 설정하면 해당 ETF 미포함
- 기본값: SCHD 100% / VOO 0% / QQQ 0% (세 계좌 모두 동일)

### 2. 타입 변경 (lib/simulatorK.ts)

기존:
```typescript
selectedTickers: string[]  // ['SCHD', 'VOO']
```

변경:
```typescript
// 계좌별 ETF 배분
accountAllocations: {
  isa: { ticker: string; pct: number }[]       // pct 합계 = 100
  pension: { ticker: string; pct: number }[]
  irp: { ticker: string; pct: number }[]
}
```

### 3. 시뮬레이션 로직 변경 (lib/simulatorK.ts)

각 계좌의 수익률 계산 시:
- 해당 계좌의 ETF 배분 비율로 가중평균 계산
- 배당수익률 = Σ(ETF 배당수익률 × 비율)
- 주가CAGR = Σ(ETF 주가CAGR × 비율)

예시:
```
ISA: SCHD 50% + QQQ 50%
→ 배당수익률 = 3.4% × 0.5 + 0.6% × 0.5 = 2.0%
→ 주가CAGR = 8.5% × 0.5 + 17.2% × 0.5 = 12.85%
```

### 4. ETF별 절세 효과 비교 표

기존: ETF 하나씩 행으로 표시
변경: 계좌별 포트폴리오 구성을 반영한 결과 하나만 표시
(계좌마다 다른 ETF를 담으므로 "ETF별 비교"가 아니라 "내 포트폴리오 결과"로 변경)

단, 우측에 참고용으로 단일 ETF 100% 시나리오 비교는 유지:
| 구성 | ISA 비과세 혜택 | 총 절세 효과 |
|------|--------------|-----------|
| 내 포트폴리오 | X만원 | X억원 |
| SCHD 100% | X만원 | X억원 |
| VOO 100%  | X만원 | X억원 |
| QQQ 100%  | X만원 | X억원 |

## 주의사항
- 기존 ETF_DATA (lib/simulator.ts) 그대로 사용
- SIMK_TICKERS = ['SCHD', 'VOO', 'QQQ'] 유지
- 합계 100% 검증: 합계 != 100이면 시뮬레이션 버튼 비활성화 or 경고
- 버전: v1.30
- 커밋 메시지: "feat: v1.30 - Sim K 계좌별 ETF 배분 기능 추가"
