/*
  Author: Sreenivas Doosa
*/

import dispatcher from "../dispatcher";

module.exports = {
  addStock: function (stock) {
    dispatcher.dispatch({
      stock: stock,
      type: "stocks:addStock"
    });
  },
  removeStock: function (stock) {
    dispatcher.dispatch({
      stock: stock,
      type: "stocks:removeStock"
    });
  },
  updateStock: function (stockData) {
    dispatcher.dispatch({
      stock: stockData,
      type: "stocks:updateStock"
    });
  }
};
