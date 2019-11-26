/*
  Author: Sreenivas Doosa
*/

import React from "react";
import stockActions from "../actions/StockActions";

class StockInfo extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      tradingCapital: this.props.stock.tradingCapital,
      profitBookingMode: this.props.stock.profitBookingMode,
      tradingEnabled: this.props.stock.tradingEnabled
    };

    this.removeStock = this.removeStock.bind(this);
    this.updateStock = this.updateStock.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    
  }

  removeStock(e) {
    e.preventDefault();
    stockActions.removeStock(this.props.stock.tradingSymbol);
  }

  updateStock(e) {
    e.preventDefault();
    stockActions.updateStock({
      tradingSymbol: this.props.stock.tradingSymbol,
      tradingCapital: this.state.tradingCapital,
      tradingEnabled: this.state.tradingEnabled,
      profitBookingMode: this.state.profitBookingMode // not used now
    });
  }

  handleInputChange(e) {
    e.preventDefault();
    if (e.target.name === 'tradingCapital') {
      this.setState({ tradingCapital: e.target.value });
    } else if (e.target.name === 'tradingEnabled') {
      var oldVal = this.state.tradingEnabled;
      var newVal = e.target.checked;
      this.setState({ tradingEnabled: e.target.checked });
      if (oldVal !== newVal) {
        setTimeout(() => {
          this.updateStock(e);
        }, 100);
      }
    } else if (e.target.name === 'profitBookingMode') { // not used now
      var oldVal = this.state.profitBookingMode;
      var newVal = e.target.checked;
      this.setState({ profitBookingMode: e.target.checked });
      if (oldVal !== newVal) {
        setTimeout(() => {
          this.updateStock(e);
        }, 100);
      }
    }
  }

  render() {
    return (
      <tr>
        <td>{this.props.stock.tradingSymbol}</td>
        <td>
          <input type="text" className="form-control" id="tradingCapital" name="tradingCapital" maxLength="10"
            value={this.state.tradingCapital} onChange={this.handleInputChange} placeholder="trading capital" />
        </td>
        <td>
          <label className="label">
            <input className="label__checkbox" type="checkbox" id="tradingEnabled" name="tradingEnabled"
              checked={this.state.tradingEnabled} onChange={this.handleInputChange} />
            <span className="label__text">
              <span className="label__check">
                <i className="fa fa-check icon"></i>
              </span>
            </span>
          </label>
        </td>
        <td>
          <button type="button" className="btn btn-primary" onClick={this.updateStock}>Update</button>
          <button type="button" className="btn btn-danger" onClick={this.removeStock}>Remove</button>
        </td>
      </tr>
    );
  }
}

export default StockInfo;
