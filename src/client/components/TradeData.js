/*
  Author: Sreenivas Doosa
*/

import React from "react";
import Utils from "../utils";

class TradeData extends React.Component {
  render() {
    return (
      <tr>
        <td>{this.props.sno}</td>
        <td>{this.props.trade.tradingSymbol}</td>
        <td>{this.props.trade.tradeType}</td>
        <td>{this.props.trade.strategy}</td>
        <td>{this.props.trade.startTimestamp}</td>
        {this.props.complete ?
          (
            <td>{this.props.trade.endTimestamp}</td>
          ) : null
        }
        <td>{this.props.trade.filledQuantity}/{this.props.trade.quantity}</td>
        <td>{Utils.roundOff(this.props.trade.requestedEntry)}</td>
        <td>{Utils.roundOff(this.props.trade.entry)}</td>
        {!this.props.complete ?
          (
            <td>{Utils.roundOff(this.props.trade.stopLoss)}</td>
          ) : null
        }
        <td>{Utils.roundOff(this.props.complete ? this.props.trade.exit : this.props.trade.cmp)}</td>
        <td className={this.props.trade.profitLoss > 0 ? "number-right number-pos" : "number-right number-neg"}>{Utils.roundOff(this.props.trade.profitLoss)}</td>
        <td>{Utils.roundOff(this.props.trade.charges)}</td>
        <td className={this.props.trade.netProfitLoss > 0 ? "number-right number-pos" : "number-right number-neg"}>{Utils.roundOff(this.props.trade.netProfitLoss)}</td>
        <td className={this.props.trade.plPercentage > 0 ? "number-right number-pos" : "number-right number-neg"}>{'' + Utils.roundOff(this.props.trade.plPercentage) + ' %'}</td>
        {this.props.complete ?
          (
            <td>{this.props.trade.exitReason}</td>
          ) : null
        }
      </tr>
    );
  }
}

export default TradeData;
