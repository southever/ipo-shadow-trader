export type ReplayStage = 0 | 1 | 2 | 3 | 4

export interface IpoCase {
  code: string
  name: string
  board: string
  listDate: string
  issuePrice: number
  lotWinRate: number
  overSubMultiple: number
  issueMarketCap: number
  futuDarkPool: number
  livermoreDarkPool: number
  firstDayChange: number
  underwriter: string
  archetype: string
  difficulty: '入门' | '进阶' | '高压'
  seed: number
}

export interface PriceTick {
  index: number
  stage: ReplayStage
  price: number
  changePct: number
}

export interface Trade {
  id: number
  tick: number
  side: 'buy' | 'sell'
  shares: number
  price: number
  fee: number
  value: number
}

export interface Portfolio {
  cash: number
  shares: number
  totalFees: number
}
