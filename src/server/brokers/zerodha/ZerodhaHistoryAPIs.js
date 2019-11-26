/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import Zerodha from './Zerodha.js';
import Instruments from './Instruments.js';

const zerodhaCandleIntervalMappings = [
  {
    interval: 1,
    key: 'minute'
  }, {
    interval: 3,
    key: '3minute'
  }, {
    interval: 5,
    key: '5minute'
  }, {
    interval: 10,
    key: '10minute'
  }, {
    interval: 15,
    key: '15minute'
  }, {
    interval: 30,
    key: '30minute'
  }, {
    interval: 60,
    key: '60minute'
  }
];

const getZerodhaCandleIntervalString = (interval = 5) => {
  const entry = _.find(zerodhaCandleIntervalMappings, entry => entry.interval === interval);
  return entry ? entry.key : '5minute';
};

class ZerodhaHistoryAPIs {

  constructor() {
    this.kiteConnect = Zerodha.getKiteConnect();
  }

  fetchHistory(tradingSymbol, interval, from, to) {
    const token = Instruments.getInstrumentToken(tradingSymbol);
    let intervalStr = '';
    if (_.isString(interval)) { // if input is like 'day', '3minute' etc.
      intervalStr = interval;
    } else { // if input is an integer like  1, 3, 5, 10..
      intervalStr = getZerodhaCandleIntervalString(interval);
    }

    return this.kiteConnect.getHistoricalData(token, intervalStr, from, to).then(candles => {
      _.each(candles, candle => {
        candle.timestamp = candle.date;
      });
      return candles;
    });
  }
  
}

module.exports = new ZerodhaHistoryAPIs(); // singleton class
