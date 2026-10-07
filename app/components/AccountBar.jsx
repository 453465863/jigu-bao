'use client';

import { getAccountsFromSettings } from '@/app/lib/accounts';

const TYPE_LABELS = {
  real: '真实账户',
  virtual: '虚拟盘',
  unclassified: '未分类'
};

export default function AccountBar({ customSettings, activeAccountId, onSwitch, onManage }) {
  const accounts = getAccountsFromSettings(customSettings);
  const activeAccount = accounts.find((account) => account.id === activeAccountId) || accounts[0];

  return (
    <div aria-label="账户" style={{ padding: '8px 12px' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>当前账户：{activeAccount.name}</div>
      {accounts.map((account) => (
        <button
          type="button"
          key={account.id}
          className="user-menu-item"
          onClick={() => onSwitch(account.id)}
          aria-current={account.id === activeAccountId ? 'true' : undefined}
          style={{ marginTop: 4, color: account.id === activeAccountId ? 'var(--primary)' : undefined }}
        >
          {account.id === activeAccountId ? '✓ ' : '　'}
          {account.name} · {TYPE_LABELS[account.type]}
        </button>
      ))}
      <button className="user-menu-item" onClick={onManage} style={{ marginTop: 8, paddingLeft: 0 }}>
        管理账户
      </button>
      <div style={{ opacity: 0.6, marginTop: 4, fontSize: 12 }}>登录后，账户数据可在手机和电脑之间同步</div>
    </div>
  );
}
