/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import { KiteConnect } from 'kiteconnect';
import { getConfig } from '../../config.js';
import logger from '../../logger/logger.js';
import Instruments from './Instruments.js';

const config = getConfig();

class Zerodha {

  constructor() {
    const apiKey = this.getAPIKey();

    if (_.isEmpty(apiKey)) {
      logger.error('Zerodha API key not configured..');
      //throw 'Zerodha API Key missing in config';
    }

    logger.info('Zerodha API key  = ' + apiKey);

    this.kiteConnect = new KiteConnect({
      api_key: apiKey,
      debug: _.get(config, 'brokers.zerodha.debug')
    });
  }

  getAPIKey() {
    return _.get(config, 'brokers.zerodha.apiKey');
  }

  getAPISecret() {
    return _.get(config, 'brokers.zerodha.apiSecret');
  }

  getPin() {
    return _.get(config, 'brokers.zerodha.pin');
  }

  isLoggedIn() {
    return this.session ? true : false;
  }

  setSession(session) {
    this.session = session;
  }

  getSession() {
    return this.session;
  }

  getKiteConnect() {
    return this.kiteConnect;
  }

  login(req, res) {
    const requestToken = _.get(req, 'query.request_token', null);

    if (_.isEmpty(requestToken) === false) {
      logger.info('Login successful...');
      // Now get the access token after successful login
      this.kiteConnect.generateSession(requestToken, this.getAPISecret()).then(session => {
        this.setSession(session);
        res.redirect(302, '/?broker=zerodha');

      }).catch(err => {
        logger.error('generateSession failed => ', err);
        res.status(500).send({
          error: 'Could not generate kite session',
          details: err
        });
      });
    } else {
      logger.info('login url => ' + this.kiteConnect.getLoginURL());
      res.redirect(302, this.kiteConnect.getLoginURL());
    }
  }

  logout(req, res) {
    if (!this.isLoggedIn()) {
      return res.status(400).send({
        error: 'Not logged in'
      });
    }
    
    this.kiteConnect.invalidateAccessToken();
    this.setSession(null);

    res.status(200).send({
      message: 'Logout successful'
    });
    logger.info('Successfully logged out from the session');
  }

  loadInstruments() {
    return this.kiteConnect.getInstruments("NSE").then(data => {
      Instruments.setInstruments(data);
      logger.info(`Zerodha: instruments loaded. count = ${data.length}`);
      return data;

    }).catch(err => {
      logger.error(`Zerodha: failed to load instruments.`, err);
      throw {
        error: 'Failed to load instruments data from Zerodha',
        details: err
      };
    });
  }

};

module.exports = new Zerodha(); // singleton class (new Object())
