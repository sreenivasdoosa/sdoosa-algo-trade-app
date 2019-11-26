/*
  Author: Sreenivas Doosa
*/

var dispatcher = require("../dispatcher");
var config = require("../config.js");
var HttpRequest = require("request");

function StocksStore() {
  var listeners = [];
  var activeStocks = [];

  function onChange(listener) {
    listeners.push(listener);
  }

  function getStocks() {
    return new Promise(function (resolve, reject) {
      HttpRequest(config.serverHost + "/apis/stocks", { json: true }, function (err, resp, stocks) {
        if (err || stocks.result === 'Not logged in') {
          resolve([]);
        } else {
          activeStocks = stocks;
          resolve(stocks);
        }
      });
    });
  }

  function addStock(stock) {
    var index = activeStocks.findIndex(function (elem) {
      if (stock === elem.tradingSymbol) {
        return true;
      }
      return false;
    });
    if (index !== -1) return;
    var data = { stocks: [stock] };
    return new Promise(function (resolve, reject) {
      HttpRequest.post({
        url: config.serverHost + "/apis/stocks/add",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }, function (err, resp, body) {
        if (!err) {
          console.log(body);
          getStocks().then(function () {
            triggerListeners();
          });
        } else {
          console.log(err);
        }
      });
    });
  }

  function removeStock(stock) {
    var index = activeStocks.findIndex(function (elem) {
      if (stock === elem.tradingSymbol) {
        return true;
      }
      return false;
    });
    if (index === -1) return;
    return new Promise(function (resolve, reject) {
      HttpRequest.delete({
        url: config.serverHost + "/apis/stocks/" + stock
      }, function (err, resp, body) {
        if (!err) {
          activeStocks.splice(index, 1);
          triggerListeners();
        } else {
          console.log(err);
        }
      });
    });
  }

  function updateStock(stockData) {
    var data = { stocks: [stockData] };
    return new Promise(function (resolve, reject) {
      HttpRequest.post({
        url: config.serverHost + "/apis/stocks/update",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }, function (err, resp, body) {
        if (!err) {
          console.log(body);
          getStocks().then(function () {
            triggerListeners();
          });
        } else {
          console.log(err);
        }
      });
    });
  }

  function triggerListeners() {
    listeners.forEach(function (listener) {
      listener(activeStocks);
    });
  }

  dispatcher.register(function (payload) {
    var split = payload.type.split(":");
    if (split[0] === "stocks") {
      switch (split[1]) {
        case "addStock":
          addStock(payload.stock);
          break;
        case "removeStock":
          removeStock(payload.stock);
          break;
        case "updateStock":
          updateStock(payload.stock);
          break;
      }
    }
  });

  return {
    getStocks: getStocks,
    onChange: onChange
  };
}

module.exports = StocksStore();
