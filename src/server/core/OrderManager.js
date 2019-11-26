/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import ZerodhaOrderManager from '../brokers/zerodha/ZerodhaOrderManager.js';
import UpstoxOrderManager from '../brokers/upstox/UpstoxOrderManager.js';

class OrderManager {

  /*
   This is compostion class of all order manager classes of different brokers.
   This should be the single point of calling of order related APIs for all brokers.
  */

  constructor() {

  }

  convertToCommonResponse(resp, broker) {
    switch (broker) {
      case 'zerodha':
        return {
          ...resp,
          broker,
          orderId: resp.order_id,
          status: _.toUpper(resp.status),
          tradingSymbol: _.toUpper(resp.tradingsymbol),
          parentOrderId: resp.parentOrderId,
          averagePrice: parseFloat(resp.average_price),
          triggerPrice: parseFloat(resp.trigger_price),
          filledQuantity: parseInt(resp.filled_quantity),
          quantity: parseInt(resp.quantity),
          pendingQuantity: parseInt(resp.pending_quantity)
        };

      case 'upstox':
        return {
          ...resp.data,
          broker,
          orderId: resp.data.order_id,
          status: _.toUpper(resp.data.status),
          tradingSymbol: _.toUpper(resp.data.symbol),
          parentOrderId: resp.data.parentOrderId,
          averagePrice: parseFloat(resp.data.average_price),
          triggerPrice: parseFloat(resp.data.trigger_price),
          filledQuantity: parseInt(resp.data.traded_quantity),
          quantity: parseInt(resp.data.quantity),
          pendingQuantity: parseInt(resp.data.quantity) - parseInt(resp.data.traded_quantity)
        };

      default:
        return resp;
    }
  }

  placeOrder(broker, orderDetails, product) { // product -> to tell intrady/positional etc. value depends on broker
    switch (broker) {
      case 'zerodha':
        return ZerodhaOrderManager.placeOrder(orderDetails, product).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      case 'upstox':
        return UpstoxOrderManager.placeOrder(orderDetails, product).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      default:
        throw `placeOrder: broker ${broker} not supported`;
    }
  }

  modifyOrder(broker, orderId, opts = {}) { // opts contains newPrice, newQuantity etc
    switch (broker) {
      case 'zerodha':
        return ZerodhaOrderManager.modifyOrder(orderId, opts).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      case 'upstox':
        return UpstoxOrderManager.modifyOrder(orderId, opts).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      default:
        throw `modifyOrder: broker ${broker} not supported`;
    }
  }

  modifyOrderToMarket(broker, orderId) {
    switch (broker) {
      case 'zerodha':
        return ZerodhaOrderManager.modifyOrderToMarket(orderId).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      case 'upstox':
        return UpstoxOrderManager.modifyOrderToMarket(orderId).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      default:
        throw `modifyOrderToMarket: broker ${broker} not supported`;
    }
  }

  placeSLOrder(broker, orderDetails, product) {
    switch (broker) {
      case 'zerodha':
        return ZerodhaOrderManager.placeSLOrder(orderDetails, product).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      case 'upstox':
        return UpstoxOrderManager.placeSLOrder(orderDetails, product).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      default:
        throw `placeSLOrder: broker ${broker} not supported`;
    }
  }

  modifySLPrder(broker, orderId, opts = {}) { // opts contains newPrice, newTriggerPrice, newQuantity etc
    switch (broker) {
      case 'zerodha':
        return ZerodhaOrderManager.modifySLPrder(orderId, opts).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      case 'upstox':
        return UpstoxOrderManager.modifySLPrder(orderId, opts).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      default:
        throw `modifySLPrder: broker ${broker} not supported`;
    }
  }

  cancelOrder(broker, orderId) {
    switch (broker) {
      case 'zerodha':
        return ZerodhaOrderManager.cancelOrder(orderId).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      case 'upstox':
        return UpstoxOrderManager.cancelOrder(orderId).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      default:
        throw `cancelOrder: broker ${broker} not supported`;
    }
  }

  getOrder(broker, orderId) {
    switch (broker) {
      case 'zerodha':
        return ZerodhaOrderManager.getOrder(orderId).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      case 'upstox':
        return UpstoxOrderManager.getOrder(orderId).then(resp => {
          // convert the response to common response
          return this.convertToCommonResponse(resp, broker);
        });

      default:
        throw `getOrder: broker ${broker} not supported`;
    }
  }
}

module.exports = new OrderManager(); // singleton class
