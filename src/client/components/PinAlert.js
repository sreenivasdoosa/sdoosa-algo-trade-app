/*
  Author: Sreenivas Doosa
*/

import React from "react";

class PinAlert extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      pin: ''
    };

    this.handlePINChange = this.handlePINChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handlePINChange(event) {
    this.setState({
      pin: event.target.value
    });
  }

  handleSubmit() {
    this.props.onPinSubmit(this.state.pin);
  }

  render() {
    return (
      <div className="pin-alert">
        <label>Enter PIN:
          <input type="password" value={this.state.value} onChange={this.handlePINChange} />
        </label>
        <div>
          <button className="btn btn-warning" onClick={this.handleSubmit}>Submit</button>
        </div>
      </div>
    );
  }
}

export default PinAlert;
