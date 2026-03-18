export interface ETFInfo {
  ticker: string
  name: string
  price: number
  divYield: number
  divGrowthCAGR: number
  priceCAGR: number
  color: string
  tooltip?: string
}

export interface TaxSettings {
  enabled: boolean
  withholdingTax: boolean
  comprehensiveIncomeTax: boolean
  /** 다른 금융소득: 이자, 기타 배당 등 (2,000만원 한도 합산용) */
  otherFinancialIncomeKRW: number
  /** 다른 종합소득: 근로소득, 사업소득 등 (누진세 합산용) */
  otherIncomeKRW: number
  /** @deprecated 자동 누진세 계산으로 대체 */
  marginalRate?: number
  healthInsurance: boolean
  capitalGainsTax: boolean
}

export interface SimSettings {
  monthlyKRW: number
  years: number
  fxRate: number
  drip: boolean
  etfs: string[]
  tax: TaxSettings
}

export interface TaxBreakdown {
  withholdingTaxKRW: number
  surchargeKRW: number
  totalDivTaxKRW: number
  afterTaxDivKRW: number
  afterTaxMonthlyDivKRW: number
  capitalGainsTaxKRW: number
  afterTaxGainKRW: number
  healthInsuranceRisk: boolean
  /** 전체 금융소득 (배당 + 다른 금융소득) */
  financialIncomeKRW: number
  exceedsThreshold: boolean
  /** 실효세율 (%) */
  effectiveTaxRate: number
}

export interface YearResult {
  year: number
  invested: number
  portfolioKRW: number
  gainKRW: number
  gainPct: number
  annualDivKRW: number
  monthlyDivKRW: number
  tax: TaxBreakdown
}

export interface PortfolioSave {
  id: string
  name: string
  settings: SimSettings
  createdAt: string
}
