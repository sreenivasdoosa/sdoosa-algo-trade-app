/*
  Author: Sreenivas Doosa
*/

import dispatcher from "../dispatcher";

module.exports = {
  updateActiveTrades: function (data) {
    dispatcher.dispatch({
      data: data,
      type: "data:updateActiveTrades"
    });
  },
  updateCompletedTrades: function (data) {
    dispatcher.dispatch({
      data: data,
      type: "data:updateCompletedTrades"
    });
  }
};
