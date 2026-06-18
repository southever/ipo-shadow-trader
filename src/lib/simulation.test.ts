import { describe, expect, it } from 'vitest'
import type { IpoCase, Portfolio } from '../types'
import { INITIAL_CASH, executeTrade, generatePricePath } from './simulation'

const ipo: IpoCase = {
  code: '00001', name: '测试', board: '主板', listDate: '2026-06-01', issuePrice: 20,
  lotWinRate: 2, overSubMultiple: 500, issueMarketCap: 80, futuDarkPool: 35,
  livermoreDarkPool: 34, firstDayChange: 20, underwriter: '测试券商', archetype: '温和博弈', difficulty: '入门', seed: 123,
}

describe('price simulation', () => {
  it('creates 60 deterministic ticks ending at the real Futu outcome', () => {
    const a = generatePricePath(ipo)
    const b = generatePricePath(ipo)
    expect(a).toEqual(b)
    expect(a).toHaveLength(60)
    expect(a.at(-1)?.price).toBeCloseTo(27, 3)
    expect(a.at(-1)?.changePct).toBe(35)
  })
})

describe('trading', () => {
  const empty: Portfolio = { cash: INITIAL_CASH, shares: 0, totalFees: 0 }
  it('buys within cash and charges 0.1%', () => {
    const result = executeTrade(empty, 'buy', 1, 20, 0, 1)
    expect(result).not.toBeNull()
    expect(result!.portfolio.cash).toBeGreaterThanOrEqual(0)
    expect(result!.portfolio.totalFees).toBeGreaterThan(0)
  })
  it('rejects selling with no holdings', () => {
    expect(executeTrade(empty, 'sell', 1, 20, 0, 1)).toBeNull()
  })
  it('sells all without leaving rounding dust', () => {
    const holding = { cash: 100, shares: 123, totalFees: 0 }
    expect(executeTrade(holding, 'sell', 1, 20, 0, 1)?.portfolio.shares).toBe(0)
  })
})
