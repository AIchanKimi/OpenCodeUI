export function formatTokens(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M'
  if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
  return count.toString()
}

export function formatCost(cost: number): string {
  if (cost === 0) return '$0'
  if (cost < 0.001) return '<$0.001'
  if (cost < 0.01) return '$' + cost.toFixed(3)
  if (cost < 1) return '$' + cost.toFixed(2)
  return '$' + cost.toFixed(2)
}
