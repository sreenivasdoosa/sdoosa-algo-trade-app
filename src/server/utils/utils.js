/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import { getHolidays }  from '../config.js';

const holidays = getHolidays();

const SUNDAY = 0;
const SATURDAY = 6;

const COMPLETE = "COMPLETE";
const OPEN = "OPEN";
const OPEN_PENDING = "OPEN PENDING";
const VALIDATION_PENDING = "VALIDATION PENDING";
const PUT_ORDER_REQ_RECEIVED = "PUT ORDER REQ RECEIVED";
const REJECTED = "REJECTED";
const CANCELLED = "CANCELLED";
const TRIGGER_PENDING = "TRIGGER PENDING";

export const OrderStatus = {
  COMPLETE: COMPLETE,
  OPEN: OPEN,
  OPEN_PENDING: OPEN_PENDING,
  VALIDATION_PENDING: VALIDATION_PENDING,
  PUT_ORDER_REQ_RECEIVED: PUT_ORDER_REQ_RECEIVED,
  REJECTED: REJECTED,
  CANCELLED: CANCELLED,
  TRIGGER_PENDING: TRIGGER_PENDING
};

export const getOrderStatusPriority = (status) => {

  status = _.toUpper(status);

  if (status === COMPLETE || status === REJECTED || status === CANCELLED)
    return 100;
  if (status === OPEN || status === TRIGGER_PENDING)
    return 99;
  if (status === OPEN_PENDING)
    return 98;
  if (status === VALIDATION_PENDING)
    return 97;
  if (status === PUT_ORDER_REQ_RECEIVED)
    return 96;

  return 1; // 1 being the least priority
};

export const leadZeros = (val, positions = 2) => {
  const s = "0" + val;
  return s.substr(s.length - positions);
};

export const formatTimestampToString = (d, includeMilliseconds = false) => {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hours = d.getHours();
  const mins = d.getMinutes();
  const seconds = d.getSeconds();
  const milliseconds = d.getMilliseconds();
  let dateStr = year + "-" + leadZeros(month) + "-" + leadZeros(date) + " " + leadZeros(hours) + ":" + leadZeros(mins) + ":" + leadZeros(seconds);
  if (includeMilliseconds) {
    dateStr = dateStr + "." + leadZeros(milliseconds, 3);
  }
  return dateStr;
};

export const formatDateToString = (d) => {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dateStr = year + "-" + leadZeros(month) + "-" + leadZeros(date);
  return dateStr;
};

export const formatDateToDDMMYYYY = (d) => {
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dateStr = leadZeros(date) + "-" + leadZeros(month) + "-" + year;
  return dateStr;
};

export const parseTimestamp = (timestampStr) => {
  return new Date(Date.parse(timestampStr));
};

export const getMarketStartTime = (date) => {
  if (_.isNil(date)) {
    date = new Date();
  }

  date.setHours(9);
  date.setMinutes(15);
  date.setSeconds(0);
  date.setMilliseconds(0);

  return date;
};

export const getMarketEndTime = (date) => {
  if (_.isNil(date)) {
    date = new Date();
  }

  date.setHours(15);
  date.setMinutes(30);
  date.setSeconds(0);
  date.setMilliseconds(0);

  return date;
};

export const getIntradaySquareOffTime = (date) => {
  if (_.isNil(date)) {
    date = new Date();
  }
  const squareOffTime = new Date(date);

  squareOffTime.setHours(15);
  squareOffTime.setMinutes(13); // NOTE: upstox auto squares off at 15:15 hence algo square should be at least 2 mins before it
  squareOffTime.setSeconds(0);
  squareOffTime.setMilliseconds(0);

  return squareOffTime;
};

export const isHoliday = (date) => {
  if (_.isNil(date)) {
    date = new Date();
  }
  if (date.getDay() === SUNDAY || date.getDay() === SATURDAY) {
    return true;
  }

  const dateStr = formatDateToString(date);
  return _.some(holidays || [], h => dateStr === h);
};

export const isMarketOpen = () => {
  const now = new Date();

  if (isHoliday(now)) {
    return false;
  }

  return now >= getMarketStartTime() && now <= getMarketEndTime();
};

export const isMarketClosedForTheDay = () => {
  const now = new Date();
  if (isHoliday(now)) {
    return true;
  }

  return now > getMarketEndTime();
};

export const roundOff = (value) => {
  return value.toFixed(2);
};

export const roundToValidPrice = (value, exchange = 'NSE') => {

  value = roundOff(value);

  if (exchange === 'NSE') { // NSE doesnt support 100.11, 99.34 etc. so changing them to 100.10 & 99.35
    const mid = value * 20;
    value = Math.ceil(mid);
    value = value / 20;
  }
  return value;
};

export const getStartTimeOfTheDay = (date) => {
  if (_.isNil(date)) {
    date = new Date();
  }

  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);

  return date;
};

export const getNumberOfDaysBetweenTwoDates = (date1, date2) => {
  const diffMillis = Math.abs(getStartTimeOfTheDay(date1) - getStartTimeOfTheDay(date2));
  return parseInt(diffMillis / (1000 * 60 * 60 * 24));
};

export const percentageChange = (current, prev) => {
  return roundOff(((current - prev) / prev) * 100);
};

export const calculateSharesWithRiskFactor = (capital, entry, stopLoss, percetageCapticalToRisk) => {

  const amountToRisk = capital * percetageCapticalToRisk / 100;
  const riskPerShare = Math.abs(stopLoss - entry);

  let numShares = parseInt(amountToRisk / riskPerShare);
  if (numShares == 0) {
    numShares = 1;
  }
  return numShares;
};

export const isIntradaySquareOffTime = (date) => {
  if (_.isNil(date)) {
    date = new Date();
  }

  const squareOffTime = getIntradaySquareOffTime(date);
  return date.getTime() >= squareOffTime.getTime();
};

export const calculateIntraDayCharges = (trade) => {
  // The charges calculated are as per Zerodha
  const entry = trade.entry;
  const exit = trade.isActive ? trade.entry : trade.exit;

  const brokerageBuy = Math.min(entry * trade.quantity * 0.01 / 100, 20);
  const brokerageSell = Math.min(exit * trade.quantity * 0.01 / 100, 20);

  const turnoverChargesBuy = entry * trade.quantity * 0.00325 / 100;
  const turnoverChargesSell = exit * trade.quantity * 0.00325 / 100;

  const brokeragePlusTurnover = brokerageBuy + brokerageSell + turnoverChargesBuy + turnoverChargesSell;
  const GST = brokeragePlusTurnover * 18 / 100;

  const STTBuy = 0;
  const STTSell = exit * trade.quantity * 0.025 / 100; // on sell side only

  const sebiChargesBuy = entry * trade.quantity * 0.00015 / 100;
  const sebiChargesSell = exit * trade.quantity * 0.00015 / 100;

  // for Karnataka 0.003% of transaction value
  const stampDutyBuy = entry * trade.quantity * 0.003 / 100;
  const stampDutySell = exit * trade.quantity * 0.003 / 100;

  const totalCharges = brokeragePlusTurnover + GST + STTBuy + STTSell + sebiChargesBuy + sebiChargesSell + stampDutyBuy + stampDutySell;

  return roundOff(totalCharges);
};

export const calculateProfitLossCharges = (trade, isActive) => {
  if (isActive) {
    trade.profitLoss = trade.tradeType === 'LONG' ? trade.cmp - trade.entry : trade.entry - trade.cmp;
    trade.profitLoss = roundOff(trade.profitLoss) * (trade.order ? trade.order.filledQuantity : 0);
  } else { // completed trade
    trade.profitLoss = trade.tradeType === 'LONG' ? trade.exit - trade.entry : trade.entry - trade.exit;
    trade.profitLoss = roundOff(trade.profitLoss) * (trade.order ? trade.quantity : 0);
  }
  trade.charges = calculateIntraDayCharges(trade);
  trade.netProfitLoss = roundOff(trade.profitLoss - trade.charges);
  const totalValue = trade.entry * (trade.order ? trade.order.filledQuantity : 0);
  if (totalValue > 0) {
    trade.plPercentage = roundOff(trade.netProfitLoss * 100 / totalValue);
  }
  return trade;
};

export const getDiffBetweenCandlesInSeconds = (interval) => {
  return 60 * parseInt(interval);
};

export const areCandlesUptoDate = (candles, interval) => {

  const diffBetweenCandlesSeconds = getDiffBetweenCandlesInSeconds(interval);

  if (diffBetweenCandlesSeconds === 0) {
    return false;
  }

  const currentTime = parseInt(new Date().getTime() / 1000);
  if (_.isNil(candles) || candles.length === 0) {
    const marketStartTime = parseInt(getMarketStartTime().getTime() / 1000);
    if (currentTime - marketStartTime >= diffBetweenCandlesSeconds) {
      return false;
    }
  } else {
    const marketEndTime = parseInt(getMarketEndTime().getTime() / 1000);
    const lastCandleEndTime = parseInt(candles[candles.length - 1].timestamp.getTime() / 1000) + diffBetweenCandlesSeconds;
    if (lastCandleEndTime < marketEndTime &&
      currentTime - lastCandleEndTime >= diffBetweenCandlesSeconds) {

      return false;
    }
  }

  return true;
};

export const removeLatestUnclosedCandle = (candles, interval) => {
  const diffBetweenCandlesSeconds = getDiffBetweenCandlesInSeconds(interval);

  if (_.isNil(candles) || candles.length === 0) {
    return candles;
  }

  const lastCandleEndTime = parseInt(candles[candles.length - 1].timestamp.getTime() / 1000) + diffBetweenCandlesSeconds;
  const currentTime = parseInt(new Date().getTime() / 1000);
  if (currentTime < lastCandleEndTime) {
    // removing the last candle
    candles = _.slice(candles, 0, candles.length - 1);
  }
  return candles;
};

export const getNumberOfActualPrevDays = (date, tradingDays) => {
  const fromDate = new Date(date); // cloning
  const actualDays = 0;
  while (tradingDays > 0) {
    if (!isHoliday(fromDate)) {
      tradingDays--;
    }
    fromDate.setDate(fromDate.getDate() - 1);
    actualDays++;
  }
  return actualDays;
};

export const getPrevTradingDayDate = (date) => {
  if (_.isNil(date)) {
    date = new Date();
  }
  const prevDayDate = new Date(date);
  do {
    prevDayDate.setDate(prevDayDate.getDate() - 1);
  } while (isHoliday(prevDayDate));
  return prevDayDate;
};

export const getDelta = (price) => {
  const delta = 0;
  if (price <= 250) {
    delta = 0.05;
  } else if (price <= 500) {
    delta = 0.1;
  } else if (price <= 1000) {
    delta = 0.15;
  } else if (price <= 2000) {
    delta = 0.2;
  } else if (price <= 3000) {
    delta = 0.25;
  } else if (price <= 4000) {
    delta = 0.3;
  } else if (price <= 5000) {
    delta = 0.4;
  } else {
    delta = 0.5;
  }
  return delta;
};

export const shouldPlaceTrade = (tradeSignal, cmp, considerEqual = false) => {
  if (considerEqual === true) {
    if (tradeSignal.isBuy && cmp >= tradeSignal.trigger) {
      return true;
    }
    if (!tradeSignal.isBuy && cmp <= tradeSignal.trigger) {
      return true;
    }
    return false;

  } else {
    if (tradeSignal.isBuy && cmp > tradeSignal.trigger) {
      return true;
    }
    if (!tradeSignal.isBuy && cmp < tradeSignal.trigger) {
      return true;
    }
    return false;
  }
};
