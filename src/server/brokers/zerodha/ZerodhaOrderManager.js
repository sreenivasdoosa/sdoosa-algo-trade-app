/*
  Author: Sreenivas Doosa
*/

import Zerodha from './Zerodha.js';

class ZerodhaOrderManager {

  constructor() {
    this.kiteConnect = Zerodha.getKiteConnect();
  }

  placeOrder(orderDetails, product = 'MIS') {
    const variety = 'regular';
    const params = {
      exchange: orderDetails.exchange || 'NSE',
      tradingsymbol: orderDetails.tradingSymbol,
      transaction_type: orderDetails.isBuy ? 'BUY' : 'SELL',
      quantity: parseInt(orderDetails.quantity),
      product: product,
      order_type: orderDetails.isMarketOrder ? 'MARKET' : 'NRML',
      validity: product === 'MIS' ? 'DAY' : 'IOC',
      price: parseFloat(orderDetails.price)
    };
    
    return this.kiteConnect.placeOrder(variety, params);
  }

  modifyOrder(orderId, opts = {}) { // opts contains newPrice, newQuantity etc
    const variety = 'regular';
    const params = {};
    if (opts.newQuantity) {
      params.quantity = parseInt(opts.newQuantity);
    }
    if (opts.newPrice) {
      params.price = parseFloat(opts.newPrice);
    }

    return this.kiteConnect.modifyOrder(variety, orderId, params);
  }

  modifyOrderToMarket(orderId) {
    const variety = 'regular';
    const params = {
      order_type: 'MARKET'
    };

    return this.kiteConnect.modifyOrder(variety, orderId, params);
  }

  placeSLOrder(orderDetails, product = 'MIS') {
    const variety = 'regular';
    const params = {
      exchange: orderDetails.exchange || 'NSE',
      tradingsymbol: orderDetails.tradingSymbol,
      transaction_type: orderDetails.isBuy ? 'BUY' : 'SELL',
      quantity: parseInt(orderDetails.quantity),
      product: product,
      order_type: orderDetails.isMarketOrder ? 'SL-M' : 'SL',
      validity: product === 'MIS' ? 'DAY' : 'IOC',
      price: parseFloat(orderDetails.price),
      trigger_price: parseFloat(orderDetails.triggerPrice)
    };
    
    return this.kiteConnect.placeOrder(variety, params);
  }

  modifySLPrder(orderId, opts = {}) { // opts contains newPrice, newTriggerPrice, newQuantity etc
    const variety = 'regular';
    const params = {};
    if (opts.newQuantity) {
      params.quantity = parseInt(opts.newQuantity);
    }
    if (opts.newPrice) {
      params.price = parseFloat(opts.newPrice);
    }
    if (opts.newTriggerPrice) {
      params.trigger_price = parseFloat(opts.newTriggerPrice);
    }

    return this.kiteConnect.modifyOrder(variety, orderId, params);
  }

  cancelOrder(orderId) {
    const variety = 'regular';

    return this.kiteConnect.cancelOrder(variety, orderId);
  }

  getOrder(orderId) { // this fetches the order with the latest status

    return this.kiteConnect.getOrderHistory(orderId).then(orders => {
      if (!orders || orders.length === 0) {
        return null;
      }
      
      // last history is the latest status of the order
      return orders[orders.length - 1];
    });
  }

}

module.exports = new ZerodhaOrderManager(); // singleton class
