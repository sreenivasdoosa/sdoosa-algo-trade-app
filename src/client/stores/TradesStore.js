/*
  Author: Sreenivas Doosa
*/

var dispatcher = require("../dispatcher");

function TradesStore() {
  var listeners = [];
  var activeTrades = [];
  var completedTrades = [];

  function getActiveTrades() {
    return activeTrades;
  }

  function getCompletedTrades() {
    return completedTrades;
  }

  function onChange(listener) {
    listeners.push(listener);
  }

  function addTrade(trade) {
    activeTrades.push(trade);
    triggerListeners();
  }

  function triggerListeners() {
    listeners.forEach(function (listener) {
      listener(activeTrades);
    });
  }

  dispatcher.register(function (payload) {
    var split = payload.type.split(":");
    if (split[0] === "trade") {
      switch (split[1]) {
        case "addActiveTrade":
          addTrade(payload.trade);
          break;
      }
    }
  });

  return {
    getActiveTrades: getActiveTrades,
    getCompletedTrades: getCompletedTrades,
    onChange: onChange
  };
}

module.exports = TradesStore();
