/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import Upstox from './Upstox.js';
import { getOrderStatusPriority } from '../../utils/utils.js';

class UpstoxOrderManager {

  constructor() {
    this.upstoxConnect = Upstox.getUpstoxConnect();
  }

  placeOrder(orderDetails, product = 'MIS') {
    const params = {
      exchange: (orderDetails.exchange === 'NSE' || _.isEmpty(orderDetails.exchange)) ? 'NSE_EQ' : orderDetails.exchange,
      symbol: orderDetails.tradingSymbol,
      transaction_type: orderDetails.isBuy ? 'B' : 'S',
      quantity: parseInt(orderDetails.quantity),
      product: product === 'MIS' ? 'I' : '', // TODO: else case. The product (I: Intraday Order, D: Delivery Order, CO: Cover Order,OCO: Bracket Order)
      order_type: orderDetails.isMarketOrder ? 'M' : 'L', // The type of order to place. l : Limit Order, m : Market Order
      duration: product === 'MIS' ? 'DAY' : 'IOC',
      price: parseFloat(orderDetails.price)
    };
    
    console.log('Upstox placing order => ', params);
    return this.upstoxConnect.placeOrder(params);
  }

  modifyOrder(orderId, opts = {}) { // opts contains newPrice, newQuantity etc
    const params = {
      order_id: orderId
    };
    if (opts.newQuantity) {
      params.quantity = parseInt(opts.newQuantity);
    }
    if (opts.newPrice) {
      params.price = parseFloat(opts.newPrice);
    }

    console.log('Upstox modify order => ', params);
    return this.upstoxConnect.modifyOrder(params);
  }

  modifyOrderToMarket(orderId) { // TODO: seems this is not supported by upstox need to test
    const params = {
      order_id: orderId,
      order_type: 'm'
    };

    return this.upstoxConnect.modifyOrder(params);
  }

  placeSLOrder(orderDetails, product = 'MIS') {
    const params = {
      exchange: orderDetails.exchange === 'NSE' ? 'NSE_EQ' : orderDetails.exchange,
      symbol: orderDetails.tradingSymbol,
      transaction_type: orderDetails.isBuy ? 'B' : 'S',
      quantity: parseInt(orderDetails.quantity),
      product: product === 'MIS' ? 'I' : '', // TODO: else case
      order_type: orderDetails.isMarketOrder ? 'SL-M' : 'SL',
      validity: product === 'MIS' ? 'DAY' : 'IOC',
      price:  orderDetails.isMarketOrder ? 0 : parseFloat(orderDetails.price),
      trigger_price: parseFloat(orderDetails.triggerPrice)
    };
    
    return this.upstoxConnect.placeOrder(params);
  }

  modifySLPrder(orderId, opts = {}) { // opts contains newPrice, newTriggerPrice, newQuantity etc
    const params = {
      order_id: orderId
    };
    if (opts.newQuantity) {
      params.quantity = parseInt(opts.newQuantity);
    }
    if (opts.newPrice) {
      params.price = parseFloat(opts.newPrice); // appicable only SL not for SL-M
    }
    if (opts.newTriggerPrice) {
      params.trigger_price = parseFloat(opts.newTriggerPrice);
    }

    return this.upstoxConnect.modifyOrder(params);
  }

  cancelOrder(orderId) {
    const params = {
      order_id: orderId
    };
    return this.upstoxConnect.cancelOrder(params);
  }

  getOrder(orderId) { // this fetches the order with the latest status
    const params = {
      order_id: orderId
    };

    return this.upstoxConnect.getOrders(params).then(resp => {
      console.log('Upstox order resp => ', resp);
      let latestOrder = null;
      if (resp.data) {
        // return the latest status order by checking the priority
        _.each(resp.data, order => {
          if (latestOrder === null 
            || getOrderStatusPriority(order.status) > getOrderStatusPriority(latestOrder.status)) {
            latestOrder = order;
          }
        });
      }

      return {
        ...resp,
        data: latestOrder 
      };
    });
  }

}

module.exports = new UpstoxOrderManager(); // singleton class
