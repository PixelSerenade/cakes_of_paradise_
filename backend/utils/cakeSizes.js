const WEIGHT_LIMIT_KG = 5;

const expandCakeSizes = (product) => {
  const sizes = (product?.sizes || []).map((size) => ({ name: size.name, price: Number(size.price) }));
  if (!product || product.category === 'Cupcakes & Jars') return sizes;

  const weighted = sizes
    .map((size) => ({ size, weight: Number.parseFloat(String(size.name).replace(',', '.')) }))
    .filter((entry) => Number.isFinite(entry.weight) && /kg/i.test(entry.size.name))
    .sort((a, b) => a.weight - b.weight);
  if (!weighted.length) return sizes;

  const largest = weighted[weighted.length - 1];
  const previous = weighted[weighted.length - 2];
  const slope = previous && largest.weight > previous.weight
    ? (largest.size.price - previous.size.price) / (largest.weight - previous.weight)
    : largest.size.price / largest.weight;
  if (!(slope > 0)) return sizes;

  const existing = new Set(weighted.map((entry) => entry.weight));
  for (let weight = 3; weight <= WEIGHT_LIMIT_KG; weight += 1) {
    if (existing.has(weight)) continue;
    const lower = [...weighted].reverse().find((entry) => entry.weight < weight);
    const upper = weighted.find((entry) => entry.weight > weight);
    const rawPrice = lower && upper
      ? lower.size.price + (upper.size.price - lower.size.price) * ((weight - lower.weight) / (upper.weight - lower.weight))
      : lower
        ? lower.size.price + slope * (weight - lower.weight)
        : upper
          ? upper.size.price + slope * (weight - upper.weight)
          : largest.size.price + slope * (weight - largest.weight);
    const price = Math.max(50, Math.round(rawPrice / 50) * 50);
    sizes.push({ name: `${weight} kg`, price });
  }
  return sizes.sort((a, b) => {
    const weightA = Number.parseFloat(a.name);
    const weightB = Number.parseFloat(b.name);
    return weightA - weightB;
  });
};

module.exports = { expandCakeSizes };
