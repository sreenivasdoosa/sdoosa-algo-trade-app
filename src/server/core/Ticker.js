/*
  Author: Sreenivas Doosa
*/


import _ from 'lodash';
import ZerodhaTicker from '../brokers/zerodha/ZerodhaTicker.js';
import UpstoxTicker from '../brokers/upstox/UpstoxTicker.js';
import Zerodha from '../brokers/zerodha/Zerodha.js';
import Upstox from '../brokers/upstox/Upstox.js';
import { getConfig } from '../config.js';

const config = getConfig();

class Ticker {

  constructor() {
    this.ticker = null;

    let broker = null;
    if (Zerodha.isLoggedIn() && Upstox.isLoggedIn()) {
      broker = config.preferredBrokerForTicker;
    } else if (Zerodha.isLoggedIn()) {
      broker = 'zerodha';
    } else if (Upstox.isLoggedIn) {
      broker = 'upstox';
    }

    if (_.isEmpty(broker)) {
      throw 'Ticker: no broker selected';
    }

    switch(broker) {
      case 'zerodha':
        this.ticker = new ZerodhaTicker();
        break;

      case 'upstox':
        this.ticker = new UpstoxTicker();
        break;

      default:
        throw `Ticker: broker ${broker} not supported`;
    }
  }

  registerListener(listener) {
    this.ticker.registerListener(listener);
  }

  unregisterListener(listener) {
    this.ticker.unregisterListener(listener);
  }

  registerSymbols(data) {
    this.ticker.registerSymbols(data);
  }

  unregisterSymbols(data) {
    this.ticker.unregisterSymbols(data);
  }

  connect() {
    this.ticker.connect();
  }

  disconnect() {
    this.ticker.disconnect();
  }

  isConnected() {
    this.ticker.isConnected();
  }

}
module.exports = Ticker;
