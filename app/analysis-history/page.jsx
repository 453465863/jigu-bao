'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { isArray, isObject, isString } from 'lodash';
import { LEGACY_ACCOUNT_ID } from '@/app/lib/accounts';
import { storageStore, useStorageStore } from '@/app/stores';

const formatTime = (value) => {
  if (!isString(value) || !value.trim()) return '时间未提供';
  return value.replace('T', ' ').replace('Z', '').slice(0, 16) || '时间未提供';
};

const normalizeReport = (value) => {
  if (!isObject(value)) return null;
  const title = isString(value.title) && value.title.trim() ? value.title.trim() : '分析建议';
  const conclusion = isString(value.conclusion) ? value.conclusion.trim() : '';
  const reasons = isArray(value.reasons) ? value.reasons.filter((item) => isString(item) && item.trim()) : [];
  return {
    id: isString(value.id) && value.id ? value.id : `${value.createdAt || ''}-${title}`,
    title,
    conclusion,
    reasons,
    createdAt: value.createdAt
  };
};

export default function AnalysisHistoryPage() {
  const activeAccountId = useStorageStore((state) => state.activeAccountId);
  const accountLedgers = useStorageStore((state) => state.accountLedgers);
  const legacyTasks = useStorageStore((state) => state.analysisTasks);
  const legacyReports = useStorageStore((state) => state.analysisReports);
  const accountsReady = useStorageStore((state) => state.accountsReady);
  const [taskNotice, setTaskNotice] = useState('');

  useEffect(() => {
    const store = useStorageStore.getState();
    store.initCustomSettings();
    store.initAccountLedgers();
    store.initActiveAccount();
    store.initAnalysisTasks();
    store.initAnalysisReports();
  }, []);

  const reports = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const source =
      activeAccountId === LEGACY_ACCOUNT_ID ? legacyReports : accountLedgers[activeAccountId]?.analysisReports;
    return (isArray(source) ? source : []).map(normalizeReport).filter(Boolean);
  }, [activeAccountId, accountLedgers, legacyReports]);

  const tasks = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const source = activeAccountId === LEGACY_ACCOUNT_ID ? legacyTasks : accountLedgers[activeAccountId]?.analysisTasks;
    return isArray(source) ? source.filter((task) => isObject(task) && task.status === 'pending') : [];
  }, [activeAccountId, accountLedgers, legacyTasks]);

  const createTask = () => {
    const current = storageStore.getItem('analysisTasks', []);
    const pending = isArray(current) ? current.filter((task) => isObject(task) && task.status === 'pending') : [];
    if (pending.length > 0) {
      setTaskNotice('当前账户已有待分析任务，电脑端处理后会在本页显示结果。');
      return;
    }
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    storageStore.setItem(
      'analysisTasks',
      JSON.stringify([{ id, accountId: activeAccountId, status: 'pending', createdAt: new Date().toISOString() }])
    );
    setTaskNotice('待分析任务已创建。');
  };

  return (
    <main style={{ minHeight: '100dvh', padding: '24px 16px 48px', background: 'var(--background)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link href="/" className="button secondary">
          ← 返回基估宝
        </Link>
        <h1 style={{ fontSize: 26, margin: '24px 0 8px' }}>历史分析建议</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          只显示当前头像账户的已保存建议。
        </p>
        <section className="glass" style={{ padding: 16, borderRadius: 16, marginBottom: 16 }}>
          <strong>需要新的分析？</strong>
          <p className="muted" style={{ margin: '8px 0 12px', lineHeight: 1.6 }}>
            创建后会生成一条当前账户专属的待分析任务。电脑端 AI 将结合资产分布、持仓收益、交易记录、
            目标比例、目标缺口和待投入金额形成建议；手机端负责发起任务和查看保存后的历史结果。
          </p>
          <button type="button" className="button" onClick={createTask} disabled={!accountsReady || tasks.length > 0}>
            {tasks.length > 0 ? '已有待分析任务' : '创建待分析任务'}
          </button>
          {taskNotice && (
            <p className="muted" role="status" style={{ marginTop: 10 }}>
              {taskNotice}
            </p>
          )}
        </section>
        {!accountsReady ? (
          <p className="muted">正在读取当前账户…</p>
        ) : reports.length === 0 ? (
          <section className="glass" style={{ padding: 20, borderRadius: 16 }}>
            <strong>暂无历史建议</strong>
            <p className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
              电脑端生成并保存分析后，会自动显示在当前账户这里；系统不会自行生成或虚构投资建议。
            </p>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {reports.map((report) => (
              <article key={report.id} className="glass" style={{ padding: 18, borderRadius: 16 }}>
                <div className="muted" style={{ fontSize: '14PX', marginBottom: 8 }}>
                  {formatTime(report.createdAt)}
                </div>
                <h2 style={{ fontSize: 19, marginBottom: 8 }}>{report.title}</h2>
                {report.conclusion && (
                  <p style={{ lineHeight: 1.65, marginBottom: report.reasons.length ? 10 : 0 }}>{report.conclusion}</p>
                )}
                {report.reasons.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65 }}>
                    {report.reasons.map((reason, index) => (
                      <li key={`${report.id}-${index}`}>{reason}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
