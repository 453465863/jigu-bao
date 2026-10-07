import { SCREENSHOT_TYPE, TRADE_ACTION, TRADE_MODE, TRADE_SOURCE, TRADE_STATUS, createTradeId } from './tradeModel.js';
import { createOtcApplication, setOtcWaitingConfirm, confirmOtcApplication } from './otcTradeService.js';
import { applyExchangeTrade } from './exchangeTradeService.js';

export function commitTradeDraft({
  state,
  currentAccount,
  form,
  source = TRADE_SOURCE.SCREENSHOT,
  estimateOtcSchedule,
  pendingTradeId
}) {
  if (!currentAccount?.id || state.accountId !== currentAccount.id) throw new Error('当前账户与待写入账本不一致');
  if (!/^\d{6}$/.test(String(form.code || ''))) throw new Error('请确认六位基金代码');
  if (form.screenshotHash && state.trades.some((trade) => trade.screenshotHash === form.screenshotHash)) {
    throw new Error('这张截图已录入过');
  }

  switch (form.screenshotType) {
    case SCREENSHOT_TYPE.EXCHANGE_TRADE: {
      if (![TRADE_ACTION.BUY, TRADE_ACTION.SELL].includes(form.action)) throw new Error('请确认买卖方向');
      const trade = {
        id: createTradeId(),
        accountId: currentAccount.id,
        mode: TRADE_MODE.EXCHANGE,
        code: String(form.code),
        name: form.name || '',
        action: form.action,
        price: Number(form.price),
        shares: Number(form.shares),
        fee: Number(form.fee || 0),
        amount: Number(form.price) * Number(form.shares),
        tradeAt: form.tradeAt,
        status: TRADE_STATUS.EXECUTED,
        source,
        screenshotHash: form.screenshotHash || null,
        createdAt: new Date().toISOString()
      };
      return applyExchangeTrade(state, trade);
    }
    case SCREENSHOT_TYPE.OTC_APPLICATION: {
      let trade = createOtcApplication({
        accountId: currentAccount.id,
        code: form.code,
        name: form.name,
        amount: form.amount,
        requestAt: form.requestAt,
        source,
        screenshotHash: form.screenshotHash
      });
      if (estimateOtcSchedule) trade = setOtcWaitingConfirm(trade, estimateOtcSchedule(form.requestAt, form.code));
      if (!Number.isFinite(Number(state.cash)) || state.cash == null || Number(state.cash) < trade.amount) {
        throw new Error('当前账户现金不足，请核对起始现金和申购金额');
      }
      return {
        ...state,
        cash: state.cash == null ? null : Number(state.cash) - trade.amount,
        trades: [...state.trades, trade]
      };
    }
    case SCREENSHOT_TYPE.OTC_CONFIRMATION: {
      const candidates = state.trades.filter(
        (trade) =>
          trade.accountId === currentAccount.id &&
          trade.code === form.code &&
          [TRADE_STATUS.SUBMITTED, TRADE_STATUS.WAITING_CONFIRM].includes(trade.status)
      );
      if (candidates.length === 0) throw new Error('没有对应的待确认申购');
      if (candidates.length > 1 && !pendingTradeId) throw new Error('有多笔待确认申购，请选择对应交易');
      const target = pendingTradeId ? candidates.find((trade) => trade.id === pendingTradeId) : candidates[0];
      if (!target) throw new Error('找不到所选待确认申购');
      return confirmOtcApplication(state, target.id, form);
    }
    case SCREENSHOT_TYPE.HOLDING_SNAPSHOT:
      throw new Error('这是持仓快照，请使用“补录当前持仓”');
    default:
      throw new Error('请先选择截图或交易类型');
  }
}
