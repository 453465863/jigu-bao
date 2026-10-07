import { useState, useEffect } from 'react';
import { nowInTz, formatDate } from '../lib/fundHelpers';
import { fetchShanghaiIndexDate } from '../api/fund';

/**
 * 检测当前是否为 A 股交易日
 * - 周末直接判定为非交易日
 * - 工作日通过请求上证指数最新交易时间来判断节假日
 * - 每 30 分钟自动重新检查一次
 * @returns {{ isTradingDay: boolean }}
 */
export function useTradingDay() {
  // 在市场状态确认前按休市处理，避免节假日把缓存报价误显示为“当日”数据。
  const [isTradingDay, setIsTradingDay] = useState(false);

  const checkTradingDay = async () => {
    const todayStr = formatDate();
    const now = nowInTz();
    const isWeekend = now.day() === 0 || now.day() === 6;

    // 周末直接判定为非交易日
    if (isWeekend) {
      setIsTradingDay(false);
      return;
    }

    // 工作日通过上证指数判断是否为节假日
    // 接口返回示例: v_sh000001="1~上证指数~...~20260205150000~..."
    // 第30位是时间字段
    try {
      const dateStr = await fetchShanghaiIndexDate();
      if (!dateStr) {
        setIsTradingDay(!isWeekend);
        return;
      }
      const currentStr = todayStr.replace(/-/g, '');
      if (dateStr === currentStr) {
        setIsTradingDay(true);
      } else {
        const minutes = now.hour() * 60 + now.minute();
        if (minutes >= 9 * 60 + 30) {
          setIsTradingDay(false);
        } else {
          setIsTradingDay(true);
        }
      }
    } catch (e) {
      // 行情源不可用时宁可不显示当日收益，也不能把旧报价当作今日收益。
      setIsTradingDay(false);
    }
  };

  useEffect(() => {
    checkTradingDay();
    // 每30分钟检查一次
    const timer = setInterval(checkTradingDay, 60000 * 30);
    return () => clearInterval(timer);
  }, []);

  return { isTradingDay };
}
