/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import UpstoxConnect from 'upstox';
import { getConfig } from '../../config.js';
import logger from '../../logger/logger.js';
//import Instruments from './Instruments.js';

const config = getConfig();

class Upstox {

  constructor() {
    const apiKey = this.getAPIKey();
    if (_.isEmpty(apiKey)) {
      logger.error('Upstox apiKey not configured..');
      //throw 'Upstox apiKey missing in config';
    }
    logger.info('Upstox API key  = ' + apiKey);

    const redirectUrl = this.getRedirectUrl();
    if (_.isEmpty(redirectUrl)) {
      logger.error('Upstox redirectUrl not configured..');
      throw 'Upstox redirectUrl missing in config';
    }
    logger.info('Upstox redirect url  = ' + redirectUrl);

    this.upstoxConnect = new UpstoxConnect(apiKey);

  }

  getAPIKey() {
    return _.get(config, 'brokers.upstox.apiKey');
  }

  getRedirectUrl() {
    return _.get(config, 'brokers.upstox.redirectUrl');
  }

  getAPISecret() {
    return _.get(config, 'brokers.upstox.apiSecret');
  }

  getPin() {
    return _.get(config, 'brokers.upstox.pin');
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

  getUpstoxConnect() {
    return this.upstoxConnect;
  }

  login(req, res) {
    const requestToken = _.get(req, 'query.code', null);

    if (_.isEmpty(requestToken) === false) {
      logger.info('Login successful...');
      // Now get the access token after successful login
      this.upstoxConnect.getAccessToken({
        apiSecret: this.getAPISecret(),
        code: requestToken,
        redirect_uri: this.getRedirectUrl()
      }).then(session => {
        console.log('upstox login successful ', session);

        this.upstoxConnect.setToken(session.access_token);

        this.setSession(session);
        res.redirect(302, '/?broker=upstox');

      }).catch(err => {
        logger.error('generateSession failed => ', err);
        res.status(500).send({
          error: 'Could not generate Upstox session',
          details: err
        });
      });
    } else {
      const loginUrl = this.upstoxConnect.getLoginUri(this.getRedirectUrl());
      logger.info('upstox login url => ' + loginUrl);
      res.redirect(302, loginUrl);
    }
  }

  logout(req, res) {
    if (!this.isLoggedIn()) {
      return res.status(400).send({
        error: 'Not logged in'
      });
    }
    
    this.upstoxConnect.logout().then(resp => {
      this.setSession(null);
      logger.info('Upstox: Successfully logged out from the session');
      res.status(200).send({
        message: 'Upstox logout successful'
      });

    }).catch(err => {
      logger.error(`Error while logging out from upstox. ${JSON.stringify(err)}`);
      res.status(500).send({
        error: 'Upstox logout failed',
        details: err
      });
    });

  }

  /*loadInstruments() {
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
  }*/

};

module.exports = new Upstox(); // singleton class (new Object())
