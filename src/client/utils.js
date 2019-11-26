/*
  Author: Sreenivas Doosa
*/

function leadZeros(val) {
  var s = "0" + val;
  return s.substr(s.length - 2);
};

module.exports.formatDate = function formatDate(epochMillis) {
  var d = new Date(epochMillis);
  var year = d.getFullYear();
  var month = d.getMonth() + 1;
  var date = d.getDate();
  var hours = d.getHours();
  var mins = d.getMinutes();
  var seconds = d.getSeconds();
  var dateStr = year + "-" + leadZeros(month) + "-" + leadZeros(date) + " " + leadZeros(hours) + ":" + leadZeros(mins) + ":" + leadZeros(seconds);
  return dateStr;
};

function roundOff(value) {
  return parseFloat(Math.round(value * 100) / 100).toFixed(2);
};

module.exports.roundOff = roundOff;

module.exports.isMarketOpen = function isMarketOpen() {

  var marketStartTime = new Date();
  marketStartTime.setHours(9, 15, 0);

  var marketEndTime = new Date();
  marketEndTime.setHours(15, 30, 0);

  var now = new Date();

  return now.getTime() >= marketStartTime.getTime() && now.getTime() <= marketEndTime.getTime();
};

module.exports.calculateTradesSummary = function (trades) {

  trades = trades || [];

  var totalPL = 0;
  var totalCharges = 0;
  var totalNetPL = 0;
  trades.forEach(function (t) {
    totalPL = totalPL + Number(t.profitLoss);
    totalCharges = totalCharges + Number(t.charges);
    totalNetPL = totalNetPL + Number(t.netProfitLoss);
  });
  totalPL = roundOff(totalPL);
  totalCharges = roundOff(totalCharges);
  totalNetPL = roundOff(totalNetPL);
  return {
    totalPL,
    totalCharges,
    totalNetPL
  };
};
