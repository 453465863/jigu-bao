export const calculateEtfHoldingValuation = (holding, quote) => {
  const shares = Number(holding?.share);
  const cost = holding?.cost == null ? NaN : Number(holding.cost);
  const marketPrice = Number(quote?.marketPrice);
  if (
    quote?.status !== 'available' ||
    !Number.isFinite(shares) ||
    shares <= 0 ||
    !Number.isFinite(marketPrice) ||
    marketPrice <= 0
  ) {
    return { marketValue: null, unrealizedPnl: null };
  }

  const marketValue = shares * marketPrice;
  const unrealizedPnl = Number.isFinite(cost) && cost >= 0 ? marketValue - shares * cost : null;
  return { marketValue, unrealizedPnl };
};
