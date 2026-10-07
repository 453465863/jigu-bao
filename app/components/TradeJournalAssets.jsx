'use client';

import Link from 'next/link';
import { isArray, isPlainObject } from 'lodash';
import { LEGACY_ACCOUNT_ID } from '@/app/lib/accounts';
import { calculateTradeJournalAssets, TRADE_ACTION, TRADE_MODE, TRADE_STATUS } from '@/app/lib/trading/tradeModel';
import { useStorageStore } from '@/app/stores';

const money = (amount) => `¥${Number(amount).toFixed(2)}`;

export default function TradeJournalAssets() {
  const activeAccountId = useStorageStore((state) => state.activeAccountId);
  const accountLedgers = useStorageStore((state) => state.accountLedgers);
  const accountsReady = useStorageStore((state) => state.accountsReady);
  if (!accountsReady) return null;

  const journal =
    activeAccountId === LEGACY_ACCOUNT_ID
      ? useStorageStore.getState().getItem('tradeJournal', null)
      : accountLedgers[activeAccountId]?.tradeJournal;
  if (journal?.accountId !== activeAccountId || !isArray(journal.trades) || journal.trades.length === 0) return null;

  const assets = calculateTradeJournalAssets(journal);
  const pending = journal.trades.filter(
    (trade) =>
      trade.mode === TRADE_MODE.OTC &&
      trade.action === TRADE_ACTION.SUBSCRIBE &&
      [TRADE_STATUS.SUBMITTED, TRADE_STATUS.WAITING_CONFIRM].includes(trade.status)
  );
  const holdings = isPlainObject(journal.holdings)
    ? Object.entries(journal.holdings).filter(([, holding]) => Number(holding?.share) > 0)
    : [];
  return (
    <section className="glass card" aria-label="本机交易账户资产" style={{ marginBottom: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <strong style={{ fontSize: 18 }}>我的资产 · 本机交易</strong>
        <Link href="/trade-entry/" className="button secondary">
          查看交易
        </Link>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        仅当前账户 · 持仓按成本暂估，非实时市值
      </p>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 14 }}
      >
        <div>
          <span className="muted">账户总资产</span>
          <strong style={{ display: 'block' }}>
            {assets.totalAtCost == null ? '现金未设定' : money(assets.totalAtCost)}
          </strong>
        </div>
        <div>
          <span className="muted">可用现金</span>
          <strong style={{ display: 'block' }}>{assets.cash == null ? '未设定' : money(assets.cash)}</strong>
        </div>
        <div>
          <span className="muted">待确认申购</span>
          <strong style={{ display: 'block' }}>{money(assets.pendingAmount)}</strong>
        </div>
        <div>
          <span className="muted">已确认持仓成本</span>
          <strong style={{ display: 'block' }}>{money(assets.holdingCost)}</strong>
        </div>
      </div>
      {pending.map((trade) => (
        <div key={trade.id} style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
          <strong>
            {trade.name || trade.code} · {money(trade.amount)}
          </strong>
          <span style={{ marginLeft: 8, color: 'var(--warning)' }}>申购待确认</span>
          {trade.estimatedConfirmDate && <p className="muted">预计确认日：{trade.estimatedConfirmDate}</p>}
        </div>
      ))}
      {holdings.map(([code, holding]) => {
        const latestTrade = [...journal.trades].reverse().find((trade) => trade.code === code && trade.name);
        const share = Number(holding.share);
        const cost = Number(holding.cost);
        return (
          <div key={code} style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
            <strong>
              {latestTrade?.name || code} · {code}
            </strong>
            <span style={{ marginLeft: 8, color: 'var(--primary)' }}>本机交易持仓</span>
            <p>
              持有 {share.toFixed(2)} 份 · 每份成本 {money(cost)} · 持仓成本 {money(share * cost)}
            </p>
          </div>
        );
      })}
      <p className="muted" style={{ marginTop: 10 }}>
        本机交易持仓与待确认申购只从当前账户账本读取；旧持仓另行显示，避免重复计入或触发云同步。
      </p>
    </section>
  );
}
