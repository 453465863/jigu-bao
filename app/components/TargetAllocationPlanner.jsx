'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { isArray, isNumber, isPlainObject } from 'lodash';
import { storageStore } from '../stores';
import { calculateTradeJournalAssets } from '../lib/trading/tradeModel';

const STORAGE_KEY = 'targetAllocationPlanner';
const CATEGORIES = ['宽基', '海外宽基', '债券', '黄金', '科技AI', '行业主题', '其他'];

const autoCategory = (name = '') => {
  if (/纳斯达克|日本|QDII|513300/i.test(name)) return '海外宽基';
  if (/黄金|上海金/.test(name)) return '黄金';
  if (/债|短债|稳信|恒睿/.test(name)) return '债券';
  if (/人工智能|创新成长|科创|创业|软件|机器人|通信|算力|芯片|PCB/i.test(name)) return '科技AI';
  if (/沪深300|中证500|中证1000|上证50|全指|宽基/.test(name)) return '宽基';
  if (/军工|有色|化工|环保|证券|医药|新能源|消费/.test(name)) return '行业主题';
  return '其他';
};

const money = (value) =>
  Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normalizeMoneyInput = (value) => value.replace(/^0+(?=\d)/, '');

export default function TargetAllocationPlanner({ rows = [], tradeJournal = null }) {
  const [open, setOpen] = useState(true);
  const [cash, setCash] = useState('');
  const [budget, setBudget] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetSaveStatus, setBudgetSaveStatus] = useState('');
  const [targets, setTargets] = useState(() => Object.fromEntries(CATEGORIES.map((item) => [item, 0])));
  const [categoryByCode, setCategoryByCode] = useState({});
  const [preferredByCategory, setPreferredByCategory] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = storageStore.getItem(STORAGE_KEY, {});
    if (isPlainObject(saved)) {
      if (isNumber(saved.cash)) setCash(saved.cash === 0 ? '' : String(saved.cash));
      if (isNumber(saved.budget)) setBudget(saved.budget === 0 ? '' : String(saved.budget));
      if (isPlainObject(saved.targets)) setTargets((prev) => ({ ...prev, ...saved.targets }));
      if (isPlainObject(saved.categoryByCode)) setCategoryByCode(saved.categoryByCode);
      if (isPlainObject(saved.preferredByCategory)) setPreferredByCategory(saved.preferredByCategory);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storageStore.setItem(STORAGE_KEY, {
      cash: Number(cash) || 0,
      budget: Number(budget) || 0,
      targets,
      categoryByCode,
      preferredByCategory
    });
  }, [cash, budget, targets, categoryByCode, preferredByCategory, loaded]);

  const journalAssets = tradeJournal ? calculateTradeJournalAssets(tradeJournal) : null;
  const hasBudget = Number(budget) > 0;
  const saveBudget = () => {
    const amount = Number(budget);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBudgetSaveStatus('请输入大于 0 的计划金额');
      return;
    }
    storageStore.setItem(
      STORAGE_KEY,
      JSON.stringify({
        cash: Number(cash) || 0,
        budget: amount,
        targets,
        categoryByCode,
        preferredByCategory
      })
    );
    setEditingBudget(false);
    setBudgetSaveStatus('计划已保存到当前账户');
  };
  const effectiveCash = journalAssets?.cash == null ? Number(cash) || 0 : journalAssets.cash;
  const normalizedRows = useMemo(
    () => {
      const oldRows = (isArray(rows) ? rows : [])
        .filter((row) => row?.code)
        .map((row) => ({
          code: row.code,
          name: row.fundName || row.code,
          amount: isNumber(row.holdingAmountValue) ? Math.max(0, row.holdingAmountValue) : 0,
          category: categoryByCode[row.code] || autoCategory(row.fundName)
        }));
      const journalHoldings = isPlainObject(tradeJournal?.holdings) ? tradeJournal.holdings : {};
      const journalRows = Object.entries(journalHoldings).flatMap(([code, holding]) => {
        const share = Number(holding?.share);
        const cost = Number(holding?.cost);
        if (!Number.isFinite(share) || !Number.isFinite(cost) || share <= 0 || cost < 0) return [];
        if (oldRows.some((row) => row.code === code && row.amount > 0)) return [];
        const name = [...(isArray(tradeJournal?.trades) ? tradeJournal.trades : [])]
          .reverse()
          .find((trade) => trade.code === code && trade.name)?.name || code;
        return [{ code, name, amount: share * cost, category: categoryByCode[code] || autoCategory(`${name} ${code}`) }];
      });
      return [...oldRows.filter((row) => !journalRows.some((journalRow) => journalRow.code === row.code)), ...journalRows];
    },
    [rows, categoryByCode, tradeJournal]
  );

  const summary = useMemo(() => {
    const current = Object.fromEntries(CATEGORIES.map((item) => [item, 0]));
    normalizedRows.forEach((row) => {
      current[row.category] = (current[row.category] || 0) + row.amount;
    });
    const fundTotal = Object.values(current).reduce((sum, item) => sum + item, 0);
    const total = fundTotal + effectiveCash + (journalAssets?.pendingAmount || 0);
    const targetTotal = Object.values(targets).reduce((sum, item) => sum + (Number(item) || 0), 0);
    const gaps = {};
    CATEGORIES.forEach((category) => {
      gaps[category] = Math.max(0, total * ((Number(targets[category]) || 0) / 100) - current[category]);
    });
    const positiveGapTotal = Object.values(gaps).reduce((sum, item) => sum + item, 0);
    const spendable = Math.max(0, Math.min(Number(budget) || 0, effectiveCash));
    const suggestions = CATEGORIES.map((category) => {
      const gap = gaps[category];
      const targetPercent = Number(targets[category]) || 0;
      const targetAmount = total * (targetPercent / 100);
      const completionPercent = targetAmount > 0 ? Math.min(100, (current[category] / targetAmount) * 100) : 0;
      const suggested = positiveGapTotal > 0 ? Math.min(gap, (spendable * gap) / positiveGapTotal) : 0;
      const candidates = normalizedRows.filter((row) => row.category === category);
      const preferredCode = preferredByCategory[category] || candidates[0]?.code || '';
      const preferred = candidates.find((row) => row.code === preferredCode) || candidates[0];
      return {
        category,
        current: current[category],
        targetPercent,
        targetAmount,
        completionPercent,
        gap,
        suggested,
        candidates,
        preferred
      };
    });
    return { current, fundTotal, total, targetTotal, spendable, suggestions };
  }, [normalizedRows, effectiveCash, journalAssets?.pendingAmount, budget, targets, preferredByCategory]);

  return (
    <section className="glass card" style={{ marginBottom: 12, padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18 }}
        >
          <span>目标配置与买入计划</span>
          <span>{open ? '收起' : '展开'}</span>
        </button>
        <Link href="/trade-entry/" className="button secondary" style={{ whiteSpace: 'nowrap' }}>
          交易录入
        </Link>
      </div>
      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <div><span className="muted">持仓成本暂估</span><strong style={{ display: 'block' }}>¥{money(summary.fundTotal)}</strong></div>
            {journalAssets?.pendingAmount > 0 && <div><span className="muted">待确认申购</span><strong style={{ display: 'block' }}>¥{money(journalAssets.pendingAmount)}</strong></div>}
            <div><span className="muted">计划试算总额</span><strong style={{ display: 'block' }}>¥{money(summary.total)}</strong></div>
          </div>

          {summary.targetTotal !== 100 && (
            <div style={{ marginTop: 10, color: 'var(--warning, #d97706)' }}>目标比例当前合计 {summary.targetTotal.toFixed(1)}%，请调整到100%。</div>
          )}

          <div className="target-allocation-desktop-table" style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead><tr><th>资产类别</th><th>当前金额</th><th>实际占比</th><th>目标占比</th><th>目标金额</th><th>待投入金额</th><th>首选基金</th><th>本次建议</th></tr></thead>
              <tbody>
                {summary.suggestions.map((item) => (
                  <tr key={item.category}>
                    <td>{item.category}</td>
                    <td>¥{money(item.current)}</td>
                    <td>{summary.total > 0 ? ((item.current / summary.total) * 100).toFixed(1) : '0.0'}%</td>
                    <td><input className="input text-[16PX]" style={{ width: 82 }} type="number" min="0" max="100" value={targets[item.category]} onChange={(e) => setTargets((prev) => ({ ...prev, [item.category]: Number(e.target.value) }))} onWheel={(event) => event.currentTarget.blur()} /></td>
                    <td>¥{money(item.targetAmount)}</td>
                    <td>¥{money(item.gap)}</td>
                    <td>
                      <select className="input text-[16PX]" value={item.preferred?.code || ''} onChange={(e) => setPreferredByCategory((prev) => ({ ...prev, [item.category]: e.target.value }))}>
                        <option value="">未指定</option>
                        {item.candidates.map((fund) => <option key={fund.code} value={fund.code}>{fund.name}</option>)}
                      </select>
                    </td>
                    <td style={{ fontWeight: 700, color: item.suggested > 0 ? 'var(--primary)' : undefined }}>¥{money(item.suggested)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="target-allocation-mobile-list" aria-label="手机目标配置摘要">
            <div className="target-allocation-mobile-header" aria-hidden="true">
              <span>细分类</span>
              <span>已完成</span>
              <span>待投入</span>
            </div>
            {summary.suggestions.map((item) => (
              <div key={item.category} className="target-allocation-mobile-row">
                <div>
                  <strong>{item.category}</strong>
                  <small>目标 {item.targetPercent.toFixed(1)}%</small>
                </div>
                <strong>{item.completionPercent.toFixed(1)}%</strong>
                <strong>¥{money(item.gap)}</strong>
              </div>
            ))}
          </div>

          {hasBudget && !editingBudget ? (
            <div style={{ display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
              <div>
                <span className="muted">当前计划投入</span>
                <strong style={{ display: 'block' }}>¥{money(budget)}</strong>
              </div>
              <button type="button" className="button secondary" onClick={() => setEditingBudget(true)}>
                修改计划
              </button>
            </div>
          ) : (
            <label style={{ display: 'block', maxWidth: 260, marginTop: 14 }}>
              <span className="muted">设置计划投入（元）</span>
              <input
                className="input text-[16PX]"
                type="number"
                min="0"
                value={budget}
                onChange={(e) => {
                  setBudget(normalizeMoneyInput(e.target.value));
                  setBudgetSaveStatus('');
                }}
                onWheel={(event) => event.currentTarget.blur()}
              />
              <button type="button" className="button secondary" style={{ marginTop: 8 }} onClick={saveBudget}>
                保存计划
              </button>
              <small className="muted" style={{ display: 'block', marginTop: 6 }}>
                {budgetSaveStatus || '只需设置一次；需要调整时再点“修改计划”。'}
              </small>
            </label>
          )}

          <details style={{ marginTop: 12 }}>
            <summary>检查并调整基金分类</summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {normalizedRows.map((fund) => (
                <label key={fund.code} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 120px', gap: 8 }}>
                  <span>{fund.name}</span>
                  <select className="input text-[16PX]" value={fund.category} onChange={(e) => setCategoryByCode((prev) => ({ ...prev, [fund.code]: e.target.value }))}>
                    {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </details>
          <p className="muted" style={{ marginTop: 10 }}>当前金额包含本机交易持仓，按成本暂估；同代码已有旧持仓时不重复相加。账本现金自动用于试算，待确认申购计入总额。建议金额只按目标缺口分配，总建议不超过本次预算和可用现金。</p>
        </div>
      )}
    </section>
  );
}
