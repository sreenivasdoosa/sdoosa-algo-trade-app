/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import logger from '../logger/logger.js';
import Zerodha from '../brokers/zerodha/Zerodha.js';
import Upstox from '../brokers/upstox/Upstox.js';
import TradeManager from './TradeManager.js';
import VWAPStrategy from '../strategies/VWAPStrategy.js';
import { getConfig } from '../config.js';
import { isMarketClosedForTheDay } from '../utils/utils.js'; 

const config = getConfig();

class AlgoManager {

  constructor() {

    this.algoRunning = {};

    _.each(config.supportedBrokers, broker => {
      this.algoRunning[broker] = false;
    });
  }

  isAlgoRunning(broker) {
    return this.algoRunning[broker] || false;
  }

  startAlgo(req, res, broker) {
    logger.info(`${broker}: Starting Algo Manager...`);

    if ((broker === 'zerodha' && !Zerodha.isLoggedIn()) ||
      (broker === 'upstox' && !Upstox.isLoggedIn())) {
      return res.status(400).send({
        error: 'Cannot start algo as user not logged in.'
      });
    }

    if (isMarketClosedForTheDay()) {
      logger.info(`Algo Manager: Market closed for the day, so not starting..`);
      return res.status(400).send({
        error: 'Market closed for the day.'
      });
    }

    if (this.isAlgoRunning(broker)) {
      return res.status(200).send({
        message: `Algo already running for broker ${broker}`
      });
    }

    if (broker === 'zerodha') {
      Zerodha.loadInstruments().then(instruments => {

        this.algoRunning[broker] = true;
        
        // start trade manager first
        TradeManager.getInstance().start();

        VWAPStrategy.start();

        res.status(200).send({
          isAlgoRunning: this.algoRunning
        });

      }).catch(err => {
        res.status(500).send({
          error: 'Failed to load instruments data from Zerodha',
          details: err
        });
      });
    } else if (broker === 'upstox') {

      this.algoRunning[broker] = true;

      // start trade manager first
      TradeManager.getInstance().start();

      VWAPStrategy.start();

      res.status(200).send({
        isAlgoRunning: this.algoRunning
      });
    }
  }

  stopAlgo(req, res, broker) {
    if (!this.isAlgoRunning(broker)) {
      return res.status(200).send({
        message: 'Algo is not running'
      });
    }

    if ((broker === 'zerodha' && !Zerodha.isLoggedIn()) ||
      (broker === 'upstox' && !Upstox.isLoggedIn())) {
      return res.status(400).send({
        error: 'Cannot stop algo as user not logged in.'
      });
    }

    if (VWAPStrategy.isEnabled()) {
      VWAPStrategy.stop();
    }

    // stop trade manager
    TradeManager.getInstance().stop();

    this.algoRunning[broker] = false;

    // send success response without any data (201)
    res.status(200).send({
      isAlgoRunning: this.algoRunning
    });

  }
}

module.exports = new AlgoManager(); // singleton class
