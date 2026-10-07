'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { isString } from 'lodash';
import ScreenshotConfirm from '@/app/components/ScreenshotConfirm';
import TradeJournalValuation from '@/app/components/TradeJournalValuation';
import { getAccountsFromSettings } from '@/app/lib/accounts';
import {
  SCREENSHOT_TYPE,
  TRADE_SOURCE,
  calculatePendingOtcAmount,
  calculateTradeJournalAssets
} from '@/app/lib/trading/tradeModel';
import { commitTradeDraft } from '@/app/lib/trading/commitTrade';
import { estimateOtcSchedule } from '@/app/lib/trading/estimateOtcSchedule';
import { fetchFundConfirmDays } from '@/app/api/fund';
import { loadHolidaysForYears } from '@/app/lib/tradingCalendar';
import { useStorageStore } from '@/app/stores';

const emptyDraft = () => ({
  screenshotType: SCREENSHOT_TYPE.UNKNOWN,
  code: '',
  name: '',
  action: '',
  price: '',
  shares: '',
  amount: '',
  fee: '',
  tradeAt: '',
  requestAt: '',
  nav: '',
  actualNavDate: '',
  actualConfirmDate: ''
});

export default function TradeEntryPage() {
  const activeAccountId = useStorageStore((state) => state.activeAccountId);
  const customSettings = useStorageStore((state) => state.customSettings);
  const accountsReady = useStorageStore((state) => state.accountsReady);
  const [draft, setDraft] = useState(null);
  const [draftAccountId, setDraftAccountId] = useState(null);
  const [source, setSource] = useState(TRADE_SOURCE.MANUAL);
  const [imageUrl, setImageUrl] = useState('');
  const [previewState, setPreviewState] = useState(null);
  const [startingCash, setStartingCash] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const commitLockRef = useRef(false);

  useEffect(() => {
    const store = useStorageStore.getState();
    store.initCustomSettings();
    store.initAccountLedgers();
    store.initActiveAccount();
  }, []);

  useEffect(() => {
    setDraft(null);
    setDraftAccountId(null);
    setPreviewState(null);
    setStartingCash('');
    setError('');
  }, [activeAccountId]);

  useEffect(() => {
    if (!accountsReady) return;
    const saved = useStorageStore.getState().getItem('tradeJournal', null);
    if (saved?.accountId === activeAccountId) {
      setPreviewState(saved);
      setStartingCash(saved.cash == null ? '' : String(saved.cash));
    }
  }, [accountsReady, activeAccountId]);

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl]
  );

  const currentAccount = useMemo(
    () => getAccountsFromSettings(customSettings).find((account) => account.id === activeAccountId),
    [customSettings, activeAccountId]
  );
  const scopedPreviewState = previewState?.accountId === activeAccountId ? previewState : null;
  const openManual = () => {
    setSource(TRADE_SOURCE.MANUAL);
    setDraft(emptyDraft());
    setDraftAccountId(activeAccountId);
    setError('');
  };
  const prepareScreenshot = useCallback(
    async (file) => {
      if (!file || !isString(file.type) || !file.type.startsWith('image/')) {
        setError('请选择或粘贴图片文件');
        return;
      }
      try {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        const screenshotHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
          ''
        );
        setImageUrl(URL.createObjectURL(file));
        setSource(TRADE_SOURCE.SCREENSHOT);
        setDraft({ ...emptyDraft(), screenshotHash });
        setDraftAccountId(activeAccountId);
        setError('');
      } catch {
        setError('无法读取截图，请重新选择');
      }
    },
    [activeAccountId]
  );
  useEffect(() => {
    if (draft) return;
    const onPaste = (event) => {
      const imageItem = Array.from(event.clipboardData?.items || []).find(
        (item) => isString(item.type) && item.type.startsWith('image/')
      );
      if (!imageItem) return;
      event.preventDefault();
      prepareScreenshot(imageItem.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [draft, prepareScreenshot]);
  const upload = (event) => {
    const file = event.target.files?.[0];
    if (file) prepareScreenshot(file);
    event.target.value = '';
  };
  const pasteFromClipboard = async () => {
    if (!navigator.clipboard?.read) {
      setError('此浏览器不支持按钮读取剪贴板，请复制图片后在本页按 Ctrl+V');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          await prepareScreenshot(await item.getType(imageType));
          return;
        }
      }
      setError('剪贴板里没有图片，请先复制交易截图');
    } catch {
      setError('无法读取剪贴板图片，请允许访问剪贴板，或在本页按 Ctrl+V');
    }
  };
  const confirm = async (form, pendingTradeId) => {
    if (commitLockRef.current) return;
    commitLockRef.current = true;
    setBusy(true);
    try {
      const store = useStorageStore.getState();
      if (draftAccountId !== currentAccount?.id) throw new Error('账户已切换，请重新录入');
      if (
        store.activeAccountId !== currentAccount?.id ||
        store.getLegacyItem('activeAccountId', currentAccount?.id) !== currentAccount?.id
      ) {
        throw new Error('当前账户已变化，请返回重新选择');
      }
      const saved = store.getItem('tradeJournal', null);
      const existing = scopedPreviewState ||
        (saved?.accountId === currentAccount.id ? saved : null) || {
          accountId: currentAccount.id,
          cash: null,
          trades: [],
          holdings: {}
        };
      const base =
        existing.cash == null ? { ...existing, cash: startingCash === '' ? null : Number(startingCash) } : existing;
      if (base.cash == null) throw new Error('请先填写当前账户的起始现金，才能核算交易后的现金');
      let estimateSchedule;
      if (form.screenshotType === SCREENSHOT_TYPE.OTC_APPLICATION) {
        const year = Number(String(form.requestAt || '').slice(0, 4));
        if (Number.isInteger(year) && year >= 2000) await loadHolidaysForYears([year, year + 1]);
        const confirmDays = await Promise.race([
          fetchFundConfirmDays(form.code),
          new Promise((resolve) => setTimeout(() => resolve(null), 5000))
        ]);
        estimateSchedule = (requestAt) => estimateOtcSchedule(requestAt, confirmDays);
      }
      if (store.getLegacyItem('activeAccountId', currentAccount.id) !== currentAccount.id) {
        throw new Error('账户已切换，本次未写入；请返回重新录入');
      }
      const next = commitTradeDraft({
        state: base,
        currentAccount,
        form,
        source,
        pendingTradeId,
        estimateOtcSchedule: estimateSchedule
      });
      store.setItem('tradeJournal', JSON.stringify(next));
      setPreviewState(next);
      setDraft(null);
      setDraftAccountId(null);
      setError('');
    } catch (caught) {
      setError(caught.message || '检查失败');
    } finally {
      setBusy(false);
      commitLockRef.current = false;
    }
  };

  if (!accountsReady || !currentAccount) return <main style={{ padding: 24 }}>正在读取当前账户…</main>;
  if (draft && draftAccountId === activeAccountId)
    return (
      <>
        <ScreenshotConfirm
          key={`${activeAccountId}-${source}-${imageUrl}`}
          currentAccount={currentAccount}
          imageUrl={source === TRADE_SOURCE.SCREENSHOT ? imageUrl : ''}
          draft={draft}
          onBack={() => setDraft(null)}
          onConfirm={confirm}
          busy={busy}
          startingCash={startingCash}
          onStartingCashChange={setStartingCash}
          requiresStartingCash={!scopedPreviewState || scopedPreviewState.cash == null}
          pendingTrades={
            scopedPreviewState?.trades.filter((trade) => ['submitted', 'waiting_confirm'].includes(trade.status)) || []
          }
        />
        {error && (
          <div
            role="alert"
            style={{
              position: 'fixed',
              bottom: 10,
              left: 10,
              right: 10,
              background: 'var(--card)',
              color: 'var(--danger)',
              padding: 12,
              zIndex: 100
            }}
          >
            {error}
          </div>
        )}
      </>
    );

  return (
    <main
      style={{
        minHeight: '100dvh',
        overflowY: 'auto',
        padding: '24px 16px 48px',
        background: 'var(--background)',
        color: 'var(--foreground)'
      }}
    >
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <Link href="/" className="button secondary">
          ← 返回基估宝
        </Link>
        <h1 style={{ fontSize: 26, margin: '24px 0 12px' }}>移动交易录入</h1>
        <p style={{ marginBottom: 16 }}>
          当前账户：<strong>{currentAccount.name}</strong>。录入账户由头像切换决定。
        </p>
        <p className="muted" style={{ marginBottom: 20 }}>
          截图自动识别尚未接入，上传后请对照原图核对并填写。保存后会更新当前账户的资产；登录并配置云端后，手机和电脑可同步查看同一份记录。
        </p>
        <label className="button" style={{ display: 'block', textAlign: 'center', padding: 16, marginBottom: 12 }}>
          ＋ 上传交易截图（人工填写草稿）
          <input type="file" accept="image/*" onChange={upload} style={{ display: 'none' }} />
        </label>
        <button
          type="button"
          className="button secondary"
          onClick={pasteFromClipboard}
          style={{ width: '100%', padding: 16, marginBottom: 8 }}
        >
          粘贴剪贴板图片
        </button>
        <p className="muted" style={{ marginBottom: 12, textAlign: 'center' }}>
          也可复制截图后在本页按 Ctrl+V
        </p>
        <button className="button secondary" onClick={openManual} style={{ width: '100%', padding: 16 }}>
          手动录入
        </button>
        {scopedPreviewState && (
          <section style={{ marginTop: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 14 }}>
            <h2 style={{ fontSize: 19, marginBottom: 12 }}>交易记录（已保存）</h2>
            <p>账户：{currentAccount.name}</p>
            <p>
              账户总资产（按持仓成本暂估）：
              {calculateTradeJournalAssets(scopedPreviewState).totalAtCost == null
                ? '未设定'
                : `¥${calculateTradeJournalAssets(scopedPreviewState).totalAtCost.toFixed(2)}`}
            </p>
            <p>现金：{scopedPreviewState.cash == null ? '未设定' : `¥${scopedPreviewState.cash.toFixed(2)}`}</p>
            <p>待确认申购：¥{calculatePendingOtcAmount(scopedPreviewState.trades).toFixed(2)}</p>
            <p>交易笔数：{scopedPreviewState.trades.length}</p>
            {scopedPreviewState.trades.map((trade) => (
              <p key={trade.id}>
                {trade.code} · {trade.action} · {trade.status} · {trade.shares ?? '份额待确认'} 份
                {trade.estimatedNavDate && ` · 预计净值日 ${trade.estimatedNavDate}`}
                {trade.estimatedConfirmDate && ` · 预计确认日 ${trade.estimatedConfirmDate}`}
                {trade.actualConfirmDate && ` · 实际确认日 ${trade.actualConfirmDate}`}
              </p>
            ))}
            <h3 style={{ fontSize: 16, marginTop: 14 }}>交易录入持仓</h3>
            {Object.entries(scopedPreviewState.holdings || {}).map(([code, holding]) => (
              <p key={code}>
                {code} · {Number(holding.share || 0).toFixed(2)} 份 · 成本价 ¥{Number(holding.cost || 0).toFixed(4)}
              </p>
            ))}
            <h3 style={{ fontSize: 16, marginTop: 18 }}>场内 ETF 市值与浮动盈亏</h3>
            <TradeJournalValuation holdings={scopedPreviewState.holdings} />
          </section>
        )}
        {error && (
          <p role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
