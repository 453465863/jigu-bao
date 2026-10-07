import { isArray, isPlainObject, isString } from 'lodash';

// The legacy account owns the existing unscoped data. Its ID must never change.
export const LEGACY_ACCOUNT_ID = 'legacy';

export const DEFAULT_ACCOUNT = Object.freeze({
  id: LEGACY_ACCOUNT_ID,
  name: '支付宝',
  type: 'real',
  platform: '支付宝'
});

export const GOLD_SUN_ACCOUNT = Object.freeze({
  id: 'gold-sun-virtual-etf',
  name: '金太阳（ETF）',
  type: 'virtual',
  platform: '金太阳'
});

const cleanText = (value, maxLength) => (isString(value) ? value.trim().slice(0, maxLength) : '');

export const normalizeAccount = (value) => {
  if (!isPlainObject(value)) return null;
  const id = cleanText(value.id, 80);
  const name = cleanText(value.name, 40);
  if (!id || !name) return null;
  return {
    id,
    name,
    type: ['real', 'virtual', 'unclassified'].includes(value.type) ? value.type : 'unclassified',
    platform: cleanText(value.platform, 40)
  };
};

export const normalizeAccounts = (value) => {
  const source = isArray(value) ? value : [];
  const seen = new Set([LEGACY_ACCOUNT_ID]);
  const legacy = source.find((item) => item?.id === LEGACY_ACCOUNT_ID);
  const normalizedLegacy = normalizeAccount(legacy);
  const result = [{ ...DEFAULT_ACCOUNT, ...(normalizedLegacy || {}), id: LEGACY_ACCOUNT_ID }];

  for (const item of source) {
    const account = normalizeAccount(item);
    if (!account || seen.has(account.id)) continue;
    seen.add(account.id);
    result.push(account);
  }
  return result;
};

export const getAccountsFromSettings = (settings) => normalizeAccounts(ensureInitialAccountSettings(settings).accounts);

export const ensureInitialAccountSettings = (settings) => {
  const source = isPlainObject(settings) ? settings : {};
  if (source.accountSeededForUser && isArray(source.accounts)) return source;

  const accounts = normalizeAccounts(source.accounts).map((account) =>
    account.id === LEGACY_ACCOUNT_ID && account.name === '现有账户' ? { ...DEFAULT_ACCOUNT } : account
  );
  if (!accounts.some((account) => account.id === GOLD_SUN_ACCOUNT.id || account.platform === '金太阳')) {
    accounts.push({ ...GOLD_SUN_ACCOUNT });
  }
  return { ...source, accounts, accountSeededForUser: true };
};

export const withAccountsInSettings = (settings, accounts) => ({
  ...(isPlainObject(settings) ? settings : {}),
  accounts: normalizeAccounts(accounts),
  accountSeededForUser: true
});
