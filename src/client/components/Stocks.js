/*
  Author: Sreenivas Doosa
*/

import React from "react";
import AddStock from './AddStock.js';
import StockInfo from './StockInfo.js';

class Stocks extends React.Component {

  render () {
    return (
      <div className="col-md-8">
        <h3>Active Stocks</h3>
        <AddStock />
        <div >
          <table className="table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Trade Capital</th>
                <th>Trade On/Off</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {
                this.props.stocks.map(function (stock, index) {
                  return (
                    <StockInfo stock={stock} key={"stock" + index} />
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default Stocks;
