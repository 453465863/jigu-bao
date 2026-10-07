import lodash from 'lodash';

const { isString } = lodash;

const SOURCE = 'tencent_quote';
const QUOTE_TIMEOUT_MS = 10000;

const unavailable = (code) => ({
  code,
  marketPrice: null,
  quotedAt: null,
  source: null,
  status: 'unavailable'
});

// Only codes with an unambiguous exchange prefix are accepted here. Other
// funds must never silently inherit a NAV as their exchange trading price.
export const getEtfExchangeCode = (code) => {
  const normalized = String(code || '').trim();
  if (!/^\d{6}$/.test(normalized)) return null;
  if (/^(50|51|56|58)/.test(normalized)) return `sh${normalized}`;
  if (/^(15|16)/.test(normalized)) return `sz${normalized}`;
  return null;
};

export const parseTencentEtfQuote = (code, raw) => {
  const fallback = unavailable(code);
  if (!isString(raw)) return fallback;
  const fields = raw.split('~');
  if (fields.length < 31 || fields[2] !== code) return fallback;

  const marketPrice = Number(fields[3]);
  const stamp = String(fields[30] || '');
  if (!Number.isFinite(marketPrice) || marketPrice <= 0 || !/^\d{14}$/.test(stamp)) return fallback;

  const year = Number(stamp.slice(0, 4));
  const month = Number(stamp.slice(4, 6));
  const day = Number(stamp.slice(6, 8));
  const hour = Number(stamp.slice(8, 10));
  const minute = Number(stamp.slice(10, 12));
  const second = Number(stamp.slice(12, 14));
  if (year < 2000 || hour > 23 || minute > 59 || second > 59) return fallback;
  const checked = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    checked.getUTCFullYear() !== year ||
    checked.getUTCMonth() + 1 !== month ||
    checked.getUTCDate() !== day ||
    checked.getUTCHours() !== hour ||
    checked.getUTCMinutes() !== minute ||
    checked.getUTCSeconds() !== second
  ) {
    return fallback;
  }

  const quotedAt = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}+08:00`;

  return { code, marketPrice, quotedAt, source: SOURCE, status: 'available' };
};

/** Read an ETF's exchange price from the Tencent quote provider already used by fund.js. */
export const fetchEtfQuote = (inputCode) => {
  const code = String(inputCode || '').trim();
  const exchangeCode = getEtfExchangeCode(code);
  if (!exchangeCode || typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(unavailable(code));
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    const variable = `v_${exchangeCode}`;
    let settled = false;
    let timer;
    const finish = (quote) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.remove();
      resolve(quote);
    };

    // Remove a previous global response so a failed request cannot reuse stale data.
    window[variable] = undefined;
    script.onload = () => finish(parseTencentEtfQuote(code, window[variable]));
    script.onerror = () => finish(unavailable(code));
    timer = setTimeout(() => finish(unavailable(code)), QUOTE_TIMEOUT_MS);
    script.src = `https://qt.gtimg.cn/q=${exchangeCode}&_t=${Date.now()}`;
    document.body.appendChild(script);
  });
};
