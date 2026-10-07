import { isArray, isString } from 'lodash';

let fundListPromise;
let fusePromise;

const loadFundList = async () => {
  if (!fundListPromise) {
    fundListPromise = fetch('/allFund.json')
      .then((response) => {
        if (!response.ok) throw new Error('基金名单加载失败');
        return response.json();
      })
      .then((list) =>
        (isArray(list) ? list : []).filter(
          (item) => isString(item?.code) && /^\d{6}$/.test(item.code) && isString(item?.name)
        )
      )
      .catch((error) => {
        fundListPromise = null;
        throw error;
      });
  }
  return fundListPromise;
};

const isExchangeEtf = (fund) => /^[15]/.test(fund.code) && /ETF/i.test(fund.name) && !/联接/i.test(fund.name);

export async function searchTradeFunds(query, exchangeOnly = false) {
  const term = String(query || '').trim();
  if (term.length < 2) return [];
  const list = await loadFundList();
  if (/^\d{6}$/.test(term)) {
    const exact = list.find((fund) => fund.code === term);
    if (exact) return [exact];
  }
  if (!fusePromise) {
    fusePromise = import('fuse.js').then(
      ({ default: Fuse }) =>
        new Fuse(list, { keys: ['name', 'code'], threshold: 0.45, ignoreLocation: true, includeScore: true })
    );
  }
  const fuse = await fusePromise;
  const matches = fuse.search(term, { limit: 200 }).map(({ item, score }) => ({
    ...item,
    score: score ?? 1
  }));
  const scoped = exchangeOnly ? matches.filter(isExchangeEtf) : matches;
  return scoped
    .sort((left, right) => left.score - right.score)
    .slice(0, 20)
    .map(({ code, name }) => ({ code, name }));
}
