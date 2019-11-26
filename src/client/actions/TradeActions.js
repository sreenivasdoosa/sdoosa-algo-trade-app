/*
  Author: Sreenivas Doosa
*/

import dispatcher from "../dispatcher";

module.exports = {
  addActiveTrade: function (trade) {
    dispatcher.dispatch({
      trade: trade,
      type: "trade:addActiveTrade"
    });
  }
};
