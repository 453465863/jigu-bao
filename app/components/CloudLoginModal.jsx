'use client';

import Image from 'next/image';
import { useState } from 'react';
import { MailIcon } from './Icons';
import githubImg from '../assets/github.svg';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function CloudLoginModal({
  onClose,
  showToast,
  isExplicitLoginRef,
  initialError = '',
  initialMode = 'login'
}) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState(initialMode);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(initialError);
  const [loginMessage, setLoginMessage] = useState('');

  const registerMode = mode === 'register';
  const forgotMode = mode === 'forgot';
  const changeMode = mode === 'change';

  const validateInput = () => {
    const email = loginEmail.trim();
    if (!changeMode && !email) return '请输入邮箱地址';
    if (!changeMode && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '请输入有效的邮箱地址';
    if (!forgotMode && loginPassword.length < 6) return '密码至少需要 6 位';
    if ((registerMode || changeMode) && loginPassword !== confirmPassword) return '两次输入的密码不一致';
    return '';
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setLoginError('');
    setLoginMessage('');
    if (!isSupabaseConfigured) {
      showToast('未配置 Supabase，无法开启云同步', 'error');
      return;
    }

    const validationError = validateInput();
    if (validationError) {
      setLoginError(validationError);
      return;
    }

    try {
      setLoginLoading(true);
      if (forgotMode) {
        const redirectTo = window.location.href.split('#')[0].split('?')[0];
        const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), { redirectTo });
        if (error) throw error;
        setLoginMessage('重置邮件已发送。请打开邮件中的链接，再设置新密码。');
        return;
      }
      if (changeMode) {
        const { error } = await supabase.auth.updateUser({ password: loginPassword });
        if (error) throw error;
        showToast('密码已更新', 'success');
        onClose();
        return;
      }
      if (isExplicitLoginRef) isExplicitLoginRef.current = true;
      const credentials = { email: loginEmail.trim(), password: loginPassword };
      const { data, error } = registerMode
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

      if (error) throw error;
      if (registerMode && !data?.session) {
        throw new Error('Supabase 仍要求确认邮箱。请先在后台关闭 Confirm email，再重新注册。');
      }
      if (data?.user || data?.session) onClose();
    } catch (error) {
      const message = error?.message || '';
      if (message.includes('Invalid login credentials')) {
        setLoginError('邮箱或密码不正确；首次使用请选择“创建同步账户”');
      } else if (message.includes('User already registered')) {
        setLoginError('该邮箱已经注册，请切换到“已有账户登录”');
      } else if (message.includes('network') || message.includes('fetch')) {
        setLoginError('无法连接云端，请检查当前网络后重试；免登录功能不受影响');
      } else {
        setLoginError(message || '登录失败，请稍后再试');
      }
      if (isExplicitLoginRef) isExplicitLoginRef.current = false;
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setLoginError('');
    if (!isSupabaseConfigured) {
      showToast('未配置 Supabase，无法开启云同步', 'error');
      return;
    }
    try {
      if (isExplicitLoginRef) isExplicitLoginRef.current = true;
      setLoginLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (error) {
      setLoginError(error?.message || 'GitHub 登录失败，请稍后再试');
      if (isExplicitLoginRef) isExplicitLoginRef.current = false;
      setLoginLoading(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="登录与云同步" onClick={onClose}>
      <div className="glass card modal login-modal" onClick={(event) => event.stopPropagation()}>
        <div className="title" style={{ marginBottom: 16 }}>
          <MailIcon width="20" height="20" />
          <span>
            {changeMode ? '设置新密码' : forgotMode ? '找回密码' : registerMode ? '创建同步账户' : '登录与云同步'}
          </span>
        </div>

        <div className="muted" style={{ marginBottom: 16, fontSize: '16PX', lineHeight: 1.6 }}>
          {changeMode
            ? '新密码至少 6 位，保存后请在其他设备使用新密码登录。'
            : forgotMode
              ? '输入注册邮箱，我们会发送密码重置链接。'
              : '登录只用于在手机和电脑之间同步数据。免登录也能使用本机的账户、资产、交易录入和目标配置。'}
        </div>

        {!changeMode && !forgotMode && (
          <div className="login-mode-tabs" role="tablist" aria-label="选择登录或创建账户">
            <button
              type="button"
              role="tab"
              aria-selected={!registerMode}
              className={`login-mode-tab ${!registerMode ? 'active' : ''}`}
              onClick={() => {
                setMode('login');
                setLoginError('');
                setLoginMessage('');
              }}
              disabled={loginLoading}
            >
              已有账户登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={registerMode}
              className={`login-mode-tab ${registerMode ? 'active' : ''}`}
              onClick={() => {
                setMode('register');
                setLoginError('');
                setLoginMessage('');
              }}
              disabled={loginLoading}
            >
              创建同步账户
            </button>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit}>
          {!changeMode && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label
                className="muted"
                htmlFor="cloud-login-email"
                style={{ display: 'block', marginBottom: 8, fontSize: '16PX' }}
              >
                邮箱
              </label>
              <input
                id="cloud-login-email"
                style={{ width: '100%', fontSize: '16PX' }}
                className="input"
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                disabled={loginLoading}
              />
            </div>
          )}

          {!forgotMode && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label
                className="muted"
                htmlFor="cloud-login-password"
                style={{ display: 'block', marginBottom: 8, fontSize: '16PX' }}
              >
                密码
              </label>
              <input
                id="cloud-login-password"
                style={{ width: '100%', fontSize: '16PX' }}
                className="input"
                type="password"
                autoComplete={registerMode || changeMode ? 'new-password' : 'current-password'}
                placeholder="至少 6 位"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                disabled={loginLoading}
              />
            </div>
          )}

          {(registerMode || changeMode) && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label
                className="muted"
                htmlFor="cloud-login-password-confirm"
                style={{ display: 'block', marginBottom: 8, fontSize: '16PX' }}
              >
                再次输入密码
              </label>
              <input
                id="cloud-login-password-confirm"
                style={{ width: '100%', fontSize: '16PX' }}
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loginLoading}
              />
            </div>
          )}

          {loginError && (
            <div className="login-message error" style={{ marginBottom: 12 }}>
              <span>{loginError}</span>
            </div>
          )}

          {loginMessage && (
            <div className="login-message success" style={{ marginBottom: 12 }}>
              <span>{loginMessage}</span>
            </div>
          )}

          {!changeMode && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              {forgotMode && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode('login');
                    setLoginError('');
                    setLoginMessage('');
                  }}
                  disabled={loginLoading}
                  style={{ fontSize: '16PX' }}
                >
                  返回已有账户登录
                </button>
              )}
              {!registerMode && !forgotMode && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode('forgot');
                    setLoginError('');
                    setLoginMessage('');
                  }}
                  disabled={loginLoading}
                  style={{ fontSize: '16PX' }}
                >
                  忘记密码
                </button>
              )}
            </div>
          )}

          <div className="row" style={{ justifyContent: 'flex-end', gap: 12 }}>
            <button type="button" className="button secondary" onClick={onClose}>
              继续免登录使用
            </button>
            <button className="button" type="submit" disabled={loginLoading}>
              {loginLoading
                ? '处理中...'
                : changeMode
                  ? '保存新密码'
                  : forgotMode
                    ? '发送重置邮件'
                    : registerMode
                      ? '创建并登录'
                      : '登录'}
            </button>
          </div>
        </form>

        {process.env.NEXT_PUBLIC_IS_GITHUB_LOGIN === 'true' && (
          <>
            <div className="login-divider" style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="muted" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                或使用
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button
              type="button"
              className="github-login-btn"
              onClick={handleGithubLogin}
              disabled={loginLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '12px 16px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg)',
                color: 'var(--text)',
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                fontSize: '16PX',
                fontWeight: 500,
                opacity: loginLoading ? 0.6 : 1
              }}
            >
              <span className="github-icon-wrap">
                <Image unoptimized alt="GitHub" src={githubImg} style={{ width: 24, height: 24 }} />
              </span>
              <span>使用 GitHub 登录</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
