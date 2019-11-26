/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import React from "react";
import HttpRequest from "request";
import config from "../config.js";
import ConfirmationModal from './ConfirmationModal.js';

class BrokerLogin extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      isLoggedIn: false,
      isAlgoRunning: false,
      showLogoutConfirmationModal: false,
      showStopAlgoConfirmationModal: false,
      logInLogoutError: null,
      algoStartStopError: null
    };

    this.checkLogin = this.checkLogin.bind(this);
    this.logIn = this.logIn.bind(this);
    this.logOut = this.logOut.bind(this);
    this.onLogoutButtonClick = this.onLogoutButtonClick.bind(this);

    this.checkAlgoStatus = this.checkAlgoStatus.bind(this);
    this.startAlgo = this.startAlgo.bind(this);
    this.stopAlgo = this.stopAlgo.bind(this);
    this.onStopAlgoButtonClick = this.onStopAlgoButtonClick.bind(this);

    this.closeLogoutConfirmationModal = this.closeLogoutConfirmationModal.bind(this);
    this.closeStopAlgoConfirmationModal = this.closeStopAlgoConfirmationModal.bind(this);
  }

  componentWillMount() {
    this.checkLogin(this.props.broker);
    this.checkAlgoStatus(this.props.broker);
  }

  componentWillReceiveProps(newProps) {
    if (this.props.broker !== newProps.broker) {
  
      // reset state on broker change
      this.setState({
        isLoggedIn: false,
        isAlgoRunning: false,
        showLogoutConfirmationModal: false,
        showStopAlgoConfirmationModal: false,
        logInLogoutError: null,
        algoStartStopError: null
      });

      this.checkLogin(newProps.broker);
      this.checkAlgoStatus(newProps.broker);
    }
  }

  checkLogin(broker) {
    broker = broker || this.props.broker;
    HttpRequest(config.serverHost + "/apis/broker/logincheck?broker=" + broker, { json: true }, (err, resp, data) => {
      if (err) {
        console.error(err);
        this.setState({
          logInLogoutError: `${broker} Could not fetch login status`
        });
        return;
      }
      this.setState({
        isLoggedIn: data.isLoggedIn
      });
    });
  }

  logOut(e) {
    e.preventDefault();
    const broker = this.props.broker;

    this.setState({
      showLogoutConfirmationModal: false,
      logInLogoutError: null
    });

    var data = {};
    HttpRequest.post({
      url: config.serverHost + "/apis/broker/logout?broker=" + broker,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, (err, resp, respBody) => {
      console.log(`${broker}: Logout status code = ${resp.statusCode}`);
      if (resp.statusCode === 200 || resp.statusCode === 201) {
        this.setState({
          isLoggedIn: false
        });
      } else {
        console.error(`${broker}: Error =>`, err);
        respBody = JSON.parse(respBody);
        this.setState({
          logInLogoutError: `${broker} Logout failed.  ` + (respBody.error || '')
        });
      }
    });
  }

  logIn(e) {
    e.preventDefault();
    const broker = this.props.broker;
    window.location.href = config.serverHost + "/apis/broker/login?broker=" + broker;
  }

  onLogoutButtonClick(e) {
    e.preventDefault();

    this.setState({
      showLogoutConfirmationModal: true,
      logInLogoutError: null
    });
  }

  checkAlgoStatus(broker) {
    broker = broker || this.props.broker;
    HttpRequest(config.serverHost + "/apis/algo/status?broker=" + broker, { json: true }, (err, resp, data) => {
      if (err) {
        console.error(err);
        this.setState({
          algoStartStopError: `${broker} could not fetch algo status`
        });
        return;
      }
      this.setState({
        isAlgoRunning: data.isAlgoRunning
      });
    });
  }

  startAlgo(e) {
    e.preventDefault();
    const broker = this.props.broker;

    var data = {};
    HttpRequest.post({
      url: config.serverHost + "/apis/algo/start?broker=" + broker,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, (err, resp, respBody) => {
      console.log(`${broker} start algo status code = ` + resp.statusCode);
      if (resp.statusCode === 200 || resp.statusCode === 201) {
        this.setState({
          isAlgoRunning: true
        });
      } else {
        console.error(`${broker} start algo error => `, err, respBody);
        respBody = JSON.parse(respBody);
        this.setState({
          isAlgoRunning: false,
          algoStartStopError: _.isString(respBody.error) ? respBody.error : 'Failed to start algo.'
        });
      }
    });
  }

  stopAlgo(e) {
    e.preventDefault();
    const broker = this.props.broker;

    this.setState({
      showStopAlgoConfirmationModal: false,
      algoStartStopError: null
    });

    var data = {};
    HttpRequest.post({
      url: config.serverHost + "/apis/algo/stop?broker=" + broker,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, (err, resp, respBody) => {
      console.log(`${broker} stop algo status code = ` + resp.statusCode);
      if (resp.statusCode === 200 || resp.statusCode === 201) {
        this.setState({
          isAlgoRunning: false
        });
      } else {
        console.error(`${broker} stop algo error => `, err, respBody);
        respBody = JSON.parse(respBody);
        this.setState({
          isAlgoRunning: false,
          algoStartStopError: _.isString(respBody.error) ? respBody.error : 'Failed to stop algo.'
        });
      }
    });
  }

  onStopAlgoButtonClick(e) {
    e.preventDefault();

    this.setState({
      showStopAlgoConfirmationModal: true,
      algoStartStopError: null
    });
  }

  closeLogoutConfirmationModal() {
    this.setState({
      showLogoutConfirmationModal: false
    });
  }

  closeStopAlgoConfirmationModal() {
    this.setState({
      showStopAlgoConfirmationModal: false
    });
  }

  render() {
    return (
      <div className="col-md-5">
        <table className="table">
          <thead>
          </thead>
          <tbody>
            <tr>
              <td>Broker:</td>
              <td>{_.toUpper(this.props.broker)}</td>
            </tr>
            <tr>
              <td>Login Status:</td>
              <td>
                <div>{this.state.isLoggedIn ? "Logged in" : "Not logged in"}</div>
                <button key="loginLogoutKey" className="btn btn-success"
                  onClick={this.state.isLoggedIn === false ? this.logIn : this.onLogoutButtonClick}>
                  {this.state.isLoggedIn === false ? "Signin " + _.toUpper(this.props.broker) : "Signout " + _.toUpper(this.props.broker)}
                </button>
                {this.state.logInLogoutError && <div className="error-text">{this.state.logInLogoutError}</div>}
              </td>
            </tr>
            <tr>
              <td>Algo Status:</td>
              <td>
                <div>{this.state.isAlgoRunning ? "Runnning" : "Not running"}</div>
                <button key="startStopAlgoKey" className="btn btn-success" disabled={!this.state.isLoggedIn}
                  onClick={this.state.isAlgoRunning === false ? this.startAlgo : this.onStopAlgoButtonClick}>
                  {this.state.isAlgoRunning === false ? "Start Algo on " + _.toUpper(this.props.broker) : "Stop Algo on " + _.toUpper(this.props.broker)}
                </button>
                {this.state.algoStartStopError && <div className="error-text">{this.state.algoStartStopError}</div>}
              </td>
            </tr>
          </tbody>
        </table>
        {this.state.showLogoutConfirmationModal === true ? <ConfirmationModal
          title={"Logout " + _.toUpper(this.props.broker)}
          message={"Are you sure want to singout from " + _.toUpper(this.props.broker) + " ?"}
          onConfirm={this.logOut}
          onCancel={this.closeLogoutConfirmationModal}
        /> : null}
        {this.state.showStopAlgoConfirmationModal === true ? <ConfirmationModal
          title={"Stop Algo on " + _.toUpper(this.props.broker)}
          message={"Are you sure want to stop algo on " + _.toUpper(this.props.broker) + " ?"}
          onConfirm={this.stopAlgo}
          onCancel={this.closeStopAlgoConfirmationModal}
        /> : null}
      </div>
    );
  }
}

export default BrokerLogin;
