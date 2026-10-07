import lodash from 'lodash';

const { isArray, isPlainObject } = lodash;

export const TRADE_MODE = Object.freeze({ EXCHANGE: 'exchange', OTC: 'otc' });
export const TRADE_ACTION = Object.freeze({ BUY: 'buy', SELL: 'sell', SUBSCRIBE: 'subscribe', REDEEM: 'redeem' });
export const TRADE_STATUS = Object.freeze({
  EXECUTED: 'executed',
  SUBMITTED: 'submitted',
  WAITING_CONFIRM: 'waiting_confirm',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled'
});
export const TRADE_SOURCE = Object.freeze({ MANUAL: 'manual', SCREENSHOT: 'screenshot' });
export const SCREENSHOT_TYPE = Object.freeze({
  EXCHANGE_TRADE: 'exchange_trade',
  OTC_APPLICATION: 'otc_application',
  OTC_CONFIRMATION: 'otc_confirmation',
  HOLDING_SNAPSHOT: 'holding_snapshot',
  UNKNOWN: 'unknown'
});

export const createTradeId = () => `trade_${globalThis.crypto.randomUUID()}`;

export const calculatePendingOtcAmount = (trades) =>
  (isArray(trades) ? trades : [])
    .filter(
      (trade) =>
        trade.mode === TRADE_MODE.OTC &&
        trade.action === TRADE_ACTION.SUBSCRIBE &&
        [TRADE_STATUS.SUBMITTED, TRADE_STATUS.WAITING_CONFIRM].includes(trade.status)
    )
    .reduce((sum, trade) => sum + Number(trade.amount || 0), 0);

export const calculateTradeJournalAssets = (journal) => {
  const cash = journal?.cash == null ? null : Number(journal.cash);
  const pendingAmount = calculatePendingOtcAmount(journal?.trades);
  const holdings = isPlainObject(journal?.holdings) ? journal.holdings : {};
  const holdingCost = Object.values(holdings).reduce((sum, holding) => {
    const shares = Number(holding?.share);
    const cost = Number(holding?.cost);
    return Number.isFinite(shares) && Number.isFinite(cost) && shares > 0 && cost >= 0 ? sum + shares * cost : sum;
  }, 0);
  return {
    cash: Number.isFinite(cash) ? cash : null,
    pendingAmount,
    holdingCost,
    totalAtCost: Number.isFinite(cash) ? cash + pendingAmount + holdingCost : null
  };
};
