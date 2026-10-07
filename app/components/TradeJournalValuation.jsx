'use client';

import { useEffect, useState } from 'react';
import { isPlainObject } from 'lodash';
import { fetchEtfQuote } from '@/app/lib/etfQuote';
import { calculateEtfHoldingValuation } from '@/app/lib/trading/valuation';

const money = (value) => `¥${value.toFixed(2)}`;
const beijingDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const part = (kind) => parts.find((item) => item.type === kind)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export default function TradeJournalValuation({ holdings }) {
  const entries = isPlainObject(holdings)
    ? Object.entries(holdings).filter(
        ([, holding]) => holding?.assetType === 'exchange_etf' && Number(holding.share) > 0
      )
    : [];
  const quoteKey = entries
    .map(([code]) => code)
    .sort()
    .join(',');
  const [quoteState, setQuoteState] = useState({ key: '', quotes: {} });

  useEffect(() => {
    if (!quoteKey) {
      setQuoteState({ key: '', quotes: {} });
      return;
    }
    let cancelled = false;
    const codes = quoteKey.split(',');
    Promise.allSettled(codes.map((code) => fetchEtfQuote(code))).then((results) => {
      if (cancelled) return;
      const quotes = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') quotes[codes[index]] = result.value;
      });
      setQuoteState({ key: quoteKey, quotes });
    });
    return () => {
      cancelled = true;
    };
  }, [quoteKey]);

  if (!entries.length) return <p className="muted">当前账户暂无新交易产生的场内 ETF 持仓。</p>;

  return (
    <section aria-label="交易录入持仓估值" style={{ display: 'grid', gap: 12 }}>
      {entries.map(([code, holding]) => {
        const quote = quoteState.key === quoteKey ? quoteState.quotes[code] : null;
        const available = quote?.status === 'available';
        const loading = quoteState.key !== quoteKey;
        const oldQuote = available && quote.quotedAt?.slice(0, 10) !== beijingDate();
        const valuation = calculateEtfHoldingValuation(holding, quote);
        const shares = Number(holding.share);
        const cost = holding.cost == null ? NaN : Number(holding.cost);
        return (
          <article key={code} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            <strong>{code}</strong>
            <p>持有份额：{shares.toFixed(2)} 份</p>
            <p>每份成本：{Number.isFinite(cost) && cost >= 0 ? money(cost) : '未录入'}</p>
            {loading ? (
              <p role="status">正在获取场内报价…</p>
            ) : available ? (
              <>
                <p>
                  最近场内报价：{money(quote.marketPrice)}
                  {oldQuote ? '（非当日行情）' : ''}
                </p>
                <p>报价时间：{quote.quotedAt?.replace('T', ' ').slice(0, 19)}（北京时间）</p>
                <p>市值：{money(valuation.marketValue)}</p>
                <p>浮动盈亏：{valuation.unrealizedPnl == null ? '成本未录入' : money(valuation.unrealizedPnl)}</p>
              </>
            ) : (
              <p role="status">行情不可用；市值和浮动盈亏暂不计算。</p>
            )}
          </article>
        );
      })}
    </section>
  );
}
