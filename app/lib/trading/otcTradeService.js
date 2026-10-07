import { TRADE_ACTION, TRADE_MODE, TRADE_STATUS, createTradeId } from './tradeModel.js';

export function createOtcApplication({ accountId, code, name = '', amount, requestAt, source, screenshotHash }) {
  if (!accountId || !/^\d{6}$/.test(String(code || ''))) throw new Error('请确认账户和基金代码');
  if (!(Number(amount) > 0) || !requestAt) throw new Error('请确认申购金额和实际提交时间');
  return {
    id: createTradeId(),
    accountId,
    mode: TRADE_MODE.OTC,
    code: String(code),
    name,
    action: TRADE_ACTION.SUBSCRIBE,
    amount: Number(amount),
    requestAt,
    estimatedNavDate: null,
    estimatedConfirmDate: null,
    actualNavDate: null,
    actualConfirmDate: null,
    nav: null,
    shares: null,
    fee: null,
    status: TRADE_STATUS.SUBMITTED,
    source,
    screenshotHash: screenshotHash || null,
    createdAt: new Date().toISOString(),
    postedToHoldingAt: null
  };
}

export function setOtcWaitingConfirm(trade, schedule = {}) {
  if (trade.status !== TRADE_STATUS.SUBMITTED) throw new Error('只有已提交申购可以进入等待确认状态');
  return {
    ...trade,
    estimatedNavDate: schedule.estimatedNavDate || null,
    estimatedConfirmDate: schedule.estimatedConfirmDate || null,
    status: TRADE_STATUS.WAITING_CONFIRM
  };
}

export function confirmOtcApplication(state, tradeId, confirmation) {
  const index = state.trades.findIndex((trade) => trade.id === tradeId);
  if (index < 0) throw new Error('找不到待确认申购');
  const old = state.trades[index];
  if (old.status === TRADE_STATUS.CONFIRMED) return state;
  if (![TRADE_STATUS.SUBMITTED, TRADE_STATUS.WAITING_CONFIRM].includes(old.status)) {
    throw new Error('当前交易不能确认份额');
  }
  if (!confirmation.actualConfirmDate || !(Number(confirmation.nav) > 0) || !(Number(confirmation.shares) > 0)) {
    throw new Error('请确认实际日期、净值和份额');
  }
  if (!Number.isFinite(Number(confirmation.fee || 0)) || Number(confirmation.fee || 0) < 0) {
    throw new Error('确认手续费无效');
  }
  const shares = Number(confirmation.shares);
  const previous = state.holdings[old.code] || { share: 0, cost: 0 };
  const nextShares = Number(previous.share || 0) + shares;
  const nextCost = Number(previous.share || 0) * Number(previous.cost || 0) + old.amount;
  const trade = {
    ...old,
    actualNavDate: confirmation.actualNavDate || null,
    actualConfirmDate: confirmation.actualConfirmDate,
    nav: Number(confirmation.nav),
    shares,
    fee: Number(confirmation.fee || 0),
    status: TRADE_STATUS.CONFIRMED,
    postedToHoldingAt: new Date().toISOString()
  };
  const trades = [...state.trades];
  trades[index] = trade;
  return {
    ...state,
    trades,
    holdings: { ...state.holdings, [old.code]: { ...previous, share: nextShares, cost: nextCost / nextShares } }
  };
}
