/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import logger from '../../logger/logger.js';
import Upstox from './Upstox.js';

//let Upstox = null;

class UpstoxTicker {

  constructor() {

    /*if (Zerodha === null) {
      Zerodha = require('./Zerodha.js');
    }*/

    this.upstoxConnect = Upstox.getUpstoxConnect();

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
    logger.info(`UpstoxTicker: registerSymbols = ${JSON.stringify(data)}`);
    const tokens = [];
    if (_.isArray(data)) {
      _.each(data, symbol => {
        tokens.push(symbol); // here the token itself is a symbol unlike zerodha case

        if (_.some(this.symbols, s => s === symbol) === false) {
          this.symbols.push(symbol);
        }
      });
    } else {
      const symbol = data;
      tokens.push(symbol);

      if (_.some(this.symbols, s => s === symbol) === false) {
        this.symbols.push(symbol);
      }
    }

    if (this.connected) {
      this.subscribe(tokens);
    }
  }

  unregisterSymbols(data) {
    logger.info(`UpstoxTicker: unregisterSymbols = ${JSON.stringify(data)}`);
    const tokens = [];
    if (_.isArray(data)) {
      _.each(data, symbol => {
        tokens.push(symbol);

        _.remove(this.symbols, s => s === symbol);

      });
    } else {
      const symbol = data;
      tokens.push(symbol);

      _.remove(this.symbols, s => s === symbol);
    }

    if (this.connected) {
      this.unsubscribe(tokens);
    }
  }

  connect() {
    if (this.upstoxConnect) {
      this.upstoxConnect.connectSocket().then(() => {
        this.onConnected();

        this.upstoxConnect.on('orderUpdate', (msg) => {

        });

        this.upstoxConnect.on('positionUpdate', (msg) => {

        });

        this.upstoxConnect.on('tradeUpdate', (msg) => {

        });

        this.upstoxConnect.on('liveFeed', (msg) => {
          this.onTicks(msg);
        });

        this.upstoxConnect.on('disconnected', (msg) => {
          logger.error(`Upstox ticker disconnected msg. ${JSON.stringify(msg)}`);
          this.onDisConnected();
        });

        this.upstoxConnect.on('error', (msg) => {
          logger.error(`Upstox ticker error msg. ${JSON.stringify(msg)}`);
          //this.onDisConnected(); //TODO need to check
        });

      }).catch(err => {
        logger.error(`Upstock ticker connect socket failed with err ${JSON.stringify(err)}`);
        this.onDisConnected();
      });
    } else {
      logger.error(`[ALERT] Upstox connect is null`);
    }
  }

  disconnect() {
    logger.info(`Upstock ticker disconnect request receievd..`);
    if (this.upstoxConnect) {
      this.upstoxConnect.closeSocket();
      this.onDisConnected();
    }
  }

  onConnected() {
    logger.info('UpStox ticker connected...');
    this.connected = true;

    this.subscribe(this.symbols);

    // inform all listeners
    _.each(this.listeners, listener => {
      if (_.isFunction(listener.onConnected)) {
        listener.onConnected();
      }
    });
  }

  onDisConnected() {
    logger.error('[ALERT] UpStox ticker disconnected...');
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
    const tokensStr = tokens.join(',');
    if (_.isEmpty(tokensStr)) {
      logger.warn(`UpStoxTicker: subscribe() no tokens received`);
      return;
    }
    logger.debug('UpStoxTicker: subscribing tokens = ' + tokensStr);

    this.upstoxConnect.subscribeFeed({
      exchange: 'NSE_EQ',
      symbol: tokensStr,
      type: 'full'
    }).then(() => {
      logger.debug('UpStoxTicker: subscribed tokens = ' + tokensStr);
    }).catch(err => {
      logger.error('UpStoxTicker: unable to subscribe token = ' + tokensStr + '. ' + JSON.stringify(err));
    });
  }

  unsubscribe(tokens) {
    const tokensStr = tokens.join(',');
    if (_.isEmpty(tokensStr)) {
      logger.warn(`UpStoxTicker: unsubscribe() no tokens received`);
      return;
    }
    logger.debug('UpStoxTicker: unsubscribing tokens = ' + tokensStr);

    this.upstoxConnect.unsubscribeFeed({
      exchange: 'NSE_EQ',
      symbol: tokensStr,
      type: 'full'
    }).then(() => {
      logger.debug('UpStoxTicker: unsubscribed tokens = ' + tokensStr);
    }).catch(err => {
      logger.error('UpStoxTicker: unable to unsubscribe token = ' + tokensStr + '. ' + JSON.stringify(err));
    });
  }

  onTicks(ticks) {
    _.each(ticks, tick => {
      const liveQuote = {
        tradingSymbol: _.toUpper(tick.symbol),
        cmp: parseFloat(tick.ltp),
        open: parseFloat(tick.open),
        close: parseFloat(tick.close),
        high: parseFloat(tick.high),
        low: parseFloat(tick.low)
      };

      _.each(this.listeners, listener => {
        if (_.isFunction(listener.onTick)) {
          listener.onTick(liveQuote);
        }
      });
    });
  }
}

module.exports = UpstoxTicker;
