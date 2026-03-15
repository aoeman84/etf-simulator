export interface ETFInfo {
  ticker: string
  name: string
  price: number
  divYield: number
  divGrowthCAGR: number
  priceCAGR: number
  color: string
}

export interface TaxSettings {
  enabled: boolean
  withholdingTax: boolean
  comprehensiveIncomeTax: boolean
  otherIncomeKRW: number
  /** @deprecated marginalRate는 자동 누진세 계산으로 대체됨 */
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
