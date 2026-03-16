# Sim K v1.40 — ETF 슬라이더 연동

## 수정 내용

### app/simk/page.tsx — setAllocPct 함수 수정

현재:
```typescript
function setAllocPct(ticker: string, pct: number) {
  setState(prev => ({
    ...prev,
    etfAlloc: prev.etfAlloc.map(a => a.ticker === ticker ? { ...a, pct: Math.max(0, Math.min(100, pct)) } : a),
  }))
}
```

변경 후 (A방식: 마지막 ETF가 나머지 흡수):
```typescript
function setAllocPct(ticker: string, pct: number) {
  setState(prev => {
    const tickers = ['SCHD', 'VOO', 'QQQ']
    const clamped = Math.max(0, Math.min(100, pct))
    
    // 변경한 ticker 제외 나머지
    const others = tickers.filter(t => t !== ticker)
    
    // 현재 변경 ticker 외 합계
    const currentAlloc = prev.etfAlloc.find(a => a.ticker === ticker)
    const oldPct = currentAlloc?.pct ?? 0
    const diff = clamped - oldPct  // 변화량
    
    // 마지막 ETF(QQQ)가 나머지를 흡수
    // 단, 변경한 ticker가 QQQ면 VOO가 흡수
    const absorber = ticker === 'QQQ' ? 'VOO' : 'QQQ'
    
    return {
      ...prev,
      etfAlloc: prev.etfAlloc.map(a => {
        if (a.ticker === ticker) return { ...a, pct: clamped }
        if (a.ticker === absorber) {
          return { ...a, pct: Math.max(0, a.pct - diff) }
        }
        return a
      }),
    }
  })
}
```

### 주의사항
- 흡수 ETF가 0% 이하로 내려가면 0으로 고정
- 흡수 후 합계가 100%가 안 될 수 있으므로
  최종적으로 absorber가 `100 - 나머지 합계`로 자동 보정
- 세 계좌(ISA, 연금저축, IRP) 모두 동일하게 적용

### 올바른 최종 로직
```typescript
function setAllocPct(ticker: string, pct: number) {
  setState(prev => {
    const TICKERS = ['SCHD', 'VOO', 'QQQ']
    const clamped = Math.max(0, Math.min(100, pct))
    
    // 흡수자: QQQ 우선, 변경 ticker가 QQQ면 VOO
    const absorber = ticker === 'QQQ' ? 'VOO' : 'QQQ'
    
    // 변경 ticker와 흡수자 외 나머지 합계 (고정값)
    const fixed = prev.etfAlloc
      .filter(a => a.ticker !== ticker && a.ticker !== absorber)
      .reduce((s, a) => s + a.pct, 0)
    
    // 흡수자 = 100 - 변경값 - 고정값
    const absorberPct = Math.max(0, 100 - clamped - fixed)
    
    return {
      ...prev,
      etfAlloc: prev.etfAlloc.map(a => {
        if (a.ticker === ticker)  return { ...a, pct: clamped }
        if (a.ticker === absorber) return { ...a, pct: absorberPct }
        return a
      }),
    }
  })
}
```

## 동작 방식

```
SCHD [──●──] 50%  →  60%로 올리면
VOO  [────●] 30%  →  30% 유지
QQQ  [──●──] 20%  →  자동으로 10%로 줄어듦 ✅
```

- 슬라이더를 움직인 ETF 외에, **QQQ가 기본 흡수자** (변경 대상이 QQQ면 VOO가 흡수)
- 나머지 ETF는 고정, 흡수자만 `100 - 변경값 - 고정합계`로 자동 조정
- 흡수자가 0% 미만이 되면 0으로 고정

## 버전
- components/Footer.tsx: v1.40
- app/login/page.tsx: v1.40
- 커밋 메시지: "feat: v1.40 - ETF 슬라이더 연동 (마지막 ETF 자동 흡수)"
- git push까지
