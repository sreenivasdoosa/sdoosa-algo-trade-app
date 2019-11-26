/*
  Author: Sreenivas Doosa
*/

import React from "react";
import TradeData from "./TradeData.js";
import Utils from "../utils";

class ActiveTrades extends React.Component {
  
  render() {
    let summary = Utils.calculateTradesSummary(this.props.trades);

    return (
      <div>
        <h3>Active Trades</h3>
        <div className="row">
          <div className="col-lg-12">
            <table className="table" lastrow-highlight="true">
              <thead>
                <tr>
                  <th>SNo</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Strategy</th>
                  <th>Trade Start</th>
                  <th>Quantity</th>
                  <th>Req Entry</th>
                  <th>Entry</th>
                  <th>StopLoss</th>
                  <th>CMP</th>
                  <th>Profit/Loss</th>
                  <th>Charges</th>
                  <th>Net P/L</th>
                  <th>PL Percent</th>
                </tr>
              </thead>
              <tbody>
                {
                  this.props.trades.map(function (td, index) {
                    return (
                      <TradeData trade={td} sno={index + 1} key={"trade" + index} />
                    );
                  })
                }
                <tr>
                  <td colSpan="10">TOTAL PROFIT/LOSS</td>
                  <td className={summary.totalPL > 0 ? "number-right number-pos" : "number-right number-neg"}>{summary.totalPL}</td>
                  <td>{summary.totalCharges}</td>
                  <td className={summary.totalNetPL > 0 ? "number-right number-pos" : "number-right number-neg"}>{summary.totalNetPL}</td>
                  <td>{' '}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

export default ActiveTrades;

