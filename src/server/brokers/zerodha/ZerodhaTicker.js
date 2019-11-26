/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import { KiteTicker } from 'kiteconnect';
import logger from '../../logger/logger.js';
import Instruments from './Instruments.js';

let Zerodha = null;

class ZerodhaTicker {

  constructor() {

    if (Zerodha === null) {
      Zerodha = require('./Zerodha.js');
    }

    const apiKey = Zerodha.getAPIKey();
    const session = Zerodha.getSession();

    this.ticker = new KiteTicker({
      api_key: apiKey,
      access_token: session.access_token
    });

    this.symbols = [];
    this.listeners = [];

    this.onConnected = this.onConnected.bind(this);
    this.onDisConnected = this.onDisConnected.bind(this);
    this.onTicks = this.onTicks.bind(this);
  }

  registerListener(listener) {
    if (_.isEmpty(listener) === false) {
      this.listeners.push(listener);
    }
  }

  unregisterListener(listener) {
    if (_.isEmpty(listener) === false) {
      this.listeners = _.filter(this.listeners, l => l !== listener);
    }
  }

  registerSymbols(data) { // input can be a string or an array of strings
    const tokens = [];
    if (_.isArray(data)) {
      _.each(data, symbol => {
        const token = Instruments.getInstrumentToken(symbol);
        tokens.push(token);

        if (_.some(this.symbols, s => s === symbol) === false) {
          this.symbols.push(symbol);
        }
      });
    } else {
      const symbol = data;
      const token = Instruments.getInstrumentToken(symbol);
      tokens.push(token);

      if (_.some(this.symbols, s => s === symbol) === false) {
        this.symbols.push(symbol);
      }
    }

    if (this.connected) {
      this.subscribe(tokens);
    }
  }

  unregisterSymbols(data) {
    const tokens = [];
    if (_.isArray(data)) {
      _.each(data, symbol => {
        const token = Instruments.getInstrumentToken(symbol);
        tokens.push(token);

        _.remove(this.symbols, s => s === symbol);

      });
    } else {
      const symbol = data;
      const token = Instruments.getInstrumentToken(symbol);
      tokens.push(token);

      _.remove(this.symbols, s => s === symbol);
    }

    if (this.connected) {
      this.unsubscribe(tokens);
    }
  }

  connect() {
    this.ticker.autoReconnect(true, 10, 5); // 10 retries with interval of 5 seconds
    this.ticker.connect();
    this.ticker.on('ticks', this.onTicks);
    this.ticker.on('connect', this.onConnected);
    
    this.ticker.on('noreconnect', () => {
      logger.error('Zerodha ticker failed to reconnect after maxim re-attemtps');
      this.onDisConnected();
    });

    this.ticker.on("reonnecting", function (reconnectInterval, reconnections) {
      logger.warn(`Zerodha ticker: Reconnecting: attempts ${reconnections} and interval ${reconnectInterval}`);
    });
  }

  disconnect() {
    logger.info(`Zerodha ticker disconnect request receievd..`);
    if (this.ticker) {
      this.ticker.disconnect();
      this.onDisConnected();
    }
  }

  onConnected() {
    logger.info('Zerodha ticker connected...');
    this.connected = true;

    const tokens = [];
    _.each(this.symbols, symbol => {
      const token = Instruments.getInstrumentToken(symbol);
      tokens.push(token);
    });

    this.subscribe(tokens);

    // inform all listeners
    _.each(this.listeners, listener => {
      if (_.isFunction(listener.onConnected)) {
        listener.onConnected();
      }
    });
  }

  onDisConnected() {
    logger.error('[ALERT] Zerodha ticker disconnected...');
    this.connected = false;

    // inform all listeners
    _.each(this.listeners, listener => {
      if (_.isFunction(listener.onDisConnected)) {
        listener.onDisConnected();
      }
    });
  }

  isConnected() {
    return this.connected;
  }

  subscribe(tokens) {
    // convert strings (if any) to integers
    tokens = _.map(tokens, t => _.toInteger(t));

    logger.debug('zerodha subscribe tokens = ' + tokens.join(','));
    this.ticker.subscribe(tokens);
    this.ticker.setMode(this.ticker.modeFull, tokens);
  }

  unsubscribe(tokens) {
    // convert strings (if any) to integers
    tokens = _.map(tokens, t => _.toInteger(t));

    logger.debug('zerodha unsubscribe tokens = ' + tokens.join(','));
    this.ticker.unsubscribe(tokens);
  }

  onTicks(ticks) {
    console.log('zerodha ticks => ', ticks);

    _.each(ticks, tick => {

      const liveQuote = {
        tradingSymbol: Instruments.getTradingSymbolByInstrumentToken(tick.instrument_token),
        cmp: parseFloat(tick.last_price),
        open: parseFloat(tick.ohlc.open),
        high: parseFloat(tick.ohlc.high),
        low: parseFloat(tick.ohlc.low),
        close: parseFloat(tick.ohlc.close),
        volume: parseInt(tick.volume),
        averagePrice: parseFloat(tick.average_price),
        change: parseFloat(tick.change)
      };

      _.each(this.listeners, listener => {
        if (_.isFunction(listener.onTick)) {
          listener.onTick(liveQuote);
        }
      });
    });
  }
}

module.exports = ZerodhaTicker;
