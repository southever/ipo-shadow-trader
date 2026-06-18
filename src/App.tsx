import { useEffect, useMemo, useState } from 'react'
import ipoData from './data/ipo-cases.json'
import {
  INITIAL_CASH,
  TOTAL_TICKS,
  equity,
  executeTrade,
  generatePricePath,
  maxDrawdown,
  scoreRun,
} from './lib/simulation'
import type { IpoCase, Portfolio, ReplayStage, Trade } from './types'

const cases = ipoData as IpoCase[]
const ratios = [0.25, 0.5, 1]
const stages = ['发行定价', '认购热度', '配售结果', '暗盘开局', '尾段博弈']

const money = new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 })
const price = new Intl.NumberFormat('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

function ArrowIcon({ down = false }: { down?: boolean }) {
  return <span aria-hidden="true" className={down ? 'arrow down' : 'arrow'}>↗</span>
}

function Logo() {
  return <div className="logo"><span className="logo-mark">暗</span><span>暗盘练习生</span></div>
}

function Landing({ onStart }: { onStart: (index: number) => void }) {
  const [selected, setSelected] = useState(0)
  const archetypes = ['情绪爆发', '温和博弈', '破发压力', '平台分歧', '隔夜反转']

  return (
    <main className="landing">
      <nav className="topbar"><Logo /><span className="top-note">历史情境 · 模拟交易 · 即时复盘</span></nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">HK IPO GREY MARKET LAB</span>
          <h1>在揭晓答案前，<br />先和市场过两招。</h1>
          <p>10 个真实港股 IPO 结局，五阶段信息释放。你做仓位决策，我们负责把偏见照出来。</p>
          <div className="hero-actions">
            <button className="primary xl" onClick={() => onStart(selected)}>开始盲测 <ArrowIcon /></button>
            <span>无需登录 · 单局约 5 分钟</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="模拟交易走势预览">
          <div className="visual-top"><span>盲测样本 A</span><span className="live-dot">情境回放</span></div>
          <svg viewBox="0 0 580 280" role="img" aria-label="示意行情曲线">
            <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff5a36" stopOpacity=".34" /><stop offset="1" stopColor="#ff5a36" stopOpacity="0" /></linearGradient></defs>
            {[55, 105, 155, 205, 255].map((y) => <line key={y} x1="20" y1={y} x2="560" y2={y} className="gridline" />)}
            <path d="M20 229 C65 220 80 236 120 208 S185 181 215 196 S275 131 320 151 S380 84 418 108 S480 52 560 61 L560 270 L20 270 Z" fill="url(#area)" />
            <path d="M20 229 C65 220 80 236 120 208 S185 181 215 196 S275 131 320 151 S380 84 418 108 S480 52 560 61" className="preview-line" />
            <circle cx="560" cy="61" r="6" className="preview-dot" />
          </svg>
          <div className="visual-stats"><div><span>训练资金</span><strong>HK$100,000</strong></div><div><span>信息阶段</span><strong>5</strong></div><div><span>真实结局</span><strong>隐藏</strong></div></div>
        </div>
      </section>

      <section className="cases-section">
        <div className="section-heading"><div><span className="eyebrow">CHOOSE YOUR ROUND</span><h2>选择今天的训练局</h2></div><p>股票身份在结算后揭晓。标签只描述训练主题，不泄露涨跌。</p></div>
        <div className="case-grid">
          {cases.map((item, index) => (
            <button key={item.code} className={`case-card ${selected === index ? 'selected' : ''}`} onClick={() => setSelected(index)}>
              <div className="case-number">{String(index + 1).padStart(2, '0')}</div>
              <div className="case-main"><span className="pill">{archetypes[index % archetypes.length]}</span><h3>神秘新股 {String.fromCharCode(65 + index)}</h3><p>{item.difficulty}难度 · {item.board}</p></div>
              <span className="select-ring">{selected === index ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      </section>
      <footer><span>数据结果来自公开 IPO 汇总接口</span><span>模拟路径 ≠ 历史分钟行情 · 仅供训练</span></footer>
    </main>
  )
}

function Chart({ points, visible, issuePrice }: { points: ReturnType<typeof generatePricePath>; visible: number; issuePrice: number }) {
  const shown = points.slice(0, visible + 1)
  const values = shown.map((p) => p.price).concat(issuePrice)
  const min = Math.min(...values) * 0.97
  const max = Math.max(...values) * 1.03
  const x = (i: number) => 28 + (i / (TOTAL_TICKS - 1)) * 692
  const y = (value: number) => 25 + ((max - value) / Math.max(0.01, max - min)) * 280
  const pathData = shown.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.price)}`).join(' ')
  const last = shown[shown.length - 1]
  const positive = last.price >= issuePrice

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 750 340" role="img" aria-label="模拟暗盘价格走势">
        {[45, 105, 165, 225, 285].map((gy) => <line key={gy} x1="28" y1={gy} x2="720" y2={gy} className="chart-grid" />)}
        <line x1="28" y1={y(issuePrice)} x2="720" y2={y(issuePrice)} className="issue-line" />
        <text x="34" y={y(issuePrice) - 7} className="issue-label">发行价 {price.format(issuePrice)}</text>
        <path d={pathData} className={`chart-line ${positive ? 'up' : 'negative'}`} />
        <circle cx={x(last.index)} cy={y(last.price)} r="5.5" className={`chart-dot ${positive ? 'up' : 'negative'}`} />
      </svg>
      <div className="chart-times"><span>16:15</span><span>16:45</span><span>17:15</span><span>17:45</span><span>18:15</span></div>
    </div>
  )
}

function StageIntel({ ipo, stage }: { ipo: IpoCase; stage: ReplayStage }) {
  const rows = [
    { label: '发行价', value: `HK$${price.format(ipo.issuePrice)}`, note: `${ipo.board} · 市值约 ${number.format(ipo.issueMarketCap)} 亿` },
    { label: '公开认购', value: `${number.format(ipo.overSubMultiple)} 倍`, note: ipo.overSubMultiple > 1000 ? '热度极高，注意筹码拥挤' : '认购热度进入观察区' },
    { label: '一手中签率', value: `${number.format(ipo.lotWinRate)}%`, note: `稳价人与承销：${ipo.underwriter}` },
    { label: '暗盘观察', value: '波动放大', note: '报价开始，身份与最终结局仍隐藏' },
    { label: '尾段提醒', value: '流动性收窄', note: '临近收盘，谨防追涨杀跌' },
  ]

  return <div className="intel-list">{rows.map((row, index) => (
    <div className={`intel-row ${index <= stage ? 'revealed' : ''}`} key={row.label}>
      <span className="intel-step">{index + 1}</span>
      <div><span>{index <= stage ? row.label : '待揭示信息'}</span><strong>{index <= stage ? row.value : '••••••'}</strong><small>{index <= stage ? row.note : '推进行情后解锁'}</small></div>
    </div>
  ))}</div>
}

function Trading({ ipo, onExit }: { ipo: IpoCase; onExit: () => void }) {
  const path = useMemo(() => generatePricePath(ipo), [ipo])
  const [tick, setTick] = useState(0)
  const [portfolio, setPortfolio] = useState<Portfolio>({ cash: INITIAL_CASH, shares: 0, totalFees: 0 })
  const [trades, setTrades] = useState<Trade[]>([])
  const [history, setHistory] = useState([INITIAL_CASH])
  const [notice, setNotice] = useState('')
  const [finished, setFinished] = useState(false)
  const [autoPlay, setAutoPlay] = useState(true)
  const [speed, setSpeed] = useState(1)
  const current = path[tick]
  const total = equity(portfolio, current.price)
  const pnl = total - INITIAL_CASH

  function trade(side: 'buy' | 'sell', ratio: number) {
    if (finished) return
    const result = executeTrade(portfolio, side, ratio, current.price, tick, trades.length + 1)
    if (!result) {
      setNotice(side === 'buy' ? '可用现金不足，无法继续买入' : '当前没有可卖持仓')
      return
    }
    setPortfolio(result.portfolio)
    setTrades((prev) => [result.trade, ...prev])
    setHistory((prev) => [...prev, equity(result.portfolio, current.price)])
    setNotice(`${side === 'buy' ? '买入' : '卖出'} ${result.trade.shares.toLocaleString()} 股已成交`)
  }

  function advance(step = 3) {
    if (finished) return
    const next = Math.min(TOTAL_TICKS - 1, tick + step)
    setTick(next)
    setHistory((prev) => [...prev, equity(portfolio, path[next].price)])
    setNotice('')
    if (next === TOTAL_TICKS - 1) setFinished(true)
  }

  useEffect(() => {
    if (!autoPlay || finished) return
    const timer = window.setTimeout(() => advance(1), 1400 / speed)
    return () => window.clearTimeout(timer)
  }, [autoPlay, finished, portfolio, speed, tick])

  if (finished) {
    return <Review ipo={ipo} path={path} portfolio={portfolio} trades={trades} history={history} onExit={onExit} />
  }

  return (
    <main className="terminal-page">
      <nav className="topbar terminal-nav"><Logo /><div className="round-label">盲测局 · 神秘新股</div><button className="text-btn" onClick={onExit}>退出训练</button></nav>
      <div className="stage-bar">{stages.map((label, index) => <div key={label} className={`${index < current.stage ? 'done' : ''} ${index === current.stage ? 'active' : ''}`}><span>{index < current.stage ? '✓' : index + 1}</span><small>{label}</small></div>)}</div>

      <section className="terminal-grid">
        <div className="market-panel panel">
          <div className="panel-head"><div><span className="eyebrow dark">SIMULATED GREY MARKET</span><h2>神秘新股 · 情境 {stages[current.stage]}</h2></div><div className={`quote ${current.changePct >= 0 ? 'positive' : 'negative'}`}><strong>{price.format(current.price)}</strong><span>{current.changePct >= 0 ? '+' : ''}{current.changePct.toFixed(2)}%</span></div></div>
          <Chart points={path} visible={tick} issuePrice={ipo.issuePrice} />
          <div className="timeline-control">
            <div><strong>{Math.round((tick / (TOTAL_TICKS - 1)) * 120)} 分钟</strong><span>行情进度 {Math.round((tick / (TOTAL_TICKS - 1)) * 100)}%</span></div>
            <div className="playback-controls">
              <button className="play-toggle" onClick={() => setAutoPlay((value) => !value)}>{autoPlay ? 'Ⅱ 暂停' : '▶ 播放'}</button>
              <div className="speed-picker" aria-label="行情播放速度">{[1, 2, 4].map((value) => <button key={value} className={speed === value ? 'active' : ''} onClick={() => setSpeed(value)}>{value}×</button>)}</div>
              <button className="advance" onClick={() => advance(3)}>推进 6 分钟 <ArrowIcon /></button>
            </div>
          </div>
        </div>

        <aside className="intel-panel panel"><div className="panel-title"><span>市场情报</span><span>{current.stage + 1}/5 已解锁</span></div><StageIntel ipo={ipo} stage={current.stage} /></aside>

        <div className="portfolio-panel panel">
          <div className="panel-title"><span>模拟账户</span><span>训练成本 0.1%</span></div>
          <div className="account-value"><span>总资产</span><strong>{money.format(total)}</strong><small className={pnl >= 0 ? 'positive' : 'negative'}>{pnl >= 0 ? '+' : ''}{money.format(pnl)} ({(pnl / INITIAL_CASH * 100).toFixed(2)}%)</small></div>
          <div className="account-grid"><div><span>可用现金</span><strong>{money.format(portfolio.cash)}</strong></div><div><span>当前持仓</span><strong>{portfolio.shares.toLocaleString()} 股</strong></div><div><span>持仓市值</span><strong>{money.format(portfolio.shares * current.price)}</strong></div><div><span>累计成本</span><strong>{money.format(portfolio.totalFees)}</strong></div></div>
          <div className="trade-controls">
            <div className="trade-row"><span>买入</span>{ratios.map((r) => <button key={r} onClick={() => trade('buy', r)}>{r * 100}%</button>)}</div>
            <div className="trade-row sell"><span>卖出</span>{ratios.map((r) => <button key={r} onClick={() => trade('sell', r)}>{r * 100}%</button>)}</div>
          </div>
          <p className={`trade-notice ${notice ? 'show' : ''}`}>{notice || '每次操作按现金或持仓比例执行'}</p>
        </div>

        <div className="trades-panel panel"><div className="panel-title"><span>操作记录</span><span>{trades.length} 笔</span></div>{trades.length ? <div className="trade-log">{trades.slice(0, 5).map((t) => <div key={t.id}><span className={t.side === 'buy' ? 'buy-tag' : 'sell-tag'}>{t.side === 'buy' ? '买' : '卖'}</span><span>{t.shares.toLocaleString()} 股</span><strong>@ {price.format(t.price)}</strong><small>第 {Math.round(t.tick * 2)} 分钟</small></div>)}</div> : <div className="empty-log">尚未交易。先读信息，别急着按按钮。</div>}</div>
      </section>
      <div className="sim-disclaimer">本页行情为基于真实最终结果生成的情境模拟，并非历史分钟行情。</div>
    </main>
  )
}

function Review({ ipo, path, portfolio, trades, history, onExit }: { ipo: IpoCase; path: ReturnType<typeof generatePricePath>; portfolio: Portfolio; trades: Trade[]; history: number[]; onExit: () => void }) {
  const finalEquity = equity(portfolio, path[path.length - 1].price)
  const totalReturn = ((finalEquity / INITIAL_CASH) - 1) * 100
  const drawdown = maxDrawdown([...history, finalEquity])
  const score = scoreRun(totalReturn, drawdown, trades.length, portfolio.totalFees)
  const grade = score >= 85 ? '纪律大师' : score >= 70 ? '冷静交易者' : score >= 55 ? '有潜力的观察者' : '情绪型选手'
  const advice = trades.length === 0 ? '你成功避开了冲动，但也错过了验证判断的机会。下一局尝试用 25% 仓位表达观点。' : drawdown > 8 ? '仓位暴露偏快。先用小仓确认方向，再为错误判断保留撤退空间。' : trades.length > 7 ? '交易次数偏多，成本正在蚕食判断优势。每次出手前写下一个明确理由。' : totalReturn >= 0 ? '盈利与风险控制兼顾得不错。继续关注“信息变化”而不是只盯价格变化。' : '结果不理想，但回撤仍可控。复盘第一次买入的位置，辨认当时依据是信息还是情绪。'

  return <main className="review-page">
    <nav className="topbar"><Logo /><button className="text-btn" onClick={onExit}>返回训练大厅</button></nav>
    <section className="reveal-banner"><div><span className="eyebrow">IDENTITY REVEALED</span><h1>{ipo.name}</h1><p>{ipo.code}.HK · {ipo.board} · {ipo.listDate} 上市</p></div><div className="reveal-result"><span>富途暗盘真实结果</span><strong className={ipo.futuDarkPool >= 0 ? 'positive' : 'negative'}>{ipo.futuDarkPool >= 0 ? '+' : ''}{ipo.futuDarkPool.toFixed(2)}%</strong></div></section>
    <section className="review-grid">
      <div className="score-card panel"><div className="score-ring" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}><div><strong>{score}</strong><span>综合分</span></div></div><div><span className="eyebrow dark">YOUR TRADING PERSONA</span><h2>{grade}</h2><p>{advice}</p></div></div>
      <div className="metric-card panel"><span>本局收益</span><strong className={totalReturn >= 0 ? 'positive' : 'negative'}>{totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%</strong><small>{money.format(finalEquity - INITIAL_CASH)}</small></div>
      <div className="metric-card panel"><span>最大回撤</span><strong>{drawdown.toFixed(2)}%</strong><small>越低越稳健</small></div>
      <div className="metric-card panel"><span>交易成本</span><strong>{money.format(portfolio.totalFees)}</strong><small>{trades.length} 笔交易</small></div>
      <div className="truth-card panel"><div className="panel-title"><span>真实结局对照</span><span>{ipo.archetype}</span></div><div className="truth-bars"><div><span>富途暗盘</span><div><i style={{ width: `${Math.min(100, Math.abs(ipo.futuDarkPool))}%` }} className={ipo.futuDarkPool >= 0 ? 'bar-up' : 'bar-down'} /></div><strong>{ipo.futuDarkPool >= 0 ? '+' : ''}{ipo.futuDarkPool.toFixed(2)}%</strong></div><div><span>利弗莫尔</span><div><i style={{ width: `${Math.min(100, Math.abs(ipo.livermoreDarkPool))}%` }} className={ipo.livermoreDarkPool >= 0 ? 'bar-up' : 'bar-down'} /></div><strong>{ipo.livermoreDarkPool >= 0 ? '+' : ''}{ipo.livermoreDarkPool.toFixed(2)}%</strong></div><div><span>上市首日</span><div><i style={{ width: `${Math.min(100, Math.abs(ipo.firstDayChange))}%` }} className={ipo.firstDayChange >= 0 ? 'bar-up' : 'bar-down'} /></div><strong>{ipo.firstDayChange >= 0 ? '+' : ''}{ipo.firstDayChange.toFixed(2)}%</strong></div></div></div>
      <div className="lesson-card panel"><span className="eyebrow dark">ONE THING TO REMEMBER</span><h2>别把“热门”误读成“安全”。</h2><p>本案例公开认购 {number.format(ipo.overSubMultiple)} 倍、一手中签率 {number.format(ipo.lotWinRate)}%。热度能放大趋势，也能放大拥挤交易的脆弱性。</p><button className="primary" onClick={onExit}>再练一局 <ArrowIcon /></button></div>
    </section>
    <footer><span>数据源：hkipo-stock-api · 富途 / 利弗莫尔汇总</span><span>模拟训练不构成投资建议</span></footer>
  </main>
}

export default function App() {
  const [selected, setSelected] = useState<number | null>(null)
  if (cases.length === 0) return <div className="loading">案例数据正在准备中…</div>
  return selected === null ? <Landing onStart={setSelected} /> : <Trading ipo={cases[selected]} onExit={() => setSelected(null)} />
}
