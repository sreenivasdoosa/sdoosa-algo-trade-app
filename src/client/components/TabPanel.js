import _ from 'lodash';
import React from "react";
import Broker from './Broker.js'; 

const brokers = [
  'zerodha',
  'upstox'
];
const defaultBroker = 'zerodha';

class TabPanel extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      broker: _.isEmpty(props.broker) === false ? props.broker : defaultBroker
    };

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e) {
    const selectedBroker = _.get(e, 'currentTarget.dataset.broker', 'zerodha');
    this.setState({
      broker: selectedBroker
    });
  }

  render() {
    return (<div>
      <ul className="nav nav-tabs">
        {
          _.map(brokers, (broker, index) => {
            return (<li key={index} className={"nav " + (this.state.broker === broker ? "active" : "")} data-broker={broker} onClick={this.handleChange}>
              <a>{_.toUpper(broker)}</a>
            </li>);
          })
        }
      </ul>

      <div className="tab-content">
        <Broker broker={this.state.broker}/>
      </div>
    </div>);
  }
}

export default TabPanel;
