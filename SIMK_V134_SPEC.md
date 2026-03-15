# Sim K v1.34 수정 스펙

## 수정사항 4가지

---

### 1. ISA 3년차 동년 재납입 버그 수정 (lib/simulatorK.ts)

현재: 3년차(y % 3 === 0)에 ISA 만기 해지 후 isaBalance = 0 초기화만 함
수정: 만기 해지 처리 완료 후 같은 해에 새 ISA 납입액 추가

```typescript
// 만기 해지 처리 후 (기존 로직 유지)
isaBalance = 0
isaCostBasis = 0

// ✅ 추가: 같은 해에 새 ISA 바로 납입
isaBalance += annualISA  // 연초 일시납이면 annualISA, 월적립이면 monthlyISA * 12
isaCostBasis += annualISA
```

단, 루프 상단에서 이미 일반 납입이 처리됐는지 확인하고 중복 방지할 것.
구체적으로: 루프 상단의 일반 ISA 납입 로직을 만기 해지 연도에는 건너뛰고,
만기 처리 블록 내에서 납입하도록 순서 조정.

---

### 2. 월 납입 상한 제거 (app/simk/page.tsx)

현재:
- ISA max 166만원/월
- 연금저축 max 125만원/월  
- IRP max 25만원/월

수정:
- ISA: max 제거, 단 연간 합산(월입력 × 12)이 2,000만원 초과 시 경고 표시
- 연금저축: max 제거, 연간 합산 1,500만원 초과 시 경고 (세액공제는 600만원까지)
- IRP: max 제거, 연간 합산 300만원 초과 시 경고 (세액공제 한도)

경고 표시: 슬라이더/입력 아래 작은 주황색 텍스트로
예: "⚠️ 연간 2,400만원 — 한도(2,000만원) 초과, 초과분 세제혜택 없음"

연초 일시납도 동일하게 적용 (기존 max 제거, 경고로 변경)

---

### 3. 연금저축 + IRP 납입액 고정 (lib/simulatorK.ts + app/simk/page.tsx)

세액공제 최적화 관점에서 연금저축 600만원 + IRP 300만원이 고정 최적.

수정:
- 연금저축 세액공제 계산 시 min(연간납입액, 6_000_000) 그대로 유지
- IRP 세액공제 계산 시 min(irp납입액, max(0, 9_000_000 - pensionCredited)) 그대로 유지
- UI에 안내 문구 추가: "세액공제 최대 혜택: 연금저축 600만 + IRP 300만원"

---

### 4. ETF 슬라이더 색상 수정 (app/simk/page.tsx)

현재: VOO 슬라이더가 검은색으로 표시됨
원인: style={{ accentColor: hex }} 인라인 스타일이 일부 브라우저에서 무시됨

수정: Tailwind accent 클래스를 className에 직접 적용
```
SCHD → className에 accent-blue-600 추가
VOO  → className에 accent-green-600 추가  
QQQ  → className에 accent-purple-600 추가
```

모든 계좌(ISA, 연금저축, IRP)의 ETF 배분 슬라이더에 동일 적용.
style={{ accentColor }} 인라인 스타일 완전 제거.

---

### 5. 버전 및 로그인 페이지 업데이트

- components/Footer.tsx: v1.34
- app/login/page.tsx: v1.34
- 커밋 메시지: "feat: v1.34 - ISA 풍차 재납입, 상한 경고, 슬라이더 색상 수정"
- git push까지 완료
