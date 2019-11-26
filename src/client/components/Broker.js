
import React from 'react';
import ActiveTrades from "./ActiveTrades.js";
import CompletedTrades from "./CompletedTrades.js";
import TradesSummary from "./TradesSummary.js";
import BrokerLogin from './BrokerLogin';
import HttpRequest from "request";
import config from "../config.js";
import Utils from "../utils";

const ACTIVE_TRADES_REFRESH_INTERVAL = 30; // in seconds
const COMPLETED_TRADES_REFRESH_INTERVAL = 3 * 60; // in seconds

class Broker extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      broker: '',
      activeTrades: [],
      completedTrades: []
    };

    this.refreshActiveTrades = this.refreshActiveTrades.bind(this);
    this.refreshCompletedTrades = this.refreshCompletedTrades.bind(this);
  }

  componentWillMount() {
    console.log('Broker componentWillMount: name = ' + this.props.broker);
    this.setState({
      broker: this.props.broker
    }, () => {
      this.refreshActiveTrades();
      this.refreshCompletedTrades();
    });
  }

  componentWillReceiveProps(newProps) {
    console.log('Broker componentWillReceiveProps: name = ' + newProps.broker);
    if (this.props.broker !== newProps.broker) {
      this.setState({
        broker: newProps.broker,
        activeTrades: [],
        completedTrades: []
      }, () => {
        if (this.refreshActiveTradesTimer) {
          clearTimeout(this.refreshActiveTradesTimer);
        }
        if (this.refreshCompletedTradesTimer) {
          clearTimeout(this.refreshCompletedTradesTimer);
        }
        this.refreshActiveTrades();
        this.refreshCompletedTrades();
      });
    }
  }

  refreshActiveTrades() {
    HttpRequest(config.serverHost + "/apis/trades/active?broker=" + this.state.broker, { json: true }, (err, resp, trades) => {
      console.log('refreshActiveTrades: resp.statusCode = ' + resp.statusCode);
      if (resp.statusCode === 200) {
        const activeTrades = trades || [];
        activeTrades.forEach(function (td) {
          td.startTimestamp = Utils.formatDate(td.startTimestamp);
          td.profitLoss = Utils.roundOff(td.profitLoss);
          td.charges = Utils.roundOff(td.charges);
          td.netProfitLoss = Utils.roundOff(td.netProfitLoss);
        });
        this.setState({
          activeTrades: activeTrades
        });
      } else {
        this.setState({
          activeTrades: []
        });
        console.error("ActiveTrades: Error. ", err);
      }

      if (Utils.isMarketOpen()) {
        this.refreshActiveTradesTimer = setTimeout(() => {
          this.refreshActiveTrades();
        }, ACTIVE_TRADES_REFRESH_INTERVAL * 1000);
      }
    });
  }

  refreshCompletedTrades() {
    HttpRequest(config.serverHost + "/apis/trades/completed?broker=" + this.state.broker, { json: true }, (err, resp, trades) => {
      console.log('refreshCompletedTrades: resp.statusCode = ' + resp.statusCode);
      if (resp.statusCode === 200) {
        const completedTrades = trades || [];
        completedTrades.forEach(function (td) {
          td.startTimestamp = Utils.formatDate(td.startTimestamp);
          td.endTimestamp = Utils.formatDate(td.endTimestamp);
          td.profitLoss = Utils.roundOff(td.profitLoss);
          td.charges = Utils.roundOff(td.charges);
          td.netProfitLoss = Utils.roundOff(td.netProfitLoss);
        });
        this.setState({
          completedTrades: completedTrades
        });
      } else {
        this.setState({
          completedTrades: []
        });
        console.error("CompletedTrades: Error. ", err);
      }

      if (Utils.isMarketOpen()) {
        this.refreshCompletedTradesTimer = setTimeout(() => {
          this.refreshCompletedTrades();
        }, COMPLETED_TRADES_REFRESH_INTERVAL * 1000);
      }
    });
  }

  render() {
    return (<div className="broker-content">
      <div className='row'>
        <TradesSummary activeTrades={this.state.activeTrades} completedTrades={this.state.completedTrades} />
        <BrokerLogin broker={this.props.broker} />
      </div>
      <ActiveTrades trades={this.state.activeTrades} />
      <CompletedTrades trades={this.state.completedTrades} />
    </div>);
  }
}

export default Broker;
