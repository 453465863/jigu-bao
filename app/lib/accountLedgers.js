import { isArray, isEqual, isPlainObject } from 'lodash';
import { LEGACY_ACCOUNT_ID } from './accounts';

export const createEmptyAccountLedger = () => ({
  funds: [],
  fundCodes: [],
  groups: [{ id: 'fav', name: '自选', isPreset: true, codes: [] }],
  tags: [],
  favorites: [],
  collapsedCodes: [],
  collapsedTrends: [],
  collapsedValuationTrends: [],
  collapsedEarnings: [],
  currentTab: 'all',
  holdings: {},
  groupHoldings: {},
  pendingTrades: [],
  transactions: {},
  // Kept inside the account ledger so a signed-in private cloud can sync the
  // same transaction journal between the user's phone and computer.
  tradeJournal: { cash: null, trades: [], holdings: {} },
  analysisTasks: [],
  analysisReports: [],
  dcaPlans: {},
  fundDailyEarnings: {},
  fundDividends: {},
  targetAllocationPlanner: { cash: 0, budget: 0, targets: {}, categoryByCode: {}, preferredByCategory: {} }
});

export const normalizeAccountLedgers = (value) => {
  if (!isPlainObject(value)) return {};
  const result = {};
  for (const [accountId, ledger] of Object.entries(value)) {
    if (!accountId || accountId === LEGACY_ACCOUNT_ID || !isPlainObject(ledger)) continue;
    const empty = createEmptyAccountLedger();
    result[accountId] = {
      ...ledger,
      funds: isArray(ledger.funds) ? ledger.funds : empty.funds,
      fundCodes: isArray(ledger.fundCodes) ? [...new Set(ledger.fundCodes)] : empty.fundCodes,
      groups: isArray(ledger.groups) ? ledger.groups : empty.groups,
      tags: isArray(ledger.tags) ? ledger.tags : empty.tags,
      favorites: isArray(ledger.favorites) ? ledger.favorites : empty.favorites,
      collapsedCodes: isArray(ledger.collapsedCodes) ? ledger.collapsedCodes : empty.collapsedCodes,
      collapsedTrends: isArray(ledger.collapsedTrends) ? ledger.collapsedTrends : empty.collapsedTrends,
      collapsedValuationTrends: isArray(ledger.collapsedValuationTrends)
        ? ledger.collapsedValuationTrends
        : empty.collapsedValuationTrends,
      collapsedEarnings: isArray(ledger.collapsedEarnings) ? ledger.collapsedEarnings : empty.collapsedEarnings,
      currentTab: ledger.currentTab || empty.currentTab,
      holdings: isPlainObject(ledger.holdings) ? ledger.holdings : empty.holdings,
      groupHoldings: isPlainObject(ledger.groupHoldings) ? ledger.groupHoldings : empty.groupHoldings,
      pendingTrades: isArray(ledger.pendingTrades) ? ledger.pendingTrades : empty.pendingTrades,
      transactions: isPlainObject(ledger.transactions) ? ledger.transactions : empty.transactions,
      tradeJournal: isPlainObject(ledger.tradeJournal) ? ledger.tradeJournal : empty.tradeJournal,
      analysisTasks: isArray(ledger.analysisTasks) ? ledger.analysisTasks : empty.analysisTasks,
      analysisReports: isArray(ledger.analysisReports) ? ledger.analysisReports : empty.analysisReports,
      dcaPlans: isPlainObject(ledger.dcaPlans) ? ledger.dcaPlans : empty.dcaPlans,
      fundDailyEarnings: isPlainObject(ledger.fundDailyEarnings) ? ledger.fundDailyEarnings : empty.fundDailyEarnings,
      fundDividends: isPlainObject(ledger.fundDividends) ? ledger.fundDividends : empty.fundDividends,
      targetAllocationPlanner: isPlainObject(ledger.targetAllocationPlanner)
        ? ledger.targetAllocationPlanner
        : empty.targetAllocationPlanner
    };
  }
  return result;
};

export const isEmptyAccountLedger = (ledger) =>
  isEqual(normalizeAccountLedgers({ check: ledger }).check, createEmptyAccountLedger());
