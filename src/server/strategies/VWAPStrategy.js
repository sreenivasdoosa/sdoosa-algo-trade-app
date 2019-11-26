/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import uuid from 'uuid/v4';
import BaseStrategy from './BaseStrategy.js';
import VWAP from '../indicators/VWAP.js';
import TradeManager from '../core/TradeManager.js';
import {
  percentageChange,
  roundToValidPrice,
  calculateSharesWithRiskFactor,
  shouldPlaceTrade,
  formatTimestampToString
} from '../utils/utils.js';
import logger from '../logger/logger.js';

class VWAPtrategy extends BaseStrategy {

  constructor() {
    super('VWAP');

    this.unQualifiedStocks = [];
    this.topGainersLosers = [];
  }

  process() {

    if (this.maxTradesReached) {
      return Promise.resolve();
    }

    return this.fetchCandlesHistory().then(() => {
      
      const now = new Date();
      if (now < this.strategyStartTime) {
        return;
      }

      if (this.topGainersLosers.length === 0) {
        this.topGainersLosers = this.getTopGainersLosers(2); // passing 2 for getting top 2 gainers and top 2 losers    
        _.each(this.topGainersLosers, tgl => {
          logger.info(`${this.name}: process: TopGainerLoser ${tgl.tradingSymbol} change = ${tgl.change}`);
        });
      }

      _.each(this.topGainersLosers, tgl => {
        const tradingSymbol = tgl.tradingSymbol;
        try {
          const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
          if (!data || !data.candles || data.candles.lenth < 1 || data.isTradeSignalGenerated) {
            return;
          }

          if (_.some(this.unQualifiedStocks, uqs => uqs === tradingSymbol)) {
            return;
          }

          // stock should move at least 1.0% at the closing of first 15 minutes
          if (Math.abs(tgl.change) < 1.0) {
            logger.info(`${this.name}: process: Ignoring ${tradingSymbol} as the change is less ${tgl.change}`);
            if (_.some(this.unQualifiedStocks, uqs => uqs === tradingSymbol) === false) {
              this.unQualifiedStocks.push(tradingSymbol);
              return;
            }
          }

          // Ignore if stocks gaps up/down by more than 4.0%
          const firstCandle = data.candles[0];
          if (data.gapChange === undefined) {
            data.gapChange = percentageChange(firstCandle.open, data.prevDayData.close);
            if (Math.abs(data.gapChange) > 4.0) {
              logger.info(`${this.name}: process: Ignoring ${tradingSymbol} as gap change is more, gap change = ${data.gapChange}`);
              if (_.some(this.unQualifiedStocks, uqs => uqs === tradingSymbol) === false) {
                this.unQualifiedStocks.push(tradingSymbol);
                return;
              }
            }
          }

          const vwap = VWAP.calculate(data.candles);

          let longDecisionCandle = null;
          let shortDecisionCandle = null;

          for (let i = 0; i < data.candles.length; i++) {
            const candle = data.candles[i];

            if (vwap[i] >= candle.low && vwap[i] <= candle.high) { // candle touching vwap line
              if (longDecisionCandle === null && candle.close > vwap[i]) {
                longDecisionCandle = candle;
                continue;
              }
              if (shortDecisionCandle === null && candle.close < vwap[i]) {
                shortDecisionCandle = candle;
                continue;
              }
            }

            if (longDecisionCandle && shortDecisionCandle) {
              break;
            }
          }

          if (longDecisionCandle === null && shortDecisionCandle === null) {
            return;
          }

          if (longDecisionCandle) {
            logger.info(`${this.name}: process: ${tradingSymbol} longDecisionCandle = ${formatTimestampToString(longDecisionCandle.timestamp)}`);
          }
          if (shortDecisionCandle) {
            logger.info(`${this.name}: process: ${tradingSymbol} shortDecisionCandle = ${formatTimestampToString(shortDecisionCandle.timestamp)}`);
          }
          
          const brokers = _.get(this.strategy, 'brokers', []);
          if (brokers.length === 0) {
            logger.error(`${this.name}: generateTradeSignals: no brokers configured for this strategy..`);
            return;
          }

          _.each(brokers, broker => {
            this.generateTradeSignals(data, longDecisionCandle, shortDecisionCandle, broker);
            logger.info(`${this.name} ${tradingSymbol} Trade signals generated for broker ${broker}`);
          });

        } catch(err) {
          console.log('error ====> ', err);
        }
      });
    });
  }

  generateTradeSignals(data, longDecisionCandle, shortDecisionCandle, broker) {

    const tm = TradeManager.getInstance();

    if (!data.buyTradeSignal) {
      data.buyTradeSignal = {};
    }
    if (!data.sellTradeSignal) {
      data.sellTradeSignal = {};
    }

    let ts1 = data.buyTradeSignal[broker];
    let ts2 = data.sellTradeSignal[broker];

    const SL_PERCENTAGE = _.get(this.strategy, 'slPercentage', 0.6);
    const TARGET_PERCENTAGE = _.get(this.strategy, 'targetPercentage', 1.0);

    let enableRiskManagement = _.get(this.strategy, 'enableRiskManagement', false);

    let TOTAL_CAPITAL, CAPITAL_PER_TRADE, RISK_PERCENTAGE_PER_TRADE, MARGIN = 1;
    if (enableRiskManagement) {
      TOTAL_CAPITAL = parseInt(_.get(this.strategy, 'withRiskManagement.totalCapital', 1000));
      RISK_PERCENTAGE_PER_TRADE = parseFloat(_.get(this.strategy, 'withRiskManagement.riskPercentagePerTrade', 1.0));

    } else {
      CAPITAL_PER_TRADE = parseInt(_.get(this.strategy, 'withoutRiskManagement.capitalPerTrade', 1000));
      MARGIN = parseInt(_.get(this.strategy, 'withoutRiskManagement.margin', 1));
    }

    if (longDecisionCandle && !ts1) {
      ts1 = {};
      ts1.broker = broker;
      ts1.placeBracketOrder = false;
      ts1.placeCoverOrder = false;
      ts1.strategy = this.getName();
      ts1.tradingSymbol = data.tradingSymbol;
      ts1.isBuy = true; // long signal
      ts1.trigger = longDecisionCandle.high;
      ts1.stopLoss = roundToValidPrice(longDecisionCandle.high - longDecisionCandle.high * SL_PERCENTAGE / 100);
      ts1.target = roundToValidPrice(longDecisionCandle.high + longDecisionCandle.high * TARGET_PERCENTAGE / 100);

      if (enableRiskManagement) {
        ts1.quantity = calculateSharesWithRiskFactor(TOTAL_CAPITAL, ts1.trigger, ts1.stopLoss, RISK_PERCENTAGE_PER_TRADE);
      } else {
        ts1.quantity = parseInt((CAPITAL_PER_TRADE * MARGIN) / ts1.trigger);
      }

      ts1.considerOppositeTrade = false;
      ts1.timestamp = longDecisionCandle.timestamp;
      ts1.tradeCutOffTime = this.strategyStopTimestamp;
      ts1.isTrailingSL = false;
      ts1.placeMarketOrderIfOrderNotFilled = false;
      ts1.changeEntryPriceIfOrderNotFilled = true;
      ts1.limitOrderBufferPercentage = 0.05;

      const oldts = tm.getTradeSignalOfSame(ts1);
      if (oldts) {
        ts1.correlationID = oldts.correlationID;
      } else if (ts2) {
        ts1.correlationID = ts2.correlationID;
      } else {
        ts1.correlationID = uuid();
      }
      logger.info(`${this.name}: ${data.tradingSymbol} LONG trade signal generated for ${broker}`);
    }

    if (shortDecisionCandle && !ts2) {
      ts2 = {};
      ts2.broker = broker;
      ts2.placeBracketOrder = false;
      ts2.placeCoverOrder = false;
      ts2.strategy = this.getName();
      ts2.tradingSymbol = data.tradingSymbol;
      ts2.isBuy = false; // short signal
      ts2.trigger = shortDecisionCandle.low;
      ts2.stopLoss = roundToValidPrice(shortDecisionCandle.low + shortDecisionCandle.low * SL_PERCENTAGE / 100);
      ts2.target = roundToValidPrice(shortDecisionCandle.low - shortDecisionCandle.low * TARGET_PERCENTAGE / 100);

      if (enableRiskManagement) {
        ts2.quantity = calculateSharesWithRiskFactor(TOTAL_CAPITAL, ts2.trigger, ts2.stopLoss, RISK_PERCENTAGE_PER_TRADE);
      } else {
        ts2.quantity = parseInt((CAPITAL_PER_TRADE * MARGIN) / ts2.trigger);
      }

      ts2.considerOppositeTrade = false;
      ts2.timestamp = shortDecisionCandle.timestamp;
      ts2.tradeCutOffTime = this.strategyStopTimestamp;
      ts2.isTrailingSL = false;
      ts2.placeMarketOrderIfOrderNotFilled = false;
      ts2.changeEntryPriceIfOrderNotFilled = true;
      ts2.limitOrderBufferPercentage = 0.05;

      const oldts = tm.getTradeSignalOfSame(ts2);
      if (oldts) {
        ts2.correlationID = oldts.correlationID;
      } else if (ts1) {
        ts2.correlationID = ts1.correlationID;
      } else {
        ts2.correlationID = uuid();
      }
      logger.info(`${this.name} : ${data.tradingSymbol} SHORT trade signal generated for ${broker}`);
    }

    data.buyTradeSignal[broker] = ts1;
    data.sellTradeSignal[broker] = ts2;

    if (ts1 && ts2) {
      data.isTradeSignalGenerated = true;
    }

    if (ts1 && tm.getTradeSignalOfSame(ts1) === null) {
      tm.addTradeSignal(ts1);
    }
    if (ts2 && tm.getTradeSignalOfSame(ts2) === null) {
      tm.addTradeSignal(ts2);
    }
  }

  shouldPlaceTrade(tradeSignal, liveQuote) {

    if (super.shouldPlaceTrade(tradeSignal, liveQuote) === false) {
      return false;
    }
    
    const cmp = liveQuote.cmp;
    if (shouldPlaceTrade(tradeSignal, cmp) === false) {
      return false;
    }

    const tm = TradeManager.getInstance();
    if (tm.isTradeAlreadyPlaced(tradeSignal, this.getName())) {
      return false;
    }

    let isReverseTrade = false;
    const oppTradeSignal = tm.getOppositeTradeSignal(tradeSignal);
    if (oppTradeSignal && oppTradeSignal.isTriggered) {
      if (!oppTradeSignal.considerOppositeTrade) {
        return false;
      } else {
        isReverseTrade = true;
      }
    }

    if (isReverseTrade === false) {
      if (_.get(this.strategy, 'enableRiskManagement', false) === true) {
        const MAX_TRADES_PER_DAY = parseInt(_.get(this.strategy, 'withRiskManagement.maxTrades', 1));
        const numberOfTradesPlaced = tm.getNumberOfStocksTradesPlaced(this.getName());
        if (numberOfTradesPlaced >= MAX_TRADES_PER_DAY) {

          tm.disableTradeSignal(tradeSignal);
          this.maxTradesReached = true;
          return false;
        }
      }
    }

    return true;
  }

  getTopGainersLosers(LIMIT = 2) { // default 2 top gainers and top 2 losers
    const gainers = [];
    const losers = [];
    _.each(this.stocks, tradingSymbol => {
      const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
      if (data && data.candles && data.candles.length > 0 && data.prevDayData) {
        // check first candle close with previous day close
        const firstCandle = data.candles[0];
        const change = percentageChange(firstCandle.close, data.prevDayData.close);
        console.log(`-- getTopGainersLosers ${tradingSymbol}  change = ${change}`);
        if (change > 0) {
          gainers.push({
            tradingSymbol,
            change
          });
        } else if (change < 0) {
          losers.push({
            tradingSymbol,
            change
          });
        }
      }
    });

    // sort gainers
    gainers.sort((a, b) => {
      return b.change - a.change; // descending order
    });

    // sort losers
    losers.sort((a, b) => {
      return a.change - b.change; // ascending order
    });

    const topGainersLosers = [];
    for (let i = 0; i < LIMIT && i < gainers.length; i++) {
      topGainersLosers.push(gainers[i]);
    }
    for (let i = 0; i < LIMIT && i < losers.length; i++) {
      topGainersLosers.push(losers[i]);
    }

    return topGainersLosers;
  }

}

module.exports = new VWAPtrategy(); // singleton class
