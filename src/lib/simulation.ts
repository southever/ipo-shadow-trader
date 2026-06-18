import type { BollingerPoint, IpoCase, MacdPoint, Portfolio, PriceTick, ReplayStage, Trade } from '../types'

export const INITIAL_CASH = 100_000
export const FEE_RATE = 0.001
export const TICKS_PER_STAGE = 24
export const TOTAL_TICKS = 120

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
  const closes = raw.map((value, index) => {
    const ease = Math.pow(index / (TOTAL_TICKS - 1), 1.65)
    return index === TOTAL_TICKS - 1 ? target : value + correction * ease
  })

  return closes.map((closeValue, index) => {
    const openValue = index === 0 ? start : closes[index - 1]
    const wickScale = start * (0.0025 + random() * 0.007)
    const highValue = Math.max(openValue, closeValue) + wickScale * (0.45 + random())
    const lowValue = Math.max(start * 0.2, Math.min(openValue, closeValue) - wickScale * (0.45 + random()))
    const close = Number(closeValue.toFixed(3))
    return {
      index,
      stage: Math.min(4, Math.floor(index / TICKS_PER_STAGE)) as ReplayStage,
      price: close,
      open: Number(openValue.toFixed(3)),
      high: Number(highValue.toFixed(3)),
      low: Number(lowValue.toFixed(3)),
      close,
      changePct: Number((((closeValue / start) - 1) * 100).toFixed(2)),
    }
  })
}

export function movingAverage(points: PriceTick[], period: number): Array<number | null> {
  let sum = 0
  return points.map((point, index) => {
    sum += point.close
    if (index >= period) sum -= points[index - period].close
    return index >= period - 1 ? sum / period : null
  })
}

export function bollingerBands(points: PriceTick[], period = 20, multiplier = 2): Array<BollingerPoint | null> {
  const middle = movingAverage(points, period)
  return points.map((_, index) => {
    if (middle[index] === null) return null
    const window = points.slice(index - period + 1, index + 1).map((point) => point.close)
    const mean = middle[index]!
    const variance = window.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period
    const deviation = Math.sqrt(variance) * multiplier
    return { middle: mean, upper: mean + deviation, lower: mean - deviation }
  })
}

function exponentialMovingAverage(values: number[], period: number) {
  const alpha = 2 / (period + 1)
  const result = [values[0]]
  for (let index = 1; index < values.length; index += 1) {
    result.push(values[index] * alpha + result[index - 1] * (1 - alpha))
  }
  return result
}

export function macd(points: PriceTick[]): Array<MacdPoint | null> {
  const closes = points.map((point) => point.close)
  if (!closes.length) return []
  const fast = exponentialMovingAverage(closes, 12)
  const slow = exponentialMovingAverage(closes, 26)
  const difValues = closes.map((_, index) => fast[index] - slow[index])
  const warmedDif = difValues.slice(25)
  const signalValues = warmedDif.length ? exponentialMovingAverage(warmedDif, 9) : []

  return points.map((_, index) => {
    if (index < 25) return null
    const signalIndex = index - 25
    const dif = difValues[index]
    const ready = signalIndex >= 8
    const dea = ready ? signalValues[signalIndex] : null
    return { dif, dea, histogram: dea === null ? null : dif - dea }
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
