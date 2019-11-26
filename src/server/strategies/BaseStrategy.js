/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import async from 'async';
import { getStrategies } from '../config.js';
import {
  parseTimestamp,
  isMarketClosedForTheDay,
  isMarketOpen,
  getMarketStartTime,
  getMarketEndTime,
  getIntradaySquareOffTime,
  areCandlesUptoDate,
  formatTimestampToString,
  removeLatestUnclosedCandle
} from '../utils/utils.js';
import logger from '../logger/logger.js';
import HistoryAPIs from '../core/HistoryAPIs.js';
import Zerodha from '../brokers/zerodha/Zerodha.js';
import Upstox from '../brokers/upstox/Upstox.js';

const strategies = getStrategies();

class BaseStrategy {

  constructor(name) {
    this.name = name;

    this.strategy = _.find(strategies, s => s.name === name);
    if (this.strategy) {
      
      logger.info(`---- strategy ${this.name} details => ${JSON.stringify(this.strategy)} ----`);
      console.log(`---- strategy ${this.name} details => `, this.strategy);

      this.strategyStartTime = parseTimestamp(this.strategy.startTime);
      this.stragyStopTime = parseTimestamp(this.strategy.stopTime);

      this.stocks = _.get(this.strategy, 'stocks', []);
      this.candlesInterval = _.get(this.strategy, 'candlesInterval', 5);
      this.traceCandlesInterval = _.get(this.strategy, 'traceCandlesInterval', 5);

    } else {
      throw `strategy ${name} not configured`;
    }

    this.process = this.process.bind(this);

    this.stocksCache = [];
  }

  isEnabled() {
    return _.get(this.strategy, 'enabled', false);
  }

  getName() {
    return this.name;
  }

  getCandlesInterval() {
    return this.candlesInterval;
  }

  getTraceCandlesInterval() {
    return this.traceCandlesInterval;
  }

  start() {

    if (!this.isEnabled()) {
      logger.warn(`${this.name}: Not running strategy as it is not enabled.`);
      return;
    }

    if (this.isRunning) {
      logger.warn(`${this.name}: The strategy is already running.`);
      return;
    }

    logger.info(`${this.name}: starting the stragey...`);
    if (isMarketClosedForTheDay()) {
      logger.info(`${this.name}: market closed for the day hence exiting the strategy`);
      return;
    }

    // wait till market opens
    if (isMarketOpen() === false) {
      logger.info(`${this.name} market not yet opened. so waiting...`);
      const now = new Date();
      const waitTimeInMillis = getMarketStartTime().getTime() - now.getTime();
      setTimeout(() => {
        logger.info(`${this.name}: market just opened..`);
        this.run();

      }, waitTimeInMillis);
    } else {
      this.run();
    }

  }

  stop() {
    logger.warn(`${this.name}: Request received to stop the strategy.. Wait for at most 30 seconds to exit..`);
    this.stopRequested = true;
    this.isRunning = false;
  }

  run() {
    
    this.isRunning = true;

    const processInLoop = () => {
      if (this.stopRequested === true) {
        logger.warn(`${this.name}: Exiting the strategy as stop signal received`);
        return;
      }

      let now = new Date();
      if (now > getIntradaySquareOffTime()) {
        logger.warn(`${this.name}: Exiting the strategy as intraday square off time reached`);
        this.stop();
        return;
      }

      const waitAndProcess = () => {
        now = new Date();
        let waitTimeInSeconds = 30 - (now.getSeconds() % 30);
        setTimeout(processInLoop, waitTimeInSeconds * 1000);
      };

      this.process().then(() => {
        waitAndProcess();

      }).catch(err => {
        logger.error(`${this.name}: Caught with error in process. ${JSON.stringify(err)}`);
        waitAndProcess();

      });
    };

    // first fetch prev day data and then start actual process
    this.fetchPrevDayData().then(() => {
      logger.info(`${this.name}: fetching prev day data done.`);
      processInLoop();
    });
  }

  process() {
    // Override the logic in each sub class that is derived from this BaseStragey class

    // NOTE: This function should return a promise
  }

  shouldPlaceTrade(tradeSignal, liveQuote) {
    /*
     Override the logic in each sub class that is derived from this BaseStragey class
     and mandatorily call the super class function from derived class as super.shouldPlaceTrade(tradeSignal, liveQuote)
    */
    if ((tradeSignal.broker === 'zerodha' && !Zerodha.isLoggedIn()) ||
      (tradeSignal.broker === 'upstox' && !Upstox.isLoggedIn())) {
      logger.debug(`${this.name} : ${tradeSignal.tradingSymbol} not placing the trade for ${tradeSignal.broker} as user not logged into the broker`);
      return false;
    }
    return true;
  }

  getCandles(tradingSymbol) {
    const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
    return data ? (data.candles || []) : [];
  }

  getTraceCandles(tradingSymbol) {
    const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
    return data ? (data.traceCandles || []) : [];
  }

  fetchCandlesHistory() {
    const from = getMarketStartTime();
    const to = getMarketEndTime();

    return new Promise((resolve, reject) => {
      async.series(_.map(this.stocks, tradingSymbol => {
        return (callback) => {
          let candles = null;
          const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
          if (data) {
            candles = data.candles;
          }

          if (areCandlesUptoDate(candles, this.candlesInterval)) {
            return callback(null, { data, tradingSymbol });
          }

          HistoryAPIs.fetchHistory(tradingSymbol, this.candlesInterval, from, to).then(respCandles => {
            candles = respCandles;

            if (!candles || candles.length === 0) {
              logger.error(`${this.name}: ${tradingSymbol} No candles fetched.`);
              return callback(null, { data, tradingSymbol, error: 'No candles fetched' });
            }

            removeLatestUnclosedCandle(candles, this.candlesInterval);
            logger.debug(`${this.name}: ${tradingSymbol} candles = ${candles.length}, interval=${this.candlesInterval}, last candle timestamp =  ${formatTimestampToString(candles[candles.length - 1].timestamp)}`);

            if (!data) {
              data = {
                tradingSymbol: tradingSymbol,
                candles: candles
              };
              this.stocksCache.push(data);

            } else {
              data.candles = candles;
            }
            callback(null, { data, tradingSymbol });

          }).catch(err => {
            logger.error(`${this.name}: error while fetching candles history data for ${tradingSymbol}. ${JSON.stringify(err)}`);
            callback(null, { data, tradingSymbol, error: err });
          });
        };
      }), (err, results) => {
        _.each(results, result => {
          if (result.error) {
            logger.error(`${this.name}: fetchCandlesHistory: error while fetching candles for ${result.tradingSymbol}`);
          }
        });
        logger.debug(`${this.name}: fetchCandlesHistory(): done.`);
        resolve(); // resolving the promise after fetching candles for all stocks
      });
    });
  }

  fetchTraceCandlesHistory() {
    const from = getMarketStartTime();
    const to = getMarketEndTime();

    // TODO: consider only signal generated stocks instead of this.stocks
    return new Promise((resolve, reject) => {
      async.series(_.map(this.stocks, tradingSymbol => {
        return (callback) => {
          const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
          if (!data) {
            return callback(null, { data: null, tradingSymbol });
          }

          this.fetchTradeCandlesHistoryOfPrevDays(data).then(prevDayCandles => {
            data.traceCandlesPrevDays = prevDayCandles;

            const now = new Date();
            if (data.lastTraceCandlesFetchTime && now - data.lastTraceCandlesFetchTime <= 25 * 1000) {
              if (data.traceCandles && areCandlesUptoDate(data.traceCandles, this.traceCandlesInterval)) {
                return callback(null, { data, tradingSymbol });
              }
            }

            HistoryAPIs.fetchHistory(tradingSymbol, this.traceCandlesInterval, from, to).then(candles => {

              data.lastTraceCandlesFetchTime = new Date();

              if (!candles || candles.length === 0) {
                logger.error(`${this.name}: ${tradingSymbol} No trace candles fetched..`);
                return callback(null, { data, tradingSymbol, error: 'No trace candles fetched' });
              }

              logger.debug(`${this.name}: ${tradingSymbol} tradeCandles = ${candles.length}, interval=${this.traceCandlesInterval}, last candle timestamp =  ${formatTimestampToString(candles[candles.length - 1].timestamp)}`);

              if (data.traceCandlesPrevDays && data.traceCandlesPrevDays.length > 0) {
                data.traceCandles = _.concat([], data.traceCandlesPrevDays, data.candles);
              } else {
                data.traceCandles = candles;
              }
              callback(null, { data, tradingSymbol });
            });
          }).catch(err => {
            logger.error(`${this.name}: Error while fetching trace candles of prev days, Error: ${JSON.stringify(err)}`);
            callback(null, { data, tradingSymbol, error: err });
          });
        };
      }), (err, results) => {
        _.each(results, result => {
          if (result.error) {
            logger.error(`${this.name}: fetchTraceCandlesHistory: error while fetching candles for ${result.tradingSymbol}`);
          }
        });
        logger.debug(`${this.name}: fetchTraceCandlesHistory(): done.`);
        resolve(); // resolving the promise after fetching candles for all stocks
      });
    });
  }

  fetchTradeCandlesHistoryOfPrevDays(data) {
    return new Promise((resolve, reject) => {
      if (_.isEmpty(data)) {
        return resolve([]);
      }

      // for calculating ATR indicator for trailing SL we need more data i.e. prev day candles
      const minCandlesRequiredForTrail = 100; // NOTE: taking the assumption of period value not more than 100
      if (data.traceCandlesPrevDays && data.traceCandlesPrevDays.length >= minCandlesRequiredForTrail) {
        // Dont call API again if we have enough candles one time call is enough as the prev days data is fixed every time we call the API
        return resolve(data.traceCandlesPrevDays);
      }

      const from = new Date(getMarketStartTime());
      const to = new Date(getMarketEndTime());

      from.setDate(from.getDate() - 7); // in case of upstox max 7 days for intraday data hence 7 is set here
      to.setDate(to.getDate() - 1);

      HistoryAPIs.fetchHistory(data.tradingSymbol, this.traceCandlesInterval, from, to).then(candles => {
        if (!candles || candles.length === 0) {
          logger.error(`${this.name}: ${data.tradingSymbol} No prev day trace candles fetched.`);
          return resolve(data.traceCandlesPrevDays || []);
        }

        logger.info(`${this.name}: ${data.tradingSymbol} prev day trace candles = ${candles.length}`);
        data.traceCandlesPrevDays = candles;

        resolve(candles);

      }).catch(err => {
        logger.error(`${this.name}: error while fetching trade candles history data of prev days for ${data.tradingSymbol}. ${JSON.stringify(err)}`);
        reject(err);
      });
    });
  }

  fetchPrevDayData() {
    // this function fetch prev day data like ohlc and volume and stores in cache, it should be called only once ideally when the strategy starts
    const from = new Date(getMarketStartTime());
    const to = new Date(getMarketEndTime());

    from.setDate(from.getDate() - 10); // fetch 10 days data but consider only the last day (previous trading day) 
    to.setDate(to.getDate() - 1);

    return new Promise((resolve, reject) => {
      async.series(_.map(this.stocks, tradingSymbol => {
        return (callback) => {
          HistoryAPIs.fetchHistory(tradingSymbol, 'day', from, to).then(candles => {
            if (!candles || candles.length === 0) {
              logger.error(`${this.name}: ${data.tradingSymbol} Not able to fetch prev day data as no candles found.`);
              return callback(null, { tradingSymbol, error: 'Could not fetch prev day data'});
            }
            logger.debug(`${this.name}: ${tradingSymbol}: days candles fetched = ${candles.length}`);

            // get the last candle (i.e. prev trading day candle)
            const prevDayCandle = candles[candles.length - 1];
            logger.info(`${this.name}: ${tradingSymbol}: prev day data = ${JSON.stringify(prevDayCandle)}`);
            let data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
            if (!data) {
              data = {
                tradingSymbol: tradingSymbol,
                prevDayData: prevDayCandle
              };
              this.stocksCache.push(data);
            } else {
              data.prevDayData = prevDayCandle;
            }
            callback(null, { data, tradingSymbol });
          }).catch(err => {
            callback(null, { data: null, tradingSymbol, error: err });
          });
        };
      }), (err, results) => {
        _.each(results, result => {
          if (result.error) {
            logger.error(`${this.name}: fetchPrevDayData: error while fetching previous day data for ${result.tradingSymbol}`);
          }
        });
        resolve(); // resolving the promise after fetching candles for all stocks
      });
    });
  }
}

module.exports = BaseStrategy;
