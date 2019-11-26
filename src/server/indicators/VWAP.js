/*
  Author: Sreenivas Doosa
*/

import logger from '../logger/logger.js';
import { 
  roundOff 
  //formatTimestampToString 
} from '../utils/utils.js';

class VWAP {

  getVolumePrice(candle) {
    const typicalPrice = (candle.close + candle.low + candle.high) / 3;
    return typicalPrice * candle.volume;
  }

  calculate(candles = []) {
    const vWap = [];
    if (candles.length === 0) {
      logger.error(`VWAP: number of candles received 0 for VWAP calculation`);
      return vWap;
    }

    let tradeValueSum = 0;
    let volumeSum = 0;
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      tradeValueSum += this.getVolumePrice(candle);
      volumeSum += candle.volume;
      vWap.push(roundOff(tradeValueSum / volumeSum));
      //logger.debug(`VWAP: ${formatTimestampToString(candle.timestamp)} = ${vWap[i]}`);
    }
    return vWap;
  }
};

module.exports = new VWAP(); // singleton class
