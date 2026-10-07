'use client';
import { isFunction } from 'lodash';

import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { CloseIcon, SettingsIcon, SwitchIcon } from './Icons';
import { DatePicker } from './Common';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import AccountScopeNote from './AccountScopeNote';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ =
  typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
    : 'Asia/Shanghai';

export default function HoldingEditModal({ fund, holding, nav, onClose, onSave, onOpenTrade }) {
  const [mode, setMode] = useState('amount'); // 'amount' | 'share'
  const [dateMode, setDateMode] = useState('date'); // 'date' | 'days'

  const dwjz = nav ?? (fund?.dwjz || fund?.gsz || 0);
  const dwjzRef = useRef(dwjz);
  useEffect(() => {
    dwjzRef.current = dwjz;
  }, [dwjz]);

  const [share, setShare] = useState('');
  const [cost, setCost] = useState('');
  const [amount, setAmount] = useState('');
  const [profit, setProfit] = useState('');
  const [firstPurchaseDate, setFirstPurchaseDate] = useState('');
  const [holdingDaysInput, setHoldingDaysInput] = useState('');

  const holdingSig = useMemo(() => {
    if (!holding) return '';
    return `${holding.id ?? ''}|${holding.share ?? ''}|${holding.cost ?? ''}|${holding.firstPurchaseDate ?? ''}`;
  }, [holding]);

  useEffect(() => {
    if (holding) {
      const s = holding.share || 0;
      const c = holding.cost || 0;
      setShare(String(s));
      setCost(String(c));
      setFirstPurchaseDate(holding.firstPurchaseDate || '');

      if (holding.firstPurchaseDate) {
        const days = dayjs.tz(undefined, TZ).diff(dayjs.tz(holding.firstPurchaseDate, TZ), 'day');
        setHoldingDaysInput(days > 0 ? String(days) : '');
      } else {
        setHoldingDaysInput('');
      }

      const price = dwjzRef.current;
      if (price > 0) {
        const a = s * price;
        const p = (price - c) * s;
        setAmount(a.toFixed(2));
        setProfit(p.toFixed(2));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingSig]);

  const handleModeChange = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);

    if (newMode === 'share') {
      if (amount && dwjz > 0) {
        const a = parseFloat(amount);
        const p = parseFloat(profit || 0);
        const s = a / dwjz;
        const principal = a - p;
        const c = s > 0 ? principal / s : 0;

        setShare(Number(s.toFixed(6)).toString());
        setCost(Number(c.toFixed(6)).toString());
      }
    } else {
      if (share && dwjz > 0) {
        const s = parseFloat(share);
        const c = parseFloat(cost || 0);
        const a = s * dwjz;
        const p = (dwjz - c) * s;

        setAmount(a.toFixed(2));
        setProfit(p.toFixed(2));
      }
    }
  };

  const handleDateModeToggle = () => {
    const newMode = dateMode === 'date' ? 'days' : 'date';
    setDateMode(newMode);

    if (newMode === 'days' && firstPurchaseDate) {
      const days = dayjs.tz(undefined, TZ).diff(dayjs.tz(firstPurchaseDate, TZ), 'day');
      setHoldingDaysInput(days > 0 ? String(days) : '');
    } else if (newMode === 'date' && holdingDaysInput) {
      const days = parseInt(holdingDaysInput, 10);
      if (Number.isFinite(days) && days >= 0) {
        const date = dayjs.tz(undefined, TZ).subtract(days, 'day').format('YYYY-MM-DD');
        setFirstPurchaseDate(date);
      }
    }
  };

  const handleHoldingDaysChange = (value) => {
    setHoldingDaysInput(value);
    const days = parseInt(value, 10);
    if (Number.isFinite(days) && days >= 0) {
      const date = dayjs.tz(undefined, TZ).subtract(days, 'day').format('YYYY-MM-DD');
      setFirstPurchaseDate(date);
    }
  };

  const handleFirstPurchaseDateChange = (value) => {
    setFirstPurchaseDate(value);
    if (value) {
      const days = dayjs.tz(undefined, TZ).diff(dayjs.tz(value, TZ), 'day');
      setHoldingDaysInput(days > 0 ? String(days) : '');
    } else {
      setHoldingDaysInput('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let finalShare = 0;
    let finalCost = 0;

    if (mode === 'share') {
      if (!share || !cost) return;
      finalShare = Number(Number(share).toFixed(2));
      finalCost = Number(cost);
    } else {
      if (!amount || !dwjz) return;
      const a = Number(amount);
      const p = Number(profit || 0);
      const rawShare = a / dwjz;
      finalShare = Number(rawShare.toFixed(6));
      const principal = a - p;
      finalCost = finalShare > 0 ? principal / finalShare : 0;
    }

    const trimmedDate = firstPurchaseDate ? firstPurchaseDate.trim() : '';

    onSave({
      share: finalShare,
      cost: finalCost,
      ...(trimmedDate && { firstPurchaseDate: trimmedDate })
    });
    onClose();
  };

  const isValid =
    mode === 'share'
      ? share && cost && !isNaN(share) && !isNaN(cost)
      : amount && !isNaN(amount) && (!profit || !isNaN(profit)) && dwjz > 0;

  const handleOpenChange = (open) => {
    if (!open) {
      onClose?.();
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="glass card modal"
        overlayClassName="modal-overlay"
        style={{
          maxWidth: '400px',
          zIndex: 999,
          width: '90vw',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <DialogTitle className="sr-only">补录当前持仓</DialogTitle>
        <div className="title" style={{ marginBottom: 20, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SettingsIcon width="20" height="20" />
            <span>补录当前持仓</span>
            {isFunction(onOpenTrade) && (
              <button
                type="button"
                onClick={onOpenTrade}
                className="button secondary"
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--primary)'
                }}
              >
                记录买入 →
              </button>
            )}
          </div>
          <button className="icon-button" onClick={onClose} style={{ border: 'none', background: 'transparent' }}>
            <CloseIcon width="20" height="20" />
          </button>
        </div>

        <AccountScopeNote />

        <div className="muted" style={{ marginBottom: 16, fontSize: '13px', lineHeight: 1.6 }}>
          此处填写的是账户现在的持仓快照，保存后直接计入资产；不会生成买入交易，也不会推算申购及份额确认时间。
          如果刚买入，请点上方“记录买入”。场内 ETF 当前仍按基金净值估算，与证券账户成交价可能不同。
        </div>

        {holding && (
          <div className="muted" style={{ marginBottom: 16, fontSize: '13px', lineHeight: 1.6 }}>
            当前保存：{Number(holding.share || 0).toFixed(6)} 份，成本价 ¥{Number(holding.cost || 0).toFixed(4)}。
            下面修改并保存会覆盖这笔持仓。
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div className="fund-name" style={{ fontWeight: 600, fontSize: '16px', marginBottom: 4 }}>
            {fund?.name}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="muted" style={{ fontSize: '12px' }}>
              #{fund?.code}
            </div>
            <div className="badge" style={{ fontSize: '12px' }}>
              最新净值：<span style={{ fontWeight: 600, color: 'var(--primary)' }}>{dwjz}</span>
            </div>
          </div>
        </div>

        <div
          className="tabs-container"
          style={{ marginBottom: 20, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12 }}
        >
          <div className="row" style={{ gap: 0 }}>
            <button
              type="button"
              className={`tab ${mode === 'amount' ? 'active' : ''}`}
              onClick={() => handleModeChange('amount')}
              style={{ flex: 1, justifyContent: 'center', height: 32, borderRadius: 8 }}
            >
              按持仓金额
            </button>
            <button
              type="button"
              className={`tab ${mode === 'share' ? 'active' : ''}`}
              onClick={() => handleModeChange('share')}
              style={{ flex: 1, justifyContent: 'center', height: 32, borderRadius: 8 }}
            >
              按份额和成本价
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'amount' ? (
            <>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="muted" style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>
                  当前持仓金额（非买入金额） <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className={`input ${!amount ? 'error' : ''}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="请输入持有总金额"
                  style={{
                    width: '100%',
                    fontSize: '16PX',
                    border: !amount ? '1px solid var(--danger)' : undefined
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="muted" style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>
                  当前累计收益
                </label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  value={profit}
                  onChange={(e) => setProfit(e.target.value)}
                  placeholder="请输入持有总收益 (可为负)"
                  style={{ width: '100%', fontSize: '16PX' }}
                />
              </div>
              <div className="muted" style={{ marginBottom: 16, fontSize: '13px', lineHeight: 1.6 }}>
                留空收益按 ¥0 计算；保存时会按上方净值换算份额和成本价。
              </div>
            </>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="muted" style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>
                  持有份额 <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className={`input ${!share ? 'error' : ''}`}
                  value={share}
                  onChange={(e) => setShare(e.target.value)}
                  placeholder="请输入持有份额"
                  style={{
                    width: '100%',
                    fontSize: '16PX',
                    border: !share ? '1px solid var(--danger)' : undefined
                  }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="muted" style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>
                  持仓成本价 <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className={`input ${!cost ? 'error' : ''}`}
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="请输入持仓成本价"
                  style={{
                    width: '100%',
                    fontSize: '16PX',
                    border: !cost ? '1px solid var(--danger)' : undefined
                  }}
                />
              </div>
              {Number(share) > 0 && Number(cost) > 0 && Number(dwjz) > 0 && (
                <div className="muted" style={{ marginBottom: 16, fontSize: '13px' }}>
                  <div>按当前净值 {Number(dwjz).toFixed(4)} 估算</div>
                  <div>持仓收益 ¥{((Number(dwjz) - Number(cost)) * Number(share)).toFixed(2)}</div>
                  <div>成本价高于当前净值时，收益为负。</div>
                </div>
              )}
            </>
          )}

          <div className="form-group" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: '14px' }}>
                {dateMode === 'date' ? '首次买入日期' : '持有天数'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleDateModeToggle}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(255,255,255,0.06)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: '12px',
                      color: 'var(--primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <SwitchIcon />
                    {dateMode === 'date' ? '按天数' : '按日期'}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{dateMode === 'date' ? '切换到持有天数' : '切换到日期'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {dateMode === 'date' ? (
              <DatePicker value={firstPurchaseDate} onChange={handleFirstPurchaseDateChange} position="top" />
            ) : (
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                className="input"
                value={holdingDaysInput}
                onChange={(e) => handleHoldingDaysChange(e.target.value)}
                placeholder="请输入持有天数"
                style={{ width: '100%', fontSize: '16PX' }}
              />
            )}
          </div>

          <div className="row" style={{ gap: 12 }}>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
            >
              取消
            </button>
            <button
              type="submit"
              className="button"
              disabled={!isValid}
              style={{ flex: 1, opacity: isValid ? 1 : 0.6 }}
            >
              保存
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
