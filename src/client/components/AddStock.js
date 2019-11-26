/*
  Author: Sreenivas Doosa
*/

import React from "react";
import stockActions from "../actions/StockActions";

class AddStocks extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      symbol: ''
    };

    this.addStock = this.addStock.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    
  }

  addStock (e) {
    e.preventDefault();
    stockActions.addStock(this.state.symbol);
    this.setState({ symbol: '' });
  }

  handleInputChange(e) {
    e.preventDefault();
    if (e.target.name === 'symbol') {
      this.setState({ symbol: e.target.value });
    }
  }

  render() {
    return (
      <form className="form" onSubmit={this.addStock}>
        <div className="form-group">
          <label className="control-label" htmlFor="symbol">Enter Stock Symbol to add:</label>
          <input type="text" className="form-control" id="symbol" name="symbol" value={this.state.symbol} onChange={this.handleInputChange} placeholder="Symbol" />
        </div>
        <div className="form-group">
          <button className="btn" type="submit">Add Stock</button>
        </div>
      </form>
    );
  }
}

export default AddStocks;
