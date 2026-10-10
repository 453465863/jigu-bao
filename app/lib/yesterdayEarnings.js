import { isArray, isObject, isString } from 'lodash';

const isDate = (value) => isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
const finiteNumber = (value) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** 根据当前持仓与已记录交易，回推收益日开始前的有效份额。 */
export function getShareBeforeDate(holding, transactions, profitDate, scopeIds = [null]) {
  const currentShare = finiteNumber(holding?.share);
  if (currentShare == null || currentShare < 0 || !isDate(profitDate)) return null;
  const allowedScopes = new Set(scopeIds);
  let share = currentShare;
  for (const tx of isArray(transactions) ? transactions : []) {
    if (!isObject(tx) || tx.isHistoryOnly || !isDate(tx.date) || tx.date < profitDate) continue;
    if (!allowedScopes.has(tx.groupId || null)) continue;
    const tradedShare = finiteNumber(tx.share);
    if (tradedShare == null || tradedShare <= 0) continue;
    if (tx.type === 'buy') share -= tradedShare;
    if (tx.type === 'sell') share += tradedShare;
  }
  if (isDate(holding.firstPurchaseDate) && holding.firstPurchaseDate >= profitDate) return 0;
  return Math.max(0, share);
}

/** 只采用目标日期的正式净值或已保存的每日收益；旧日期与盘中估值不能补位。 */
export function calculateYesterdayEarnings({
  fund,
  holding,
  dailyList,
  dividends,
  transactions,
  profitDate,
  scopeIds
}) {
  if (holding?.assetType === 'exchange_etf') return { status: 'excluded', reason: '场内 ETF 暂未纳入' };
  const share = getShareBeforeDate(holding, transactions, profitDate, scopeIds);
  if (share == null || share <= 0) return { status: 'noHolding', date: profitDate };
  const dividendPerShare = (isArray(dividends) ? dividends : []).reduce((total, item) => {
    const dividend = finiteNumber(item?.dividend);
    return item?.date === profitDate && dividend != null ? total + dividend : total;
  }, 0);
  const dividendEarnings = share * dividendPerShare;

  const recorded = isArray(dailyList) ? dailyList.find((item) => item?.date === profitDate) : null;
  const recordedEarnings = finiteNumber(recorded?.earnings);
  if (recordedEarnings != null) {
    const cost = finiteNumber(recorded.baseCostAmount);
    const rate = finiteNumber(recorded.rate);
    const earnings = recordedEarnings + dividendEarnings;
    return {
      status: 'ready',
      date: profitDate,
      earnings,
      rate: cost > 0 ? (earnings / cost) * 100 : dividendPerShare === 0 ? rate : null,
      source: 'recorded'
    };
  }

  const history = isArray(fund?.navHistory) ? fund.navHistory : [];
  const index = history.findIndex((row) => row?.date === profitDate);
  let currentNav = index > 0 ? finiteNumber(history[index]?.nav) : null;
  let previousNav = index > 0 ? finiteNumber(history[index - 1]?.nav) : null;
  if (currentNav == null && fund?.jzrq === profitDate) {
    currentNav = finiteNumber(fund.dwjz);
    previousNav = finiteNumber(fund.lastNav);
  }
  if (currentNav == null || previousNav == null || currentNav <= 0 || previousNav <= 0) {
    return { status: 'waiting', date: profitDate };
  }
  return {
    status: 'ready',
    date: profitDate,
    earnings: share * (currentNav - previousNav + dividendPerShare),
    rate: ((currentNav - previousNav + dividendPerShare) / previousNav) * 100,
    source: 'nav'
  };
}
