import { mkdir, writeFile } from 'node:fs/promises'

const API = 'https://hkipo.langtangs.com/v2/ipos'
const response = await fetch(`${API}?status=listed&limit=60`)
if (!response.ok) throw new Error(`IPO list request failed: ${response.status}`)
const { items } = await response.json()
const cutoff = new Date()
cutoff.setMonth(cutoff.getMonth() - 3)

const details = []
for (const item of items) {
  if (new Date(item.listDate) < cutoff) continue
  const detailResponse = await fetch(`${API}/${item.code}`)
  if (!detailResponse.ok) continue
  const detail = await detailResponse.json()
  const numeric = ['issuePrice', 'lotWinRate', 'overSubMultiple', 'issueMarketCap', 'futuDarkPool', 'livermoreDarkPool', 'firstDayChange']
  if (numeric.some((key) => !Number.isFinite(Number(detail[key])))) continue
  details.push(detail)
}

const byStrength = [...details].sort((a, b) => Number(b.futuDarkPool) - Number(a.futuDarkPool))
const strong = byStrength.filter((x) => Number(x.futuDarkPool) >= 50).slice(0, 3)
const moderate = byStrength.filter((x) => Number(x.futuDarkPool) >= 5 && Number(x.futuDarkPool) < 50).slice(0, 2)
const breaks = [...details].filter((x) => Number(x.futuDarkPool) < 0).sort((a, b) => Number(a.futuDarkPool) - Number(b.futuDarkPool)).slice(0, 3)
const divergence = [...details]
  .filter((x) => ![...strong, ...moderate, ...breaks].some((picked) => picked.code === x.code))
  .sort((a, b) => {
    const signal = (x) => Math.abs(Number(x.futuDarkPool) - Number(x.livermoreDarkPool)) + Math.abs(Number(x.firstDayChange) - Number(x.futuDarkPool)) * 0.45
    return signal(b) - signal(a)
  })
  .slice(0, 2)

const picked = [...strong, ...moderate, ...breaks, ...divergence]
for (const fallback of [...details].sort((a, b) => Number(b.overSubMultiple) - Number(a.overSubMultiple))) {
  if (picked.length >= 10) break
  if (!picked.some((x) => x.code === fallback.code)) picked.push(fallback)
}

if (picked.length < 10) throw new Error(`Only ${picked.length} complete cases available`)

const cases = picked.slice(0, 10).map((x, index) => {
  const grey = Number(x.futuDarkPool)
  const diff = Math.abs(grey - Number(x.livermoreDarkPool))
  const archetype = grey >= 50 ? '情绪爆发' : grey < 0 ? '破发压力' : diff >= 3 ? '平台分歧' : Math.abs(Number(x.firstDayChange) - grey) >= 20 ? '隔夜反转' : '温和博弈'
  return {
    code: x.code,
    name: x.name,
    board: x.board,
    listDate: x.listDate,
    issuePrice: Number(x.issuePrice),
    lotWinRate: Number(x.lotWinRate),
    overSubMultiple: Number(x.overSubMultiple),
    issueMarketCap: Number(x.issueMarketCap),
    futuDarkPool: grey,
    livermoreDarkPool: Number(x.livermoreDarkPool),
    firstDayChange: Number(x.firstDayChange),
    underwriter: x.underwriter || '未披露',
    archetype,
    difficulty: grey >= 60 || grey <= -15 ? '高压' : diff >= 3 ? '进阶' : '入门',
    seed: 421 + index * 97 + Number(x.code),
  }
})

await mkdir('src/data', { recursive: true })
await writeFile('src/data/ipo-cases.json', `${JSON.stringify(cases, null, 2)}\n`)
console.log(`Saved ${cases.length} IPO cases.`)
