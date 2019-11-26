/*
  Author: Sreenivas Doosa
*/

import React from "react";
import Utils from "../utils";

class TradesSummary extends React.Component {
  
  render() {
    let allTrades = this.props.activeTrades || [];
    allTrades = allTrades.concat(this.props.completedTrades || []);

    // calculate PL, charges and Net PL for each strategy
    var strategies = [];
    allTrades.forEach(function (trade) {
      var found = strategies.find(function (s) {
        return s.strategy === trade.strategy;
      });
      if (!found) {
        strategies.push({
          strategy: trade.strategy
        });
      }
    });

    strategies.forEach(function (strategyData) {
      var trades = allTrades.filter(function (trade) {
        return trade.strategy === strategyData.strategy;
      });

      strategyData.summary = Utils.calculateTradesSummary(trades);
    });

    // add the total as a strategy at the end of the strategies array
    strategies.push({
      strategy: 'Total',
      summary: Utils.calculateTradesSummary(allTrades)
    });


    return (
      <div className="col-md-5">
        <table className="table" lastrow-highlight="true">
          <thead>
            <tr>
              <th>Summary</th>
              {
                strategies.map(function (s, index) {
                  return (<th key={index} className="number-right">{s.strategy}</th>);
                })
              }
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PL</td>
              {
                strategies.map(function (s, index) {
                  return (<td key={index} className={s.summary.totalPL > 0 ? "number-right number-pos" : "number-right number-neg"}>{s.summary.totalPL}</td>);
                })
              }
            </tr>
            <tr>
              <td>Charges</td>
              {
                strategies.map(function (s, index) {
                  return (<td key={index} className="number-right">{s.summary.totalCharges}</td>);
                })
              }
            </tr>
            <tr>
              <td>Net PL</td>
              {
                strategies.map(function (s, index) {
                  return (<td key={index} className={s.summary.totalNetPL > 0 ? "number-right number-pos" : "number-right number-neg"}>{s.summary.totalNetPL}</td>);
                })
              }
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}

export default TradesSummary;
