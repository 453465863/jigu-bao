'use client';

import { SUMMARY_TAB_ID } from '@/app/constants';

export default function EmptyStateCard({ fundsLength = 0, currentTab = 'all', onAddFund, onAddToGroup }) {
  const isEmpty = fundsLength === 0;
  const isGroupTab = currentTab !== 'all' && currentTab !== 'fav' && currentTab !== SUMMARY_TAB_ID;

  return (
    <div
      className="glass card empty"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px'
      }}
    >
      <div style={{ fontSize: '48px', marginBottom: 16, opacity: 0.5 }}>📂</div>
      <div className="muted" style={{ marginBottom: 20 }}>
        {isEmpty ? '这个账户还没有基金。先添加 ETF／基金，再录入持仓。' : '该分组下暂无数据'}
      </div>
      {isEmpty && (
        <button type="button" className="button" onClick={onAddFund}>
          添加 ETF／基金
        </button>
      )}
      {isGroupTab && fundsLength > 0 && (
        <button className="button" onClick={onAddToGroup}>
          添加基金到此分组
        </button>
      )}
    </div>
  );
}
