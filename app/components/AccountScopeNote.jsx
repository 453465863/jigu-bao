'use client';

import { useStorageStore } from '../stores';
import { getAccountsFromSettings } from '../lib/accounts';

export default function AccountScopeNote() {
  const activeAccountId = useStorageStore((state) => state.activeAccountId);
  const customSettings = useStorageStore((state) => state.customSettings);
  const account = getAccountsFromSettings(customSettings).find((item) => item.id === activeAccountId);

  return (
    <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
      操作账户：<strong style={{ color: 'var(--primary)' }}>{account?.name || '支付宝'}</strong>
      {account?.type === 'virtual' ? ' · 虚拟盘' : ''}
    </div>
  );
}
