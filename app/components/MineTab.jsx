'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, QrCode } from 'lucide-react';
import { SettingsIcon } from './Icons';

export default function MineTab({
  visible = true,
  user,
  userAvatar,
  lastSyncDisplay,
  onLocalSettings,
  onMyEarnings,
  onTutorial,
  onUpdateLog,
  onFeedback,
  onSponsorSupport,
  onOpenWeChat
}) {
  return (
    <div className="mine-tab" style={{ display: visible ? undefined : 'none' }} aria-hidden={!visible || undefined}>
      <section className="mine-profile-card glass" aria-label="个人信息" style={{ position: 'relative' }}>
        <div className="mine-profile-row">
          <div className="mine-profile-avatar">
            {user ? (
              userAvatar ? (
                <Image
                  src={userAvatar}
                  alt="用户头像"
                  width={56}
                  height={56}
                  unoptimized
                  style={{ borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <span className="mine-profile-avatar-fallback">{user.email?.charAt(0).toUpperCase() || 'U'}</span>
              )
            ) : (
              <span className="mine-profile-avatar-fallback muted">?</span>
            )}
          </div>
          <div className="mine-profile-text">
            {user ? (
              <>
                <div className="mine-profile-title">{user.email || '已登录用户'}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  已登录 · 可使用云端同步
                </div>
                {lastSyncDisplay && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    同步于 {lastSyncDisplay}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mine-profile-title">本地模式</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  本地使用不依赖 GitHub 或云同步
                </div>
                <button type="button" className="button mine-profile-login-btn" onClick={onLocalSettings}>
                  <SettingsIcon width={16} height={16} />
                  <span>本地设置</span>
                </button>
              </>
            )}
          </div>
        </div>
        <a
          className="ocr-quota-badge"
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
          onClick={onOpenWeChat}
        >
          <QrCode size={14} />
          加入微信用户支持群
        </a>
      </section>

      <ul className="mine-menu-list" role="list">
        <li>
          <Link href="/trade-entry/" className="mine-menu-row glass">
            <span className="mine-menu-label">交易录入</span>
            <ChevronRight className="mine-menu-chevron" aria-hidden strokeWidth={2} />
          </Link>
        </li>
        <li>
          <button type="button" className="mine-menu-row glass" onClick={onMyEarnings}>
            <span className="mine-menu-label">我的收益</span>
            <ChevronRight className="mine-menu-chevron" aria-hidden strokeWidth={2} />
          </button>
        </li>
        <li>
          <Link href="/analysis-history/" className="mine-menu-row glass">
            <span className="mine-menu-label">历史分析建议</span>
            <ChevronRight className="mine-menu-chevron" aria-hidden strokeWidth={2} />
          </Link>
        </li>
        <li>
          <button type="button" className="mine-menu-row glass" onClick={onTutorial}>
            <span className="mine-menu-label">使用帮助</span>
            <ChevronRight className="mine-menu-chevron" aria-hidden strokeWidth={2} />
          </button>
        </li>
        <li>
          <button type="button" className="mine-menu-row glass" onClick={onUpdateLog}>
            <span className="mine-menu-label">更新日志</span>
            <ChevronRight className="mine-menu-chevron" aria-hidden strokeWidth={2} />
          </button>
        </li>
        <li>
          <button type="button" className="mine-menu-row glass" onClick={onFeedback}>
            <span className="mine-menu-label">问题反馈</span>
            <ChevronRight className="mine-menu-chevron" aria-hidden strokeWidth={2} />
          </button>
        </li>
        <li>
          <button type="button" className="mine-menu-row glass" onClick={onSponsorSupport}>
            <span className="mine-menu-label">赞助支持</span>
            <ChevronRight className="mine-menu-chevron" aria-hidden strokeWidth={2} />
          </button>
        </li>
      </ul>
    </div>
  );
}
