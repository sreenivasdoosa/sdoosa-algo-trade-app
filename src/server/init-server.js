/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import fs from 'fs-extra';
import { getAppStoragePath, getConfig, getUsers } from './config.js';
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import Zerodha from './brokers/zerodha/Zerodha.js';
import Upstox from './brokers/upstox/Upstox.js';
import logger from './logger/logger.js';
import uuid from 'uuid/v4';
import session from 'express-session';
import passport from 'passport';
import AlgoManager from './core/AlgoManager.js';
import TradeManager from './core/TradeManager.js';
import http from 'http';
import https from 'https';

const LocalStrategy = require('passport-local').Strategy;

const appStoragePath = getAppStoragePath();
const config = getConfig();
const users = getUsers();

// configure passport.js to use the local strategy
passport.use(new LocalStrategy({ usernameField: 'username' }, // default is anyhow username
  (username, password, done) => {
    const user = _.find(users, u => u.username === username);
    if (!user) {
      return done('Invalid credentials.', null);
    }
    if (user.password !== password) {
      return done('Invalid credentials.', user);
    }
    done(null, user);
  }
));

// tell passport how to serialize the user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = _.find(users, u => u.id === id);
  if (!user) {
    return done('Invalid user', false);
  }
  done(null, user);
});

const app = express();
// body parser middleware is for handling post requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// for authentication and sessions
app.use(session({
  genid: (req) => {
    return uuid(); // use UUIDs for session IDs
  },
  secret: 'dsadada ssada d afsaf asfa',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

const HTTP_PORT = config.server.port || 8080;
const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, () => {
  logger.info('Algo trading app server started and listening on port [' + HTTP_PORT + ']');
});

// configuration for SSL (https)
const enableSSL = _.get(config, 'server.enableSSL', false);
const HTTPS_PORT = _.get(config, 'server.sslPort', 8443);
if (enableSSL === true) {
  const sslKey = fs.readFileSync([appStoragePath, 'ssl-cert', 'server.key'].join(path.sep), 'utf8');
  const sslCertificate = fs.readFileSync([appStoragePath, 'ssl-cert', 'server.cert'].join(path.sep), 'utf8');

  const httpsServer = https.createServer({ key: sslKey, cert: sslCertificate }, app);
  httpsServer.listen(HTTPS_PORT, () => {
    logger.info('Algo trading app server started and listening on SSL port [' + HTTPS_PORT + ']');
  });
}

// map the '/' client UI code through static directory path
app.use('/', express.static(path.join(__dirname, '../../dist/client')));

const getBrokerFromRequest = (req) => {
  let broker = _.get(req, 'query.broker');
  if (_.isEmpty(broker)) {
    logger.info(`Broker is empty, hence using default broker zerodha`);
    broker = "zerodha";
  }
  return broker;
};

const sendBrokerNotSupportedError = (res, broker, context = '') => {
  logger.warn(`${context}: Broker = ${broker} not yet supported`);
  res.status(400).send({
    error: `Broker ${broker} not supported`
  });
};

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user) => {
    if (err || !user) {
      logger.error('Authentication failed. ' + err);
      return res.status(400).send({
        error: err || 'Invalid credentials'
      });
    }
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.status(200).send({
        user: _.omit(user, 'password')
      });
    });
  })(req, res, next);
});

app.get('/authentication/status', (req, res) => {
  res.status(200).send({
    isAuthenticated: req.isAuthenticated(),
    user: _.omit(req.user, 'password')
  });
});

// Protected APIs
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
};

app.post('/logout', isAuthenticated, (req, res, next) => {
  req.logout();
  res.status(201).send();
});

app.get('/apis/broker/login', isAuthenticated, (req, res) => {

  const broker = getBrokerFromRequest(req);
  logger.info(`Broker Login: broker  = ${broker}`);

  switch (broker) {
    case 'zerodha':
      Zerodha.login(req, res);
      break;

    case 'upstox':
      Upstox.login(req, res);
      break;

    default:
      sendBrokerNotSupportedError(res, broker, 'Login');
  }

});

app.post('/apis/broker/logout', isAuthenticated, (req, res) => {
  const broker = getBrokerFromRequest(req);
  logger.info(`Broker Logout: broker = ${broker}`);

  switch (broker) {
    case 'zerodha':
      Zerodha.logout(req, res);
      break;

    case 'upstox':
      Upstox.logout(req, res);
      break;

    default:
      sendBrokerNotSupportedError(res, broker, 'Logout');
  }
});

app.get('/apis/broker/logincheck', isAuthenticated, (req, res) => {
  const broker = getBrokerFromRequest(req);
  logger.info(`Broker LoginCheck: broker = ${broker}`);

  switch (broker) {
    case 'zerodha':
      res.status(200).send({
        isLoggedIn: Zerodha.isLoggedIn()
      });
      break;

    case 'upstox':
      res.status(200).send({
        isLoggedIn: Upstox.isLoggedIn()
      });;
      break;

    default:
      sendBrokerNotSupportedError(res, broker, 'LoginChek');
  }
});

app.post('/apis/algo/start', isAuthenticated, (req, res) => {
  const broker = getBrokerFromRequest(req);
  logger.info(`AlgoStart: broker = ${broker}`);

  AlgoManager.startAlgo(req, res, broker);
});

app.post('/apis/algo/stop', isAuthenticated, (req, res) => {
  const broker = getBrokerFromRequest(req);
  logger.info(`AlgoStop: broker = ${broker}`);

  AlgoManager.stopAlgo(req, res, broker);
});

app.get('/apis/algo/status', isAuthenticated, (req, res) => {
  const broker = getBrokerFromRequest(req);
  logger.info(`AlgoStatus: broker  = ${broker}`);

  res.status(200).send({
    isAlgoRunning: AlgoManager.isAlgoRunning(broker)
  });

});

app.get('/apis/trades/active', (req, res) => {
  const broker = getBrokerFromRequest(req);
  logger.info(`ActiveTrades: broker = ${broker}`);

  const tm = TradeManager.getInstance();
  switch (broker) {
    case 'zerodha':
    case 'upstox':
      res.status(200).send(tm.getActiveTrades(broker));
      break;

    default:
      sendBrokerNotSupportedError(res, 'ActiveTrades');
  }

});

app.get('/apis/trades/completed', (req, res) => {
  const broker = getBrokerFromRequest(req);
  logger.info(`CompltedTrades: broker = ${broker}`);

  const tm = TradeManager.getInstance();
  switch (broker) {
    case 'zerodha':
    case 'upstox':
      res.status(200).send(tm.getCompletedTrades(broker));
      break;

    default:
      sendBrokerNotSupportedError(res, broker, 'CompletedTrades');
  }
});

