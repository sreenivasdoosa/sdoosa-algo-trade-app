/*
  Author: Sreenivas Doosa
*/
import _ from 'lodash';
import Upstox from './Upstox.js';
import { formatDateToDDMMYYYY } from '../../utils/utils.js';

class UpstoxHistoryAPIs {

  constructor() {
    this.upstoxConnect = Upstox.getUpstoxConnect();
  }

  fetchHistory(tradingSymbol, interval, from, to) {

    const params = {
      exchange: 'NSE_EQ',
      symbol: tradingSymbol,
      start_date: formatDateToDDMMYYYY(from),
      end_date: formatDateToDDMMYYYY(to),
      format: 'json',
      interval: _.isString(interval) ? `1${_.toUpper(interval)}` : `${interval}MINUTE` // for days/weeks its like 1DAY, 1WEEK
    };
    //console.log('UpstoxHistoryAPIs: fetchHistory input params => ', params);

    if (this.upstoxConnect) {
      return this.upstoxConnect.getOHLC(params).then(resp => {
        const candles = resp.data || [];
        _.each(candles, candle => {
          candle.timestamp = new Date(parseInt(candle.timestamp));
          candle.open = parseFloat(candle.open);
          candle.high = parseFloat(candle.high);
          candle.low = parseFloat(candle.low);
          candle.close = parseFloat(candle.close);
          candle.volume = parseInt(candle.volume);
        });
        return candles;
      });
    } else {
      return Promise.reject(`UpstoxHistoryAPIs: cannot fetch history as upstoxConnect is null`);
    }
  }

}

module.exports = new UpstoxHistoryAPIs(); // singleton class
