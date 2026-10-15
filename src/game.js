// Card style icons, in style order 0-4. Files live in public/images/.
export const ICONS = ['fire', 'droplet', 'leaf', 'lightning', 'moon'].map(
  (n) => `${import.meta.env.BASE_URL}images/${n}.svg`,
)
export const R = 5, C = 6, N = 30 // card id = style*6 + (rank-1)
export const LV = [
  { h: 0, t: 0, m: 0, d: 0 },
  { h: 10, t: 300, m: 0, d: 0 },
  { h: 15, t: 240, m: 120, d: 8 },
]
export const LEVEL_NAMES = ['Normal', 'Hard', 'Brutal']

export function rng(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function deal(seed) {
  const r = rng(seed), b = [...Array(N).keys()]
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export function rowOk(b, r) {
  const s = Math.floor(b[r * C] / C)
  for (let c = 0; c < C; c++) if (b[r * C + c] !== s * C + c) return false
  return true
}

export function rowsDone(b) {
  let n = 0
  for (let r = 0; r < R; r++) if (rowOk(b, r)) n++
  return n
}