/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';

class Instruments {
  
  constructor() {
    this.instruments = [];
  }

  setInstruments(data) {
    this.instruments = data;
  }

  getInstrumentToken(tradingSymbol) {
    if (_.isEmpty(tradingSymbol)) {
      return '';
    }
    const instrument = _.find(this.instruments, i => i.tradingsymbol === tradingSymbol);
    return instrument.instrument_token || '';
  }

  getTradingSymbolByInstrumentToken(instrumentToken) {
    if (_.isEmpty(instrumentToken)) {
      return '';
    }
    const instrument = _.find(this.instruments, i => i.instrument_token === instrumentToken);
    return instrument.tradingsymbol || '';
  }
}

module.exports = new Instruments(); // singleton
