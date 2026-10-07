import { TRADE_ACTION, TRADE_MODE, TRADE_STATUS } from './tradeModel.js';

export function applyExchangeTrade(state, trade) {
  if (trade.mode !== TRADE_MODE.EXCHANGE || trade.status !== TRADE_STATUS.EXECUTED) {
    throw new Error('交易必须是已成交的场内交易');
  }
  if (!trade.accountId || trade.accountId !== state.accountId) throw new Error('交易账户与当前账户不一致');
  if (!/^\d{6}$/.test(String(trade.code || '')) || !(Number(trade.price) > 0) || !(Number(trade.shares) > 0)) {
    throw new Error('请确认代码、成交价和份额');
  }
  if (!trade.tradeAt || ![TRADE_ACTION.BUY, TRADE_ACTION.SELL].includes(trade.action)) {
    throw new Error('请确认成交时间和买卖方向');
  }
  if (state.trades.some((item) => item.id === trade.id)) return state;
  const shares = Number(trade.shares);
  const price = Number(trade.price);
  const fee = Number(trade.fee || 0);
  if (!Number.isFinite(fee) || fee < 0) throw new Error('手续费无效');
  const old = state.holdings[trade.code] || { share: 0, cost: 0 };
  const holdings = { ...state.holdings };
  let cashDelta;
  let completed = trade;
  if (trade.action === TRADE_ACTION.BUY) {
    const cost = shares * price + fee;
    if (!Number.isFinite(Number(state.cash)) || state.cash == null || Number(state.cash) < cost) {
      throw new Error('当前账户现金不足，请核对起始现金和成交金额');
    }
    const nextShares = Number(old.share || 0) + shares;
    const nextCost = Number(old.share || 0) * Number(old.cost || 0) + cost;
    holdings[trade.code] = { ...old, share: nextShares, cost: nextCost / nextShares, assetType: 'exchange_etf' };
    cashDelta = -cost;
  } else {
    const heldShares = Number(old.share || 0);
    if (shares > heldShares) throw new Error('卖出份额超过当前持仓');
    const proceeds = shares * price - fee;
    const remaining = heldShares - shares;
    holdings[trade.code] = {
      ...old,
      share: remaining,
      cost: remaining > 0 ? Number(old.cost || 0) : 0,
      assetType: 'exchange_etf'
    };
    cashDelta = proceeds;
    completed = { ...trade, realizedPnl: proceeds - shares * Number(old.cost || 0) };
  }
  return {
    ...state,
    cash: state.cash == null ? null : Number(state.cash) + cashDelta,
    trades: [...state.trades, completed],
    holdings
  };
}
