export function computeReputation({ avgSatisfaction, speciesCount, escapesLast5Min }) {
  const r = avgSatisfaction * 3 + Math.min(speciesCount, 5) * 0.4 - escapesLast5Min * 0.5;
  return Math.max(0, Math.min(5, r));
}
