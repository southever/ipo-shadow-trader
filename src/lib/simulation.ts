import type { IpoCase, Portfolio, PriceTick, ReplayStage, Trade } from '../types'

export const INITIAL_CASH = 100_000
export const FEE_RATE = 0.001
export const TICKS_PER_STAGE = 12
export const TOTAL_TICKS = 60

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generatePricePath(ipo: IpoCase): PriceTick[] {
  const random = mulberry32(ipo.seed)
  const start = ipo.issuePrice
  const target = start * (1 + ipo.futuDarkPool / 100)
  let drift = start * ((random() - 0.45) * 0.035)
  const raw: number[] = [start + drift]

  for (let i = 1; i < TOTAL_TICKS; i += 1) {
    const progress = i / (TOTAL_TICKS - 1)
    const targetPull = (target - raw[i - 1]) * (0.035 + progress * 0.09)
    const volatility = start * (0.012 + Math.abs(ipo.futuDarkPool) / 9000)
    const pulse = Math.sin(i * 0.48 + ipo.seed) * volatility * 0.48
    const noise = (random() - 0.5) * volatility * 1.35
    drift = drift * 0.65 + noise + pulse
    raw.push(Math.max(start * 0.28, raw[i - 1] + targetPull + drift))
  }

  const correction = target - raw[TOTAL_TICKS - 1]
  return raw.map((value, index) => {
    const ease = Math.pow(index / (TOTAL_TICKS - 1), 1.65)
    const price = index === TOTAL_TICKS - 1 ? target : value + correction * ease
    return {
      index,
      stage: Math.min(4, Math.floor(index / TICKS_PER_STAGE)) as ReplayStage,
      price: Number(price.toFixed(3)),
      changePct: Number((((price / start) - 1) * 100).toFixed(2)),
    }
  })
}

export function executeTrade(
  portfolio: Portfolio,
  side: 'buy' | 'sell',
  ratio: number,
  price: number,
  tick: number,
  id: number,
): { portfolio: Portfolio; trade: Trade } | null {
  if (side === 'buy') {
    const budget = portfolio.cash * ratio
    const shares = Math.floor(budget / (price * (1 + FEE_RATE)))
    if (shares <= 0) return null
    const value = shares * price
    const fee = value * FEE_RATE
    return {
      portfolio: {
        cash: portfolio.cash - value - fee,
        shares: portfolio.shares + shares,
        totalFees: portfolio.totalFees + fee,
      },
      trade: { id, tick, side, shares, price, fee, value },
    }
  }

  const shares = ratio === 1 ? portfolio.shares : Math.floor(portfolio.shares * ratio)
  if (shares <= 0) return null
  const value = shares * price
  const fee = value * FEE_RATE
  return {
    portfolio: {
      cash: portfolio.cash + value - fee,
      shares: portfolio.shares - shares,
      totalFees: portfolio.totalFees + fee,
    },
    trade: { id, tick, side, shares, price, fee, value },
  }
}

export function equity(portfolio: Portfolio, price: number) {
  return portfolio.cash + portfolio.shares * price
}

export function maxDrawdown(values: number[]) {
  let peak = values[0] ?? INITIAL_CASH
  let worst = 0
  values.forEach((value) => {
    peak = Math.max(peak, value)
    worst = Math.max(worst, peak > 0 ? (peak - value) / peak : 0)
  })
  return worst * 100
}

export function scoreRun(totalReturn: number, drawdown: number, tradeCount: number, fees: number) {
  const returnScore = Math.max(0, Math.min(55, 27 + totalReturn * 3.2))
  const riskScore = Math.max(0, 25 - drawdown * 2.2)
  const discipline = Math.max(0, 20 - Math.max(0, tradeCount - 5) * 2 - fees / 80)
  return Math.round(Math.max(0, Math.min(100, returnScore + riskScore + discipline)))
}
