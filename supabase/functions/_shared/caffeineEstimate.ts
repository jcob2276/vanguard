/** Parses explicit "90mg" in name first; otherwise heuristic by drink type. */
export function estimateCaffeineMg(name: string): number {
  const n = name.toLowerCase()
  const explicit = n.match(/(\d{1,4})\s*mg/)
  if (explicit) return Number(explicit[1])
  if (n.includes('espresso')) return 63
  if (
    n.includes('kawa') || n.includes('coffee') || n.includes('americano') ||
    n.includes('cappuccino') || n.includes('latte') || n.includes('flat white') ||
    n.includes('cortado') || n.includes('macchiato') || n.includes('cold brew')
  ) return 95
  if (n.includes('matcha') || n.includes('green tea')) return 30
  if (n.includes('herbata') || n.includes('tea')) return 47
  if (n.includes('energy drink') || n.includes('red bull') || n.includes('monster')) return 80
  if (n.includes('cola') || n.includes('pepsi')) return 35
  return 0
}
