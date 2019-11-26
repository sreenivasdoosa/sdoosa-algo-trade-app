/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import async from 'async';
import logger from '../logger/logger.js';
import fs from 'fs-extra';
import path from 'path';
import {
  OrderStatus,
  getDelta,
  roundToValidPrice,
  isIntradaySquareOffTime,
  calculateProfitLossCharges,
  formatDateToString,
  getIntradaySquareOffTime, 
  isMarketOpen 
} from '../utils/utils.js';
import Ticker from './Ticker.js';
import { getStrategyInstance } from '../utils/strategy-utils.js';
import OrderManager from './OrderManager.js';
import { getConfig, getAppStoragePath } from '../config.js';

const config = getConfig();

const MAX_LIMIT_ORDER_ADJUSTS = 5;
const UNFILLED_ORDER_PRICE_ADVANCE_CHANGE_LIMIT = 0.3;

class TradeManager {

  constructor() {

    this.tradeSignals = [];
    this.trades = [];

    const tradesDir = [getAppStoragePath(), 'data', 'trades'].join(path.sep);
    // create dir if not exist
    fs.ensureDirSync(tradesDir);

    const todayDateStr = formatDateToString(new Date());
    this.tradesFilePath = [tradesDir, `trades_${todayDateStr}.json`].join(path.sep);
    this.tradeSignalsFilePath = [tradesDir, `trade_signals_${todayDateStr}.json`].join(path.sep);

    this.loadTradeSignalsFromFile();
    this.loadTradesFromFile();
  }

  start() {
    if (this.isRunning) {
      logger.info(`Trade Manager is already running..`);
      return;
    }

    logger.info(`Starting trade manager...`);

    this.liveTicksCache = {};
    this.tickerSymbols = [];

    this.loadTradeSignalsFromFile();
    this.loadTradesFromFile();

    this.run();
  }

  stop(exitAllPositions = false) {
    logger.warn(`TradeManager: stopProessing request recieved. exitAllPostions = ${exitAllPositions}`);
    this.stopRequested = true;

    if (!this.stopInProgress) {
      this.stopInProgress = true;

      // stop ticker
      if (this.ticker) {
        this.ticker.disconnect();
      }

      if (exitAllPositions === true) {
        this.exitAllPositions().then(() => {
          this.isRunning = false;
          this.stopInProgress = false;
        });
      } else {
        this.isRunning = false;
        this.stopInProgress = false;
      }
    }
  }

  exitAllPositions() {
    logger.info(`TradeManager: exitAllPositions() called`);

    return new Promise((exitResolve, exitReject) => {
      if (this.exitAllPositionsInProgress === true) {
        return exitResolve();
      }
      // exit the trades in async series fashion.
      this.exitAllPositionsInProgress = true;

      const exitAllPositionsInternal = () => {
        return new Promise((resolve, reject) => {
          const activeTrades = _.filter(this.trades, trade => trade.isActive === true && !trade.isCancelled && !trade.isRejected);
          async.series(_.map(activeTrades, trade => {
            return (callback) => {
              logger.info(`Going to exit the position for ${trade.tradingSymbol}`);
              if (trade.targetOrder) {
                OrderManager.getOrder(trade.broker, trade.targetOrder.orderId).then(order => {
                  logger.info(`exitAllPositionsInternal: ${trade.tradingSymbol} target order ${trade.targetOrder.orderId} status = ${order.status}`);
                  if (order.status === OrderStatus.OPEN) {
                    // modify the target order to market order so that it will be executed immediately
                    trade.exitReason = 'SQUARE OFF';
                    return OrderManager.modifyOrderToMarket(trade.broker, trade.targetOrder.orderId).then(order => {
                      logger.info('exitAllPositionsInternal: ' + trade.tradingSymbol + '- successfully changed target order to market to exit the position. OrderId = ' + trade.targetOrder.orderId);
                      callback(null, { trade });
                    }).catch(err => {
                      logger.error(`exitAllPositionsInternal: ${trade.tradingSymbol} error while modifying target order to market order. Error ${JSON.stringify(err)}`);
                      callback(null, { trade, error: err });
                    });
                  } else {
                    callback(null, { trade });
                  }
                });
              } else {
                logger.info(`exitAllPositionsInternal: ${trade.tradingSymbol} target order is null`);
                if (trade.isTrailingSL || trade.noTarget) {
                  // second argument true tells market order
                  trade.exitReason = 'SQUARE OFF';
                  this.placeTargetOrder(trade, true).then(order => {
                    logger.info(`exitAllPositionsInternal: ${trade.tradingSymbol} successfully placed target order at market to exit the position`);
                    callback(null, { trade });
                  }).catch(err => {
                    logger.error(`exitAllPositionsInternal: ${trade.tradingSymbol} error while placing market order to exit position. Error ${JSON.stringify(err)}`);
                    callback(null, { trade, error: err });
                  });
                } else {
                  callback(null, { trade });
                }
              }
            };
          }), (err, results) => {
            _.each(results, result => {
              if (result.error) {
                logger.error(`exitAllPositionsInternal: ${result.trade.tradingSymbol} error while exiting the position. Error ${JSON.stringify(result.error)}`);
              } else {
                logger.info(`exitAllPositionsInternal: ${result.trade.tradingSymbol} -- Done`);
              }
              resolve();
            });
          });
        });
      };

      const waitTillAllTradesExit = () => {

        async.series(_.map(this.trades, trade => {
          return (callback) => {
            if (trade.isActive === true) {
              logger.info(`exitAllPositions: ${trade.tradingSymbol} trade is still active.`);
            }
            this.trackAndUpdateTrade(trade).then(trade => {
              callback(null, { trade });
            }).catch(err => {
              callback(null, { trade, error: err });
            });
          };
        }), (error, results) => {
          let pendingPositions = false;
          _.each(results, result => {
            if (result.error) {
              logger.error(`exitAllPositions: waitTillAllTradesExit() ${result.trade.tradingSymbol} error from trackAndUpdateTrade(). Error ${JSON.stringify(result.error)}`);
            }
            if (result.trade.isActive === true) {
              pendingPositions = true;
            }
          });

          if (pendingPositions === true) {
            logger.info(`exitAllPositions: pending positions is still true hence calling exitAllPositionsInternal() again..`);
            // call again in loop
            exitAllPositionsInternal().then(() => {
              waitTillAllTradesExit();
            }).catch(err => {
              // Ideally the code should never reach here as the promise of exitAllPositionsInternal() always gets resolved.
              waitTillAllTradesExit();
            });

          } else {
            logger.info(`exitAllPositions: All trades exited successfully.`);

            this.saveTradeSignalsToFile(true);
            this.saveTradesToFile(true);

            this.exitAllPositionsInProgress = false;

            exitResolve();
          }
        });
      };

      logger.info(`exitAllPositions: Going to call exitAllPositionsInternal()`);
      exitAllPositionsInternal().then(() => {
        waitTillAllTradesExit();
      }).catch(err => {
        // Ideally the code should never reach here as the promise of exitAllPositionsInternal() always gets resolved.
        waitTillAllTradesExit();
      });

    });
  }

  run() {

    logger.info(`TradeManager: run() called`);

    const waitTimeInSeconds = 10;

    const processInLoop = () => {
      logger.debug(`TradeManager: processInLoop() called`);

      if (this.stopRequested === true) {
        logger.warn(`TradeManager:processInLoop() Exiting as stop signal received`);
        return;
      }

      let now = new Date();
      if (now > getIntradaySquareOffTime()) {
        logger.warn(`TradeManager:processInLoop() Exiting as intraday square off time reached`);
        return this.stop(true);
      }

      this.process().then(() => {
        setTimeout(processInLoop, waitTimeInSeconds * 1000);
      }).catch(err => {
        logger.error(`process: error ${JSON.stringify(err)}`);
        setTimeout(processInLoop, waitTimeInSeconds * 1000);
      });

    };

    // call it first time
    processInLoop();
  }

  process() {
    logger.debug(`TradeManager: process() called`);

    this.checkAndStartTickerService();

    return new Promise((resolve, reject) => {
      // execute updating trades in series
      async.series(_.map(this.trades, trade => {
        return (callback) => {
          this.trackAndUpdateTrade(trade).then(trade => {
            callback(null, { trade: trade });
          }).catch(err => {
            callback(null, { error: err, trade: trade });
          });
        };
      }), (err, results) => {
        _.each(results, result => {
          if (result.error) {
            logger.error(`Error in trackAndUpdateTrade for ${result.trade.tradingSymbol}. Error ${JSON.stringify(result.error)}`);
          } else {
            logger.info(`trackAndUpdateTrade for ${result.trade.tradingSymbol} is successful`);
          }
        });

        logger.info(`Done track and update for all trades ${this.trades.length}`);
        this.saveTradeSignalsToFile();
        this.saveTradesToFile();

        resolve();
      });
    });
  }

  loadTradesFromFile() {
    try {
      this.trades = fs.readJsonSync(this.tradesFilePath);
    } catch (err) {
      logger.error(`TradeManager: loadTradeSignalsFromFile. Error: ${JSON.stringify(err)}`);
    }
    logger.info(`TradeManaer: ${this.trades ? this.trades.length : 0} trades loaded from file ${this.tradesFilePath}`);
  }

  loadTradeSignalsFromFile() {
    try {
      this.tradeSignals = fs.readJsonSync(this.tradeSignalsFilePath);
    } catch (err) {
      logger.error(`TradeManager: loadTradeSignalsFromFile. Error: ${JSON.stringify(err)}`);
    }
    logger.info(`TradeManaer: ${this.tradeSignals ? this.tradeSignals.length : 0} tradeSignals loaded from file ${this.tradeSignalsFilePath}`);
  }

  getAllActiveStocks() {
    const allSymbols = [];
    _.each(this.tickerSymbols, symbol => allSymbols.push(symbol));

    _.each(this.tradeSignals, ts => {
      if (_.some(allSymbols, s => s === ts.tradingSymbol) === false) {
        allSymbols.push(ts.tradingSymbol);
      }
    });

    _.each(this.trades, t => {
      if (t.isActive && _.some(allSymbols, s => s === t.tradingSymbol) === false) {
        allSymbols.push(t.tradingSymbol);
      }
    });

    return allSymbols;
  }

  checkAndStartTickerService() {

    if (this.ticker || isMarketOpen() === false) {
      return;
    }

    this.ticker = new Ticker();
    this.ticker.registerSymbols(this.getAllActiveStocks());

    this.listener = {
      onTick: (tick) => {
        // storing CMP in cache

        //logger.debug(`onTick: ${tick.tradingSymbol} CMP = ${tick.cmp}`);

        this.liveTicksCache[tick.tradingSymbol] = tick;

        if (isIntradaySquareOffTime()) {
          logger.warn(`TradeManager: intraday square off time reached hence exiting all open positions..`);
          return this.stop(true);
        }

        const brokers = _.get(config, 'supportedBrokers', []);
        _.each(brokers, broker => {
          //logger.debug(`checkTradeSignalTriggerAndPlaceOrders: ${broker} ${tick.tradingSymbol}`);
          this.checkTradeSignalTriggerAndPlaceOrders(tick, broker);
        });
      },
      onDisconnected: () => {
        // set this.ticker to null
        logger.error(`TradeManager: ticker got disconnected.. Will try reconnecting in a moment`);
        this.ticker.unregisterListener(this.listener);
        this.ticker = null;
        this.listener = null;
      }
    };

    this.ticker.registerListener(this.listener);

    // connect the ticker
    this.ticker.connect();
  }

  checkTradeSignalTriggerAndPlaceOrders(liveQuote = {}, broker) {

    const tradingSymbol = liveQuote.tradingSymbol;

    const tradeSignalBuy = this.getUntriggeredTradeSignal(tradingSymbol, true, broker);
    const tradeSignalSell = this.getUntriggeredTradeSignal(tradingSymbol, false, broker);

    // TODO: How to block the next call until the response of this.executeTrade() resolve/reject

    if (tradeSignalBuy && !tradeSignalBuy.orderPlacementInProgress) {
      const strategyInstance = getStrategyInstance(tradeSignalBuy.strategy);
      if (strategyInstance &&
        strategyInstance.shouldPlaceTrade(tradeSignalBuy, liveQuote)) {

        tradeSignalBuy.orderPlacementInProgress = true;

        this.executeTrade(tradeSignalBuy).then(trade => {
          if (_.isEmpty(trade) === false) {
            trade.tradeSignal = tradeSignalBuy;
            this.tradeSignalTriggered(trade.tradeSignal);

            this.trades.push(trade);
            this.saveTradeSignalsToFile(true);
            this.saveTradesToFile(true);

            logger.info(`${tradingSymbol}: Successfully executed trade and set the trade signal triggered to ${trade.tradeSignal.isTriggered}`);

            tradeSignalBuy.orderPlacementInProgress = false;
          }
        }).catch(err => {
          logger.error(`checkTradeSignalTriggerAndPlaceOrders:tradeSignalBuy: Error: ${JSON.stringify(err)}`);
          tradeSignalBuy.orderPlacementInProgress = false;
        });
      }
    }

    if (tradeSignalSell && !tradeSignalSell.orderPlacementInProgress) {
      const strategyInstance = getStrategyInstance(tradeSignalSell.strategy);
      if (strategyInstance &&
        strategyInstance.shouldPlaceTrade(tradeSignalSell, liveQuote)) {

        tradeSignalSell.orderPlacementInProgress = true;

        this.executeTrade(tradeSignalSell).then(trade => {
          if (_.isEmpty(trade) === false) {
            trade.tradeSignal = tradeSignalSell;
            this.tradeSignalTriggered(trade.tradeSignal);

            this.trades.push(trade);
            this.saveTradeSignalsToFile(true);
            this.saveTradesToFile(true);

            logger.info(`${tradingSymbol}: Successfully executed trade and set the trade signal triggered to ${trade.tradeSignal.isTriggered}`);

            tradeSignalSell.orderPlacementInProgress = false;
          }
        }).catch(err => {
          logger.error(`checkTradeSignalTriggerAndPlaceOrders:tradeSignalSell: Error: ${JSON.stringify(err)}`);
          tradeSignalSell.orderPlacementInProgress = false;
        });
      }
    }
  }


  executeTrade(tradeSignal) { // This should return the trade in the promise

    const now = new Date();
    if (tradeSignal.tradeCutOffTime - now < 0) {
      // current time > cut off time so no trade
      logger.warn(`${tradeSignal.tradingSymbol} => Not executing trade as we are beyond cut off time`);
      // disable the trade signal
      tradeSignal.disabled = true;
      return Promise.resolve({});
    }
    if (tradeSignal.disabled) {
      return Promise.reject(`${tradeSignal.tradingSymbol}: Can not execute trade as trade signal is disabled. ${JSON.stringify(tradeSignal)}`);
    }
    if (tradeSignal.isTriggered) {
      return Promise.reject(`${tradeSignal.tradingSymbol}: Can not execute trade as trade signal already triggered and order placed. ${JSON.stringify(tradeSignal)}`);
    }

    logger.info(`${tradeSignal.tradingSymbol} execute trade called for ${JSON.stringify(tradeSignal)}`);

    const trade = {
      isActive: true,
      broker: tradeSignal.broker,
      isCoverOrder: tradeSignal.placeCoverOrder,
      isBracketOrder: tradeSignal.placeBracketOrder,
      strategy: tradeSignal.strategy,
      tradingSymbol: tradeSignal.tradingSymbol,
      exchange: tradeSignal.exchange || 'NSE',
      quantity: tradeSignal.quantity,
      requestedQuantity: tradeSignal.quantity,
      tradeType: tradeSignal.isBuy ? 'LONG' : 'SHORT',
      startTimestamp: now,
      requestedEntry: tradeSignal.trigger,
      stopLoss: tradeSignal.stopLoss,
      target: tradeSignal.target,
      initialStopLoss: tradeSignal.stopLoss,
      partialTradeRelationID: tradeSignal.partialTradeRelationID,
      lastSLUpdatedTimestamp: now,
      cancelUnfilledOrderAfterMinutes: tradeSignal.cancelUnfilledOrderAfterMinutes || 0,
      changeEntryPriceIfOrderNotFilled: tradeSignal.changeEntryPriceIfOrderNotFilled || false,
      isTrailingSL: tradeSignal.isTrailingSL || false,
      noTarget: tradeSignal.noTarget || false,
      limitOrderBufferPercentage: tradeSignal.limitOrderBufferPercentage || 0
    };

    // place original order
    const orderDetails = {
      exchange: tradeSignal.exchange || 'NSE',
      tradingSymbol: tradeSignal.tradingSymbol,
      isBuy: tradeSignal.isBuy,
      quantity: tradeSignal.quantity,
      isMarketOrder: tradeSignal.placeMarketOrder || false,
      price: tradeSignal.trigger
    };
    if (tradeSignal.limitOrderBufferPercentage > 0) {
      const bufferPoints = tradeSignal.trigger * tradeSignal.limitOrderBufferPercentage / 100;
      orderDetails.price = roundToValidPrice(tradeSignal.isBuy ? tradeSignal.trigger + bufferPoints : tradeSignal.trigger - bufferPoints);
    }
    if (tradeSignal.placeOrderWithDeltaPrice) {
      if (tradeSignal.isBuy) {
        orderDetails.price = roundToValidPrice(tradeSignal.trigger + getDelta(tradeSignal.trigger));
      } else {
        orderDetails.price = roundToValidPrice(tradeSignal.trigger - getDelta(tradeSignal.trigger));
      }
    }

    return OrderManager.placeOrder(trade.broker, orderDetails).then(order => {
      trade.order = {
        orderId: order.orderId, // in case of CO/BO, this order id is of first leg
        price: orderDetails.price,
        quantity: orderDetails.quantity,
        orderPlacedAt: new Date(),
        lastModifiedTime: new Date(),
        numModifyRequests: 0
      };

      logger.info(`${tradeSignal.tradingSymbol} => Execute trade completed for original order ${order.orderId}. Trade signal ${JSON.stringify(tradeSignal)}`);
      return trade;

    }).catch(err => {
      logger.error(`${tradeSignal.tradingSymbol} => Error while placing the order for trade signal ${JSON.stringify(tradeSignal)}. Error: ${JSON.stringify(err)}`);
      throw err;
    });

  }

  placeSLOrder(trade) {

    // place SL order
    const triggerDelta = ((parseInt(trade.stopLoss) / 500) + 1) * 0.05; // used for SL-Limit order while calculating SL price (not trigger price)

    const orderDetails = {
      exchange: trade.exchange || 'NSE',
      tradingSymbol: trade.tradingSymbol,
      isBuy: trade.tradeType === 'LONG' ? false : true, // reverse of original order
      quantity: trade.quantity,
      isMarketOrder: true, // NOTE: for now all SL orders are SL market orers
      price: roundToValidPrice(trade.tradeType === 'LONG' ? (trade.stopLoss - triggerDelta) : (trade.stopLoss + triggerDelta)),
      triggerPrice: trade.stopLoss
    };

    return OrderManager.placeSLOrder(trade.broker, orderDetails).then(order => {
      trade.slOrder = {
        orderId: order.orderId,
        quantity: orderDetails.quantity,
        triggerPrice: orderDetails.triggerPrice,
        orderPlacedAt: new Date(),
        lastModifiedTime: new Date(),
        numModifyRequests: 0
      };

      logger.info(`${trade.tradingSymbol} => placed SL order ${order.orderId} against original order ${trade.order.orderId}`);
      return trade;
    }).catch(err => {
      logger.error(`trackAndUpdateSLOrder: ${trade.tradingSymbol}. Error while placing SL order against the original order ${trade.order.orderId}. Error ${JSON.stringify(err)}`);
      throw err;
    });
  }

  placeTargetOrder(trade, isMarketOrder = false) {
    // place target order
    const orderDetails = {
      exchange: trade.exchange || 'NSE',
      tradingSymbol: trade.tradingSymbol,
      isBuy: trade.tradeType === 'LONG' ? false : true, // reverse of original order
      quantity: trade.quantity,
      isMarketOrder: isMarketOrder,
      price: trade.target
    };

    const placeOrderInternal = (orderDetails) => {
      return OrderManager.placeOrder(trade.broker, orderDetails).then(order => {
        trade.targetOrder = {
          orderId: order.orderId,
          price: orderDetails.price,
          quantity: orderDetails.quantity,
          orderPlacedAt: new Date(),
          lastModifiedTime: new Date(),
          numModifyRequests: 0
        };

        logger.info(`placeTargetOrder:placeOrderInternal ${trade.tradingSymbol} => Successfully placed targer order ${trade.targetOrder.orderId} against original order ${trade.order.orderId}`);
        return trade;

      }).catch(err => {
        logger.error(`placeTargetOrder:placeOrderInternal ${trade.tradingSymbol} => Error while placing target order for original order ${trade.order.orderId}. Error: ${JSON.stringify(err)}`);
        throw err;
      });
    };

    // check quantity of SL order (if manually exited some quantity)
    if (trade.slOrder) {
      return OrderManager.getOrder(trade.broker, trade.slOrder.orderId).then(slOrder => {
        logger.info(`placeTargetOrder: ${trade.tradingSymbol} updating the target order quantity to ${slOrder.quantity} from ${orderDetails.quantity} as SL order quantity might have updated manually`);
        orderDetails.quantity = slOrder.quantity;
        return placeOrderInternal(orderDetails);
      }).catch(err => {
        logger.error(`placeTargetOrder: ${trade.tradingSymbol} error while fetching SL order details for SL order ${trade.slOrder.orderId}. Error ${JSON.stringify(err)}`);
        throw err;
      });
    } else {
      return Promise.reject(`placeTargetOrder: Cannot place target order as sl order is null`);
    }
  }

  trackAndUpdateTrade(trade) {
    if (!trade.isActive) {
      // logger.error(`${trade.tradingSymbol}: trade is not active ${JSON.stringify(trade)}`);
      return Promise.resolve(trade);
    }

    return this.trackAndUpdateOriginalOrder(trade).then(trade => {
      logger.info(`trackAndUpdateTrade: 1. finished tracking and updating Original order`);
      if (trade.orderFilled !== true) {
        logger.info(`trackAndUpdateTrade: ${trade.tradingSymbol}: Original order not filled hence not going to place SL and Target Orders`);
        return trade;
      }
      return this.trackAndUpdateSLOrder(trade).then(trade => {
        logger.info(`trackAndUpdateTrade: 2. finished tracking and updating Original + SL orders`);
        return this.trackAndUpdateTargetOrder(trade).then(trade => {
          logger.info(`trackAndUpdateTrade: 3. finished tracking and updating Original + SL + Target orders`);
          return trade;
        });
      });
    });
  }

  trackAndUpdateOriginalOrder(trade) {
    return new Promise((resolve, reject) => {
      if (!trade.order) {
        return resolve(trade);
      }
      if (!trade.order.status || trade.order.status !== OrderStatus.COMPLETE) {
        OrderManager.getOrder(trade.broker, trade.order.orderId).then(order => {
          logger.debug(`trackAndUpdateOriginalOrder: ${trade.tradingSymbol} original order ${trade.order.orderId} status = ${order.status}`);
          trade.order.status = order.status;
          trade.order.averagePrice = order.averagePrice;
          trade.order.quantity = order.quantity;
          trade.order.filledQuantity = order.filledQuantity;
          trade.order.pendingQuantity = order.pendingQuantity;

          trade.entry = trade.order.averagePrice;
          trade.filledQuantity = trade.order.filledQuantity;
          trade.quantity = trade.order.quantity; // update the quantity if it does not match with the value on the server (may get NOT MODIFIED status while changing quantity if order fill already completed by the time we send modify request)

          if (trade.order.status === OrderStatus.CANCELLED) {
            logger.error(`trackAndUpdateOriginalOrder: original order ${trade.order.orderId} cancelled.`);
            trade.isCancelled = true;
            trade.isActive = false;
            return resolve(trade);
          }
          if (trade.order.status === OrderStatus.REJECTED) {
            logger.error(`trackAndUpdateOriginalOrder: original order ${trade.order.orderId} rejected.`);
            trade.isRejected = true;
            trade.isActive = false;
            return resolve(trade);
          }

          if (trade.order.status === OrderStatus.COMPLETE) {
            trade.orderFilled = true;
            if (!trade.orderCompleteTimeStamp) {
              trade.orderCompleteTimeStamp = new Date();
            }
            return resolve(trade);

          } else { // order not filled yet : hopefully in OPEN state

            if (trade.changeEntryPriceIfOrderNotFilled) {
              const orderModifiedSinceSeconds = parseInt((new Date() - trade.order.lastModifiedTime) / 1000);
              if (orderModifiedSinceSeconds >= 20 && trade.order.numModifyRequests < MAX_LIMIT_ORDER_ADJUSTS) {

                const liveTick = this.liveTicksCache[trade.tradingSymbol];
                if (!liveTick) {
                  return resolve(trade);
                }


                const oldPrice = trade.order.price;
                let newPrice = liveTick.cmp;
                switch (trade.tradeType) {
                  case 'LONG':
                    if (newPrice <= trade.requestedEntry) {
                      return resolve(trade);
                    }
                    const maxAllowedNewPrice = roundToValidPrice(trade.requestedEntry + trade.requestedEntry * UNFILLED_ORDER_PRICE_ADVANCE_CHANGE_LIMIT / 100);
                    if (newPrice > maxAllowedNewPrice) {
                      logger.warn(trade.tradingSymbol + " [LONG] newPrice " + newPrice + " is greater than max allowed new price " + maxAllowedNewPrice + " hence setting order price to " + maxAllowedNewPrice);
                      newPrice = maxAllowedNewPrice;
                    }
                    break;

                  case 'SHORT':
                    if (newPrice >= trade.requestedEntry) {
                      return resolve(trade);
                    }
                    const minAllowedNewPrice = roundToValidPrice(trade.requestedEntry - trade.requestedEntry * UNFILLED_ORDER_PRICE_ADVANCE_CHANGE_LIMIT / 100);
                    if (newPrice < minAllowedNewPrice) {
                      logger.warn(trade.tradingSymbol + " [SHORT] newPrice " + newPrice + " is lesser than min allowed new price " + minAllowedNewPrice + " hence setting order price to " + minAllowedNewPrice);
                      newPrice = minAllowedNewPrice;
                    }
                    break;
                }
                if (newPrice === oldPrice) {
                  logger.warn(trade.tradingSymbol + " Not modifying the order as the new price is same as the old price " + newPrice);
                  return resolve(trade);
                }
                if (trade.isCoverOrder === true) {
                  //TODO:
                  return resolve(trade);
                } else if (trade.isBracketOrder === true) {
                  //TODO:
                  return resolve(trade);

                } else { // normal order
                  logger.info(`trackAndUpdateOriginalOrder: Going to modify order ${trade.order.orderId} with new price = ${newPrice}`);
                  OrderManager.modifyOrder(trade.broker, trade.order.orderId, {
                    newPrice: newPrice
                  }).then(order => {
                    trade.order.price = newPrice; // update the price locally
                    trade.order.lastModifiedTime = new Date();
                    trade.order.numModifyRequests++;
                    logger.info(trade.tradingSymbol + " Modify count " + trade.order.numModifyRequests + " - Order price changed to " + newPrice + " from " + oldPrice + " and requested entry = " + trade.requestedEntry);

                    resolve(trade);

                  }).catch(err => {
                    logger.error(`Failed to modify order ${trade.order.orderId} with new price ${newPrice}. Error: ${JSON.stringify(err)}`);

                    resolve(trade); // still resolve the trade as fetching original order status is successful
                  });
                }
              } else {
                return resolve(trade);
              }

            } else if (trade.cancelUnfilledOrderAfterMinutes > 0) {
              // TODO:
              return resolve(trade);
            } else {
              return resolve(trade);
            }
          }

        }).catch(err => {
          logger.error(`trackAndUpdateOriginalOrder: Unable to get original order ${trade.order.orderId} details. Error: ${JSON.stringify(err)}`);
          reject(err);
        });
      } else {
        resolve(trade);
      }
    });
  }

  trackAndUpdateSLOrder(trade) {
    return new Promise((resolve, reject) => {
      if (!trade.slOrder) {
        if (!trade.isCoverOrder && !trade.isBracketOrder) {
          // place SL order
          logger.info(`trackAndUpdateSLOrder: ${trade.tradingSymbol}: going to place SL order.`);
          this.placeSLOrder(trade).then(trade => {
            resolve(trade);

          }).catch(err => {
            reject(err);
          });
        } else {
          return resolve(trade);
        }
      } else { // track and update SL order
        OrderManager.getOrder(trade.broker, trade.slOrder.orderId).then(order => {
          logger.debug("trackAndUpdateSLOrder: " + trade.tradingSymbol + " SL order [" + trade.slOrder.orderId + "] status = " + order.status);

          trade.slOrder.status = order.status;
          trade.slOrder.averagePrice = order.averagePrice;
          trade.slOrder.quantity = order.quantity;
          trade.slOrder.filledQuantity = order.filledQuantity;
          trade.slOrder.pendingQuantity = order.pendingQuantity;

          if (trade.slOrder.status === OrderStatus.COMPLETE) {
            // SL hit, close the trade
            const updateTradePLAndExitReason = (trade) => {
              trade.exit = trade.slOrder.averagePrice;
              trade.endTimestamp = new Date();
              trade = calculateProfitLossCharges(trade, false);

              if (_.isEmpty(trade.exitReason)) {
                trade.exitReason = "SL HIT";
                logger.warn("trackAndUpdateSLOrder: " + trade.tradingSymbol + " SL Hit, tradeType = " + trade.tradeType + ", entry = " + trade.entry + ", exit = " + trade.exit + ", netPL = " + trade.netProfitLoss);
              } else if (trade.exitReason === 'TRAILING SL') {
                trade.exitReason = 'TRAIL SL HIT';
                logger.warn("trackAndUpdateSLOrder: " + trade.tradingSymbol + " TRAILING SL Hit, tradeType = " + trade.tradeType + ", entry = " + trade.entry + ", exit = " + trade.exit + ", netPL = " + trade.netProfitLoss);
              }
              trade.isActive = false; // set to inactive as SL/trailing SL hit
              return trade;
            };

            if (trade.targetOrder) {
              OrderManager.cancelOrder(trade.broker, trade.targetOrder.orderId).then(targetOrder => {
                trade = updateTradePLAndExitReason(trade);
                resolve(trade);
              }).catch(err => {
                logger.error(`trackAndUpdateSLOrder: ${trade.tradingSymbol} : Unable to cancel target order for SL hit trade target order is ${trade.targetOrder.orderId}. Error ${JSON.stringify(err)}`);
                resolve(trade); // just resolve, it will be re tried again
              });
            } else {
              trade = updateTradePLAndExitReason(trade);
              return resolve(trade);
            }

          } else if ((trade.isCancelled || trade.isRejected) &&
            trade.slOrder.status === OrderStatus.OPEN) {
            // cancel SL order if original order is cancelled
            logger.info("trackAndUpdateSLOrder: " + trade.tradingSymbol + " Cancelling SL order " + trade.slOrder.orderId + " as the original order got cancelled/rejected");
            OrderManager.cancelOrder(trade.broker, trade.slOrder.orderId).then(slOrder => {
              resolve(trade);
            }).catch(err => {
              logger.error(`trackAndUpdateSLOrder: ${trade.tradingSymbol} - Unable to cancel SL order ${trade.slOrder.orderId} on original order cancelled/rejected. Error ${JSON.stringify(err)}`);
              resolve(trade); // just resolve, it will be re tried again
            });

          } else if (trade.slOrder.status === OrderStatus.CANCELLED ||
            trade.slOrder.status === OrderStatus.REJECTED) {
            if (!trade.targetOrder ||
              trade.targetOrder.status === OrderStatus.CANCELLED ||
              trade.targetOrder.status === OrderStatus.REJECTED) {

              trade.isActive = false;
              if (!trade.exitReason || _.inlcudes(trade.exitReason, 'SQUARE OFF') === false) {
                trade.isCancelled = true;
                logger.warn("trackAndUpdateSLOrder: " + trade.tradingSymbol + " SL Order cancelled/rejected for " + trade.slOrder.orderId + ", hence setting trade to inactive.");
              }
            }
            return resolve(trade);

          } else if (trade.isTrailingSL) {
            // trail the SL 
            this.updateTrailingSL(trade).then(trade => {
              resolve(trade);
            }).catch(err => {
              logger.error(`trackAndUpdateSLOrder: ${trade.tradingSymbol} - Unable to update trail SL ${trade.slOrder.orderId}. Error ${JSON.stringify(err)}`);
              resolve(trade); // just resolve it will be re tried again
            });
          } else {
            resolve(trade);
          }
        }).catch(err => {
          logger.error(`trackAndUpdateSLOrder: ${trade.tradingSymbol} - Unable to fetch SL order ${trade.slOrder.orderId} details. Error ${JSON.stringify(err)}`);
          resolve(trade); // Still resolve the trade as it will be re tried again
        });
      }
    });
  }

  trackAndUpdateTargetOrder(trade) {
    return new Promise((resolve, reject) => {
      if (!trade.targetOrder) {
        if (!trade.isTrailingSL && !trade.noTarget && !trade.isCoverOrder && !trade.isBracketOrder) {
          // place Target order
          logger.info(`trackAndUpdateTargetOrder: ${trade.tradingSymbol}: going to place target order.`);
          this.placeTargetOrder(trade).then(trade => {
            resolve(trade);

          }).catch(err => {
            reject(err);
          });
        } else {
          return resolve(trade);
        }
      } else { // track and update target order
        OrderManager.getOrder(trade.broker, trade.targetOrder.orderId).then(order => {
          logger.info("trackAndUpdateTargetOrder " + trade.tradingSymbol + " Target order [" + trade.targetOrder.orderId + "] status = " + order.status);

          trade.targetOrder.status = order.status;
          trade.targetOrder.averagePrice = order.averagePrice;
          trade.targetOrder.quantity = order.quantity;
          trade.targetOrder.filledQuantity = order.filledQuantity;
          trade.targetOrder.pendingQuantity = order.pendingQuantity;

          if (trade.targetOrder.status === OrderStatus.COMPLETE) {

            const updateTradePLAndExitReason = (trade) => {
              trade.exit = trade.targetOrder.averagePrice;
              trade.endTimestamp = new Date();
              trade = calculateProfitLossCharges(trade, false);

              if (_.isEmpty(trade.exitReason)) { // if not empty, means possible value 'SQUARE OFF'
                trade.exitReason = "TARGET HIT";
              }
              logger.warn("trackAndUpdateTargetOrder " + trade.tradingSymbol + " TARGET Hit/Square off, tradeType = " + trade.tradeType + ", entry = " + trade.entry + ", exit = " + trade.exit + ", netPL = " + trade.netProfitLoss);

              trade.isActive = false; // set to inactive as SL/trailing SL hit

              // remove the trade signal of opposite if exists
              if (trade.tradeSignal && trade.tradeSignal.considerOppositeTrade) {
                const oppTradeSignal = this.getOppositeTradeSignal(trade.tradeSignal);
                this.disableTradeSignal(oppTradeSignal);
              }

              return trade;
            };

            // Target hit/squre off, close the trade
            if (trade.slOrder) {
              OrderManager.cancelOrder(trade.broker, trade.slOrder.orderId);
              logger.info("trackAndUpdateTargetOrder " + trade.tradingSymbol + " Taget hit/Square off, cancelled SL order " + trade.slOrder.orderId);
            }
            if (trade.slOrder) {
              OrderManager.cancelOrder(trade.broker, trade.slOrder.orderId).then(slOrder => {
                trade = updateTradePLAndExitReason(trade);
                resolve(trade);
              }).catch(err => {
                logger.error(`trackAndUpdateSLOrder: ${trade.tradingSymbol} : Unable to cancel SL order for Target hit trade. SL order is ${trade.slOrder.orderId}. Error ${JSON.stringify(err)}`);
                resolve(trade); // just resolve, it will be re tried again
              });
            } else {
              trade = updateTradePLAndExitReason(trade);
              return resolve(trade);
            }
          } else if ((trade.isCancelled || trade.isRejected) &&
            trade.targetOrder.status === OrderStatus.OPEN) {
            // cancel target order if original order is cancelled
            logger.info("trackAndUpdateTargetOrder " + trade.tradingSymbol + " Cancelling Target order " + trade.targetOrder.orderId + " as the original order got cancelled/rejected");
            OrderManager.cancelOrder(trade.broker, trade.targetOrder.orderId).then(targetOrder => {
              resolve(trade);
            }).catch(err => {
              logger.error(`trackAndUpdateTargetOrder: ${trade.tradingSymbol} - Unable to cancel Target order ${trade.targetOrder.orderId} on original order cancelled/rejected. Error ${JSON.stringify(err)}`);
              resolve(trade); // just resolve, it will be re tried again
            });
          } else if (trade.targetOrder.status === OrderStatus.CANCELLED ||
            trade.targetOrder.status === OrderStatus.REJECTED) {

            if (trade.slOrder == null ||
              trade.slOrder.status === OrderStatus.CANCELLED ||
              trade.slOrder.status === OrderStatus.REJECTED) {

              trade.isActive = false;
              if (!trade.exitReason || _.includes(trade.exitReason, 'TARGET') === false) {
                trade.isCancelled = true;
                logger.warn("trackAndUpdateTargetOrder " + trade.tradingSymbol + " Target Order cancelled for " + trade.targetOrder.orderId + ", hence setting trade to inactive.");
              }
            }
            return resolve(trade);
          } else {
            resolve(trade);
          }
        }).catch(err => {
          logger.error(`trackAndUpdateTargetOrder: ${trade.tradingSymbol} - Unable to fetch Target order ${trade.targetOrder.orderId} details. Error ${JSON.stringify(err)}`);
          resolve(trade); // Still resolve the trade as it will be re tried again
        });;
      }
    });
  }

  updateTrailingSL(trade) {
    // TODO: need to impplement ATR based trailing SL
    return new Promise.resolve(trade);
  }

  compareTradeSignals(ts1, ts2) {
    if (!ts1 || !ts2) {
      return false;
    }
    return ts1.broker === ts2.broker && // This is IMP: each tradeSignal is separate for each broker
      ts1.strategy === ts2.strategy &&
      ts1.tradingSymbol === ts2.tradingSymbol &&
      ts1.isBuy === ts2.isBuy &&
      ts1.trigger === ts2.trigger &&
      ts1.stopLoss === ts2.stopLoss &&
      ts1.target === ts2.target; // there can be multiple sub trades for same trade with different stoploss & target values
  }

  isTradeSignalExists(tradeSignal) {
    return _.some(this.tradeSignals, ts => {
      return this.compareTradeSignals(ts, tradeSignal);
    });
  }

  getTradeSignalOfSame(tradeSignal) {
    let result = null;
    _.each(this.tradeSignals, ts => {
      if (this.compareTradeSignals(tradeSignal, ts)) {
        result = ts;
        return false; // breaks the loop
      }
    });
    return result;
  }

  getOppositeTradeSignal(tradeSignal) {
    let oppTradeSignal = null;
    _.each(this.tradeSignals, ts => {
      if (ts.broker === tradeSignal.broker &&
        ts.strategy === tradeSignal.strategy &&
        ts.tradingSymbol === tradeSignal.tradingSymbol &&
        ts.isBuy !== tradeSignal.isBuy) {

        if (!ts.correlationID || ts.correlationID === tradeSignal.correlationID) {
          oppTradeSignal = ts;
          return false; // breaks the loop
        }
      }
    });
    return oppTradeSignal;
  }

  addTradeSignal(tradeSignal) {
    if (_.isEmpty(tradeSignal)) {
      return;
    }
    logger.info(`TradeManager:addTradeSignal() called for ${JSON.stringify(tradeSignal)}`);
    if (this.isTradeSignalExists(tradeSignal)) {
      logger.info(`${tradeSignal.tradingSymbol}: Trade signal already exists so not adding again`);
      return;
    }

    const oppTradeSignal = this.getOppositeTradeSignal(tradeSignal);
    if (oppTradeSignal && !oppTradeSignal.considerOppositeTrade && oppTradeSignal.isTriggered) {
      // disable this signal as the opposite trade already triggered
      this.disableTradeSignal(tradeSignal);
      this.tradeSignals.push(tradeSignal);
      this.saveTradeSignalsToFile(true);
    } else {
      this.tradeSignals.push(tradeSignal);
      if (this.ticker) {
        this.ticker.registerSymbols(tradeSignal.tradingSymbol);
      }
    }
  }

  tradeSignalTriggered(tradeSignal) {

    tradeSignal.isTriggered = true;

    logger.info(`Trade signal triggered for ${JSON.stringify(tradeSignal)}`);

    const oppTradeSignal = this.getOppositeTradeSignal(tradeSignal);
    if (oppTradeSignal && !tradeSignal.considerOppositeTrade) {
      // disable the opposite trade signal as soon as this trade signal is triggered
      this.disableTradeSignal(oppTradeSignal);
    }
  }

  disableTradeSignal(tradeSignal) {
    if (!tradeSignal) {
      return;
    }

    logger.info(`disableTradeSignal() called for ${JSON.stringify(tradeSignal)}`);
    tradeSignal.disabled = true;

    this.saveTradeSignalsToFile(true);
  }

  getUntriggeredTradeSignal(tradingSymbol, isBuy, broker) {
    return _.find(this.tradeSignals, ts => {
      return ts.broker === broker &&
        !ts.disabled &&
        !ts.isTriggered &&
        ts.tradingSymbol === tradingSymbol &&
        ts.isBuy === isBuy;
    });
  }

  isTradeAlreadyPlaced(tradeSignal, strategyName) {
    let tradePlaced = false;
    _.each(this.trades, trade => {
      if (trade.strategy === strategyName &&
        trade.tradingSymbol === tradeSignal.tradingSymbol) {

        if (trade.tradeType === 'LONG' && tradeSignal.isBuy) {
          tradePlaced = true;
        } else if (trade.tradeType === 'SHORT' && !tradeSignal.isBuy) {
          tradePlaced = true;
        }
        if (tradePlaced) {
          return false; // this breaks the loop
        }
      }
    });
    return tradePlaced;
  }

  getNumberOfStocksTradesPlaced(strategyName) {
    const stocks = this.getListOfStocksTradesPlaced(strategyName);
    return stocks ? stocks.length : 0;
  }

  getListOfStocksTradesPlaced(strategyName) {
    const stocks = [];
    _.each(this.trades, trade => {
      if (trade.strategy === strategyName &&
        _.some(stocks, s => s === trade.tradingSymbol) === false) {
        stocks.push(trade.tradingSymbol);
      }
    });
    return stocks;
  }

  saveTradeSignalsToFile(forceSave = false) {
    const now = new Date();
    if (!forceSave && this.lastTradeSignalsSaveTimestamp &&
      now - this.lastTradeSignalsSaveTimestamp < 30 * 1000) {
      return;
    }

    fs.writeJson(this.tradeSignalsFilePath, this.tradeSignals, {
      spaces: 2
    }).then(() => {
      logger.debug(`trade signals ${this.tradeSignals.length} successfully writen to ${this.tradeSignalsFilePath}`);
      this.lastTradeSignalsSaveTimestamp = new Date();
    }).catch(err => {
      logger.error(`error in saving trade signals to file ${this.tradeSignalsFilePath}. ${JSON.stringify(err)}`);
      this.lastTradeSignalsSaveTimestamp = new Date();
    });
  }

  saveTradesToFile(forceSave = false) {
    const now = new Date();
    if (!forceSave && this.lastTradesSaveTimestamp &&
      now - this.lastTradesSaveTimestamp < 30 * 1000) {
      return;
    }

    fs.writeJson(this.tradesFilePath, this.trades, {
      spaces: 2
    }).then(() => {
      logger.debug(`trades ${this.trades.length} successfully writen to ${this.tradesFilePath}`);
      this.lastTradesSaveTimestamp = new Date();
    }).catch(err => {
      logger.error(`error in saving trades to file ${this.tradesFilePath}. ${JSON.stringify(err)}`);
      this.lastTradesSaveTimestamp = new Date();
    });
  }

  getActiveTrades(broker) {
    let activeTrades = _.filter(this.trades, trade => trade.broker === broker && trade.isActive === true);
    // update cmp for each trade
    activeTrades = _.map(activeTrades, trade => {
      const liveTick = this.liveTicksCache ? this.liveTicksCache[trade.tradingSymbol] : null;
      if (liveTick) {
        trade.cmp = liveTick.cmp;
        trade = calculateProfitLossCharges(trade, true);
      } else {
        trade.cmp = 0;
      }
      return trade;
    });
    return activeTrades;
  }

  getCompletedTrades(broker) {
    return _.filter(this.trades, trade => trade.broker === broker && !trade.isActive && !trade.isCancelled && !trade.isRejected);
  }
}

let _instance = null;

module.exports.getInstance = () => { // singleton class
  if (!_instance) {
    _instance = new TradeManager();
  }
  return _instance;
};

