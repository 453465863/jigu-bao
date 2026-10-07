import lodash from 'lodash';

const { isFunction, isObject, isString, isNumber, isNil } = lodash;

const FIELDS = [
  'screenshotType',
  'platform',
  'code',
  'name',
  'action',
  'amount',
  'shares',
  'price',
  'nav',
  'fee',
  'tradeAt',
  'requestAt',
  'actualNavDate',
  'actualConfirmDate'
];
const TYPES = new Set(['exchange_trade', 'otc_application', 'otc_confirmation', 'holding_snapshot', 'unknown']);
const ACTIONS = new Set(['buy', 'sell', 'subscribe', 'redeem']);
const NUMBER_FIELDS = new Set(['amount', 'shares', 'price', 'nav', 'fee']);
const DATE_FIELDS = new Set(['actualNavDate', 'actualConfirmDate']);
const DATE_TIME_FIELDS = new Set(['tradeAt', 'requestAt']);
const MIN_CONFIDENCE = 0.8;

export const TRADE_SCREENSHOT_PROMPT = `你是交易截图信息提取器。只输出一个 JSON 对象，不写说明或 Markdown。
只提取截图中明确可见的一笔交易；多笔交易、截断或看不清时，相应字段用 null，不猜测。
截图类型 screenshotType 只能是 exchange_trade、otc_application、otc_confirmation、holding_snapshot、unknown。
平台 platform 仅填写截图明确显示的名称；不得输出 accountId 或推断当前账户。
字段：screenshotType, platform, code, name, action, amount, shares, price, nav, fee, tradeAt, requestAt, actualNavDate, actualConfirmDate。
action 只能是 buy、sell、subscribe、redeem 或 null。金额、份额、价格、净值、费用使用数字。
时间 tradeAt/requestAt 使用 YYYY-MM-DDTHH:mm，日期 actualNavDate/actualConfirmDate 使用 YYYY-MM-DD；缺少年份或日期时用 null。
不要把场外净值当作场内成交价，也不要推算申购确认日期。
confidence 必须给上述每个字段一个 0 到 1 的数字；null 字段用 0。`;

function parseModelOutput(value) {
  if (isObject(value)) return value;
  if (!isString(value)) throw new Error('识别器未返回 JSON 对象');
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('识别器返回了无效 JSON');
  }
  if (!isObject(parsed)) throw new Error('识别器未返回 JSON 对象');
  return parsed;
}

function validCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cleanValue(field, value) {
  if (isNil(value)) return null;
  if (field === 'screenshotType') return TYPES.has(value) ? value : null;
  if (field === 'action') return ACTIONS.has(value) ? value : null;
  if (field === 'code') return /^\d{6}$/.test(String(value).trim()) ? String(value).trim() : null;
  if (field === 'platform' || field === 'name') {
    return isString(value) && value.trim() ? value.trim().slice(0, 100) : null;
  }
  if (NUMBER_FIELDS.has(field)) {
    if (!isNumber(value) && !(isString(value) && /^\d+(?:\.\d+)?$/.test(value.trim()))) return null;
    const number = Number(value);
    return Number.isFinite(number) && (field === 'fee' ? number >= 0 : number > 0) ? number : null;
  }
  if (DATE_FIELDS.has(field)) return isString(value) && validCalendarDate(value) ? value : null;
  if (DATE_TIME_FIELDS.has(field)) {
    if (!isString(value) || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    return validCalendarDate(value.slice(0, 10)) ? value : null;
  }
  return null;
}

export function normalizeTradeScreenshotOutput(raw, screenshotHash = null) {
  const parsed = parseModelOutput(raw);
  const confidence = {};
  const draft = {};
  for (const field of FIELDS) {
    const score = Number(parsed.confidence?.[field]);
    const clean =
      Number.isFinite(score) && score >= MIN_CONFIDENCE && score <= 1 ? cleanValue(field, parsed[field]) : null;
    draft[field] = clean;
    confidence[field] = clean === null ? 0 : score;
  }
  // An uncertain type cannot be submitted as a trade. Unknown is a safe display state.
  if (!draft.screenshotType) draft.screenshotType = 'unknown';
  draft.confidence = confidence;
  draft.screenshotHash =
    isString(screenshotHash) && /^[a-f0-9]{64}$/i.test(screenshotHash) ? screenshotHash.toLowerCase() : null;
  return draft;
}

/**
 * The caller supplies an explicitly configured multimodal adapter. This module never
 * sends images, stores data, or chooses an account. The adapter receives the image and
 * prompt and must return JSON text or an object. Human confirmation follows this call.
 */
export async function recognizeTradeScreenshot({ image, recognizeImage, screenshotHash = null }) {
  if (!image) throw new Error('请先选择截图');
  if (!isFunction(recognizeImage)) throw new Error('尚未配置截图识别服务');
  const raw = await recognizeImage({ image, prompt: TRADE_SCREENSHOT_PROMPT });
  return normalizeTradeScreenshotOutput(raw, screenshotHash);
}
