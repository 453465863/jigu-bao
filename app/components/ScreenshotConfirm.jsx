'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { isObject } from 'lodash';
import { searchTradeFunds } from '@/app/lib/trading/searchTradeFunds';
import { parseTradeDateInput } from '@/app/lib/trading/parseTradeDateInput';
import { SCREENSHOT_TYPE, TRADE_ACTION } from '@/app/lib/trading/tradeModel';

const fieldStyle = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: 12,
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--card)',
  color: 'var(--foreground)',
  fontSize: '16PX'
};
const sectionStyle = { padding: 16, border: '1px solid var(--border)', borderRadius: 14, marginBottom: 16 };

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  required = false,
  needsReview = false,
  min,
  placeholder,
  inputMode
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      {label}
      {required ? ' *' : ''}
      <input
        type={type}
        value={value ?? ''}
        min={min}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onWheel={type === 'number' ? (event) => event.currentTarget.blur() : undefined}
        style={fieldStyle}
      />
      {needsReview && (
        <small style={{ display: 'block', marginTop: 5, color: 'var(--danger)' }}>截图未能确认，请手动核对</small>
      )}
    </label>
  );
}

export default function ScreenshotConfirm({
  currentAccount,
  imageUrl,
  draft,
  onBack,
  onConfirm,
  pendingTrades = [],
  busy = false,
  startingCash = '',
  onStartingCashChange,
  requiresStartingCash = false
}) {
  const [form, setForm] = useState(draft);
  const [pendingTradeId, setPendingTradeId] = useState('');
  const [error, setError] = useState('');
  const [platformAcknowledged, setPlatformAcknowledged] = useState(false);
  const [fundMatches, setFundMatches] = useState([]);
  const [fundSearchStatus, setFundSearchStatus] = useState('');
  const update = (key, value) => {
    if (key === 'code') setPendingTradeId('');
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === 'code' ? { name: '' } : {}),
      ...(key === 'name' ? { code: '' } : {})
    }));
  };
  useEffect(() => {
    if (/^\d{6}$/.test(form.code) && form.name) {
      setFundMatches([]);
      setFundSearchStatus('');
      return;
    }
    const query = String(form.name || form.code || '').trim();
    if (query.length < 2) {
      setFundMatches([]);
      setFundSearchStatus('');
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setFundSearchStatus('正在搜索基金…');
      try {
        const results = await searchTradeFunds(query, form.screenshotType === SCREENSHOT_TYPE.EXCHANGE_TRADE);
        if (!active) return;
        const exactCode = /^\d{6}$/.test(form.code) ? results.find((item) => item.code === form.code) : null;
        if (exactCode) {
          setForm((previous) =>
            previous.code === exactCode.code && !previous.name ? { ...previous, name: exactCode.name } : previous
          );
          setFundMatches([]);
          setFundSearchStatus('');
          return;
        }
        setFundMatches(results);
        setFundSearchStatus(results.length ? '' : '没有找到匹配基金，请核对名称或代码');
      } catch {
        if (active) {
          setFundMatches([]);
          setFundSearchStatus('基金搜索暂不可用，可手动填写六位代码');
        }
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.code, form.name, form.screenshotType]);
  const hasRecognition = isObject(draft.confidence) && Object.keys(draft.confidence).length > 0;
  const needsReview = (key) =>
    hasRecognition &&
    (form[key] == null || (key === 'screenshotType' && form[key] === SCREENSHOT_TYPE.UNKNOWN)) &&
    draft.confidence[key] === 0;
  const platformConflict = Boolean(
    form.platform &&
    currentAccount?.platform &&
    !String(currentAccount.platform).includes(String(form.platform)) &&
    !String(form.platform).includes(String(currentAccount.platform))
  );
  const isExchange = form.screenshotType === SCREENSHOT_TYPE.EXCHANGE_TRADE;
  const isApplication = form.screenshotType === SCREENSHOT_TYPE.OTC_APPLICATION;
  const isConfirmation = form.screenshotType === SCREENSHOT_TYPE.OTC_CONFIRMATION;
  const candidates = pendingTrades.filter((trade) => trade.code === form.code);

  const submit = () => {
    setError('');
    const tradeAt = isExchange ? parseTradeDateInput(form.tradeAt, true) : null;
    const requestAt = isApplication ? parseTradeDateInput(form.requestAt) : null;
    if (
      requiresStartingCash &&
      (startingCash === '' || !Number.isFinite(Number(startingCash)) || Number(startingCash) < 0)
    ) {
      return setError('请填写当前账户的起始现金');
    }
    if (platformConflict && !platformAcknowledged) return setError('请先核对截图平台与当前账户，并勾选确认');
    if (!/^\d{6}$/.test(String(form.code || ''))) return setError('请填写六位基金代码');
    if (
      form.fee !== '' &&
      form.fee != null &&
      (String(form.fee).trim() === '' || !Number.isFinite(Number(form.fee)) || Number(form.fee) < 0)
    ) {
      return setError('手续费必须是大于或等于 0 的数字');
    }
    if (
      isExchange &&
      (![TRADE_ACTION.BUY, TRADE_ACTION.SELL].includes(form.action) ||
        !(Number(form.price) > 0) ||
        !(Number(form.shares) > 0) ||
        !tradeAt)
    ) {
      return setError('请确认买卖方向、成交价、份额和时间');
    }
    if (isApplication && (!(Number(form.amount) > 0) || !requestAt)) return setError('请确认申购金额和提交时间');
    if (isConfirmation && (!(Number(form.nav) > 0) || !(Number(form.shares) > 0) || !form.actualConfirmDate)) {
      return setError('请确认实际净值、份额和确认日期');
    }
    if (
      ![SCREENSHOT_TYPE.EXCHANGE_TRADE, SCREENSHOT_TYPE.OTC_APPLICATION, SCREENSHOT_TYPE.OTC_CONFIRMATION].includes(
        form.screenshotType
      )
    ) {
      return setError('请选择可记账的交易类型');
    }
    if (isConfirmation && pendingTradeId && !candidates.some((trade) => trade.id === pendingTradeId)) {
      return setError('所选待确认申购与当前基金不匹配，请重新选择');
    }
    if (isConfirmation && candidates.length > 1 && !pendingTradeId) return setError('请选择对应的待确认申购');
    const confirmedForm = { ...form };
    if (tradeAt) confirmedForm.tradeAt = tradeAt;
    if (requestAt) confirmedForm.requestAt = requestAt;
    delete confirmedForm.accountId;
    onConfirm(confirmedForm, pendingTradeId || null);
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        height: '100dvh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        padding: '16px 16px calc(72px + env(safe-area-inset-bottom, 0px))',
        background: 'var(--background)',
        color: 'var(--foreground)'
      }}
    >
      <div className="trade-entry-form" style={{ maxWidth: 620, margin: '0 auto' }}>
        <button type="button" className="button secondary" onClick={onBack} style={{ marginBottom: 16 }}>
          ← 返回
        </button>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>确认录入信息</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          {hasRecognition
            ? '这是截图识别草稿。识别不清的内容已留空，请逐项核对后保存。'
            : imageUrl
              ? '截图已上传，目前尚未自动识别。请对照原图手动填写后保存。'
              : '手动录入：请核对交易类型、金额和日期后保存。'}
        </p>
        <section style={sectionStyle}>
          <strong>录入账户：{currentAccount?.name || '未选择'}</strong>
          <p className="muted" style={{ marginTop: 8 }}>
            只使用头像当前选中的账户。账户不对请先返回切换。
          </p>
          {requiresStartingCash && (
            <label style={{ display: 'block', marginTop: 14 }}>
              当前账户起始现金（元）
              <input
                className="input text-[16PX]"
                type="number"
                min="0"
                value={startingCash}
                onChange={(event) => onStartingCashChange?.(event.target.value)}
                onWheel={(event) => event.currentTarget.blur()}
                style={{ ...fieldStyle, boxSizing: 'border-box' }}
              />
              <small className="muted">买入计划中的“可用现金”不参与本账户交易记账。</small>
            </label>
          )}
          {hasRecognition && !form.platform && (
            <p style={{ color: 'var(--danger)', marginTop: 8 }}>截图平台未能辨认，请先确认这笔交易属于当前账户。</p>
          )}
          {platformConflict && (
            <div role="alert" style={{ color: 'var(--danger)', marginTop: 10 }}>
              <p>
                截图平台：{form.platform}；当前账户：{currentAccount.name}
                。请确认这笔交易属于当前账户；若不是，请返回并切换头像账户。
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={platformAcknowledged}
                  onChange={(event) => setPlatformAcknowledged(event.target.checked)}
                  style={{ width: 20, height: 20 }}
                />
                我已核对，仍保存到当前账户
              </label>
            </div>
          )}
        </section>
        {imageUrl && (
          <Image
            src={imageUrl}
            alt="待核对交易截图"
            width={600}
            height={600}
            unoptimized
            style={{ display: 'block', maxWidth: '100%', maxHeight: '40dvh', objectFit: 'contain', marginBottom: 16 }}
          />
        )}
        <section style={sectionStyle}>
          <label>
            录入类型
            <select
              value={form.screenshotType || SCREENSHOT_TYPE.UNKNOWN}
              onChange={(event) => update('screenshotType', event.target.value)}
              style={fieldStyle}
            >
              <option value={SCREENSHOT_TYPE.UNKNOWN}>请选择</option>
              <option value={SCREENSHOT_TYPE.EXCHANGE_TRADE}>场内 ETF 成交</option>
              <option value={SCREENSHOT_TYPE.OTC_APPLICATION}>场外基金申购</option>
              <option value={SCREENSHOT_TYPE.OTC_CONFIRMATION}>场外份额确认</option>
              <option value={SCREENSHOT_TYPE.HOLDING_SNAPSHOT}>当前持仓快照（本页不记账）</option>
            </select>
            {(!form.screenshotType || form.screenshotType === SCREENSHOT_TYPE.UNKNOWN) && (
              <small style={{ color: 'var(--danger)' }}>录入类型未知，请手动选择</small>
            )}
          </label>
          <Field
            label="基金 / ETF 代码"
            value={form.code}
            onChange={(value) => update('code', value)}
            required
            needsReview={needsReview('code')}
          />
          <Field
            label="名称"
            value={form.name}
            onChange={(value) => update('name', value)}
            needsReview={needsReview('name')}
          />
          {fundSearchStatus && (
            <p className="muted" role="status">
              {fundSearchStatus}
            </p>
          )}
          {fundMatches.length > 0 && (
            <div
              role="listbox"
              aria-label="匹配基金"
              style={{
                marginTop: -8,
                marginBottom: 14,
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflowY: 'auto',
                maxHeight: 320
              }}
            >
              {fundMatches.map((fund) => (
                <button
                  key={fund.code}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setForm((previous) => ({ ...previous, code: fund.code, name: fund.name }));
                    setFundMatches([]);
                    setFundSearchStatus('');
                    setPendingTradeId('');
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: 12,
                    textAlign: 'left',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  {fund.name} · {fund.code}
                </button>
              ))}
            </div>
          )}
          {isExchange && (
            <>
              <label>
                买卖方向
                <select
                  value={form.action || ''}
                  onChange={(event) => update('action', event.target.value)}
                  style={fieldStyle}
                >
                  <option value="">请选择</option>
                  <option value={TRADE_ACTION.BUY}>买入</option>
                  <option value={TRADE_ACTION.SELL}>卖出</option>
                </select>
                {needsReview('action') && <small style={{ color: 'var(--danger)' }}>买卖方向不明确，请手动选择</small>}
              </label>
              <Field
                label="成交价"
                value={form.price}
                type="number"
                onChange={(value) => update('price', value)}
                required
                needsReview={needsReview('price')}
              />
              <Field
                label="成交份额"
                value={form.shares}
                type="number"
                onChange={(value) => update('shares', value)}
                required
                needsReview={needsReview('shares')}
              />
              <p>
                成交金额：
                {Number(form.price) > 0 && Number(form.shares) > 0
                  ? `¥${(Number(form.price) * Number(form.shares)).toFixed(2)}`
                  : '—'}
              </p>
              <Field
                label="手续费"
                value={form.fee}
                type="number"
                onChange={(value) => update('fee', value)}
                needsReview={needsReview('fee')}
                min="0"
              />
              <Field
                label="成交时间"
                value={form.tradeAt}
                onChange={(value) => update('tradeAt', value)}
                onBlur={() => {
                  const parsed = parseTradeDateInput(form.tradeAt, true);
                  if (parsed) update('tradeAt', parsed);
                }}
                inputMode="numeric"
                placeholder="YYYYMMDD 或 YYYYMMDDHHmm"
                required
                needsReview={needsReview('tradeAt')}
              />
              <p className="muted">支持 YYYYMMDD 或 YYYYMMDDHHmm；只填日期时，成交时刻记为未提供。</p>
              {form.tradeAt && (
                <p role="status" aria-live="polite">
                  转换后：{parseTradeDateInput(form.tradeAt, true) || '等待完整、有效的日期或时间'}
                </p>
              )}
            </>
          )}
          {isApplication && (
            <>
              <Field
                label="申购金额"
                value={form.amount}
                type="number"
                onChange={(value) => update('amount', value)}
                required
                needsReview={needsReview('amount')}
              />
              <Field
                label="实际提交时间"
                value={form.requestAt}
                onChange={(value) => update('requestAt', value)}
                onBlur={() => {
                  const parsed = parseTradeDateInput(form.requestAt);
                  if (parsed) update('requestAt', parsed);
                }}
                inputMode="numeric"
                placeholder="YYYYMMDDHHmm"
                required
                needsReview={needsReview('requestAt')}
              />
              {form.requestAt && (
                <p role="status" aria-live="polite">
                  转换后：{parseTradeDateInput(form.requestAt) || '等待完整、有效的提交时间'}
                </p>
              )}
              <p className="muted">申购先进入待确认，不立即生成基金份额。</p>
            </>
          )}
          {isConfirmation && (
            <>
              <Field
                label="实际确认净值"
                value={form.nav}
                type="number"
                onChange={(value) => update('nav', value)}
                required
                needsReview={needsReview('nav')}
              />
              <Field
                label="实际确认份额"
                value={form.shares}
                type="number"
                onChange={(value) => update('shares', value)}
                required
                needsReview={needsReview('shares')}
              />
              <Field
                label="手续费"
                value={form.fee}
                type="number"
                onChange={(value) => update('fee', value)}
                needsReview={needsReview('fee')}
                min="0"
              />
              <Field
                label="实际净值日"
                value={form.actualNavDate}
                type="date"
                onChange={(value) => update('actualNavDate', value)}
                needsReview={needsReview('actualNavDate')}
              />
              <Field
                label="实际确认日期"
                value={form.actualConfirmDate}
                type="date"
                onChange={(value) => update('actualConfirmDate', value)}
                required
                needsReview={needsReview('actualConfirmDate')}
              />
              {candidates.length > 0 && (
                <label>
                  对应的待确认申购
                  <select
                    value={pendingTradeId}
                    onChange={(event) => setPendingTradeId(event.target.value)}
                    style={fieldStyle}
                  >
                    <option value="">{candidates.length === 1 ? '自动匹配唯一申购' : '请选择一笔申购'}</option>
                    {candidates.map((trade) => (
                      <option key={trade.id} value={trade.id}>
                        {trade.requestAt} · ¥{trade.amount}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
        </section>
        {error && (
          <p role="alert" style={{ color: 'var(--danger)', marginBottom: 16 }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, paddingBottom: 20 }}>
          <button type="button" className="button secondary" onClick={onBack} style={{ flex: 1 }}>
            取消
          </button>
          <button type="button" className="button" onClick={submit} disabled={busy} style={{ flex: 1 }}>
            {busy ? '正在核对…' : '确认并保存到本机'}
          </button>
        </div>
      </div>
    </main>
  );
}
