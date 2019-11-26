/*
  Author: Sreenivas Doosa
*/

var dispatcher = require("../dispatcher");

function DataStore() {
  var listeners = [];
  var activeTrades = [];
  var completedTrades = [];

  function onChange(listener) {
    listeners.push(listener);
  }

  function updateActiveTrades(data) {
    activeTrades = data;
    triggerListeners();
  }

  function updateCompletedTrades(data) {
    completedTrades = data;
    triggerListeners();
  }

  function triggerListeners() {
    listeners.forEach(function (listener) {
      listener({
        activeTrades,
        completedTrades
      });
    });
  }

  dispatcher.register(function (payload) {
    var split = payload.type.split(":");
    if (split[0] === "data") {
      switch (split[1]) {
        case "updateActiveTrades":
          updateActiveTrades(payload.data);
          break;
        case "updateCompletedTrades":
          updateCompletedTrades(payload.data);
          break;
      }
    }
  });

  return {
    onChange: onChange
  };
}

module.exports = DataStore();
