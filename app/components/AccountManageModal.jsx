'use client';

import { v4 as uuidv4 } from 'uuid';
import { useModalStore, useStorageStore } from '../stores';
import { getAccountsFromSettings, LEGACY_ACCOUNT_ID } from '../lib/accounts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const TYPE_LABELS = { real: '真实账户', virtual: '虚拟盘', unclassified: '未分类' };

export default function AccountManageModal({ onClose }) {
  const customSettings = useStorageStore((s) => s.customSettings);
  const editId = useModalStore((s) => s.accountManageEditId);
  const draft = useModalStore((s) => s.accountManageDraft);
  const error = useModalStore((s) => s.accountManageError);
  const accounts = getAccountsFromSettings(customSettings);

  const updateDraft = (patch) =>
    useModalStore.setState((state) => ({
      accountManageDraft: { ...state.accountManageDraft, ...patch },
      accountManageError: ''
    }));

  const startEdit = (account) =>
    useModalStore.setState({
      accountManageEditId: account.id,
      accountManageDraft: { name: account.name, type: account.type, platform: account.platform },
      accountManageError: ''
    });

  const startAdd = () =>
    useModalStore.setState({
      accountManageEditId: null,
      accountManageDraft: { name: '', type: 'real', platform: '' },
      accountManageError: ''
    });

  const save = () => {
    const name = draft.name.trim();
    const platform = draft.platform.trim();
    if (!name) {
      useModalStore.setState({ accountManageError: '请输入账户名称' });
      return;
    }
    if (accounts.some((account) => account.id !== editId && account.name === name)) {
      useModalStore.setState({ accountManageError: '已有同名账户' });
      return;
    }
    const next = editId
      ? accounts.map((account) => (account.id === editId ? { ...account, name, type: draft.type, platform } : account))
      : [...accounts, { id: uuidv4(), name, type: draft.type, platform }];
    useStorageStore.getState().setAccounts(next);
    startAdd();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="glass card modal"
        overlayStyle={{ zIndex: 10000 }}
        style={{
          width: '90vw',
          maxWidth: 480,
          maxHeight: '90dvh',
          overflowY: 'auto',
          zIndex: 10001,
          pointerEvents: 'auto'
        }}
      >
        <DialogTitle>管理账户</DialogTitle>
        <p className="muted">点头像可切换账户。新账户账本仅保存在本机，请及时导出备份。</p>

        <div style={{ maxHeight: '28vh', overflowY: 'auto' }}>
          {accounts.map((account) => (
            <div key={account.id} className="user-menu-item" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{account.name}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {TYPE_LABELS[account.type]}
                  {account.platform ? ` · ${account.platform}` : ''}
                  {account.id === LEGACY_ACCOUNT_ID ? ' · 原有账本' : ' · 本地独立账本'}
                </div>
              </div>
              <button type="button" className="button secondary" onClick={() => startEdit(account)}>
                编辑
              </button>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>{editId ? '编辑账户' : '新增账户'}</strong>
            {editId && (
              <button type="button" onClick={startAdd}>
                取消编辑
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <label htmlFor="account-name">账户名称</label>
            <input
              id="account-name"
              className="input text-[16PX]"
              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
              maxLength={40}
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              placeholder="例如：学习虚拟盘"
            />
          </div>
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <label htmlFor="account-type">账户类型</label>
            <select
              id="account-type"
              className="input text-[16PX]"
              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
              value={draft.type}
              onChange={(event) => updateDraft({ type: event.target.value })}
            >
              <option value="real">真实账户</option>
              <option value="virtual">虚拟盘</option>
              {draft.type === 'unclassified' && <option value="unclassified">未分类</option>}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <label htmlFor="account-platform">平台备注</label>
            <input
              id="account-platform"
              className="input text-[16PX]"
              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
              maxLength={40}
              value={draft.platform}
              onChange={(event) => updateDraft({ platform: event.target.value })}
              placeholder="例如：支付宝、金太阳"
            />
          </div>
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          <button type="button" className="button primary" onClick={save} style={{ marginTop: 12 }}>
            {editId ? '保存修改' : '新增账户'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
