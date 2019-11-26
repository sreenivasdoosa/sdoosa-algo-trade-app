/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import React from "react";
import HttpRequest from "request";
import config from "../config.js";

class Login extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      username: null,
      password: null,
      error: null
    };

    this.onLoginButtonClick = this.onLoginButtonClick.bind(this);
    this.handleUsernameChange = this.handleUsernameChange.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
  }

  handleUsernameChange(e) {
    this.setState({
      username: e.target.value,
      error: null
    });
  }

  handlePasswordChange(e) {
    this.setState({
      password: e.target.value,
      error: null
    });
  }

  onLoginButtonClick(e) {
    e.preventDefault();

    if (_.isEmpty(this.state.username) || _.isEmpty(this.state.password)) {
      this.setState({
        error: 'Please enter credentials'
      });
    } else {
      var data = { username: this.state.username, password: this.state.password };
      HttpRequest.post({
        url: config.serverHost + "/login",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }, (err, resp, respBody) => {
        console.log('Login status code = ' + resp.statusCode);
        if (resp.statusCode === 200 || resp.statusCode === 201) {
          this.setState({
            error: null
          });
          const user = JSON.parse(respBody).user;
          this.props.onLoginSuccess(user);
        } else if (resp.statusCode === 404) {
          this.setState({
            error: 'Login end point not found'
          });
        } else {
          console.error('Login error => ', respBody);
          this.setState({
            error: JSON.parse(respBody).error
          });
        }
      });
    }
  }

  render() {
    return (
      <div className="modal-login modal-dialog modal-sm">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title">LOGIN</h4>
          </div>
          <div className="modal-body">
            <form>
              <div className="form-group input-with-icon">
                <i className="fa fa-user"></i>
                <input type="text" className="form-control" placeholder="Username" required="required"
                  onChange={this.handleUsernameChange} />
              </div>
              <div className="form-group input-with-icon">
                <i className="fa fa-lock"></i>
                <input type="password" className="form-control" placeholder="Password" required="required"
                  onChange={this.handlePasswordChange} />
              </div>
              <div className="form-group">
                <button className="btn btn-success btn-block btn-lg" onClick={this.onLoginButtonClick}>Login</button>
              </div>
            </form>
            {this.state.error ? <div className="error-text-login">{this.state.error}</div> : null}
          </div>
        </div>
      </div>
    );
  }
}

export default Login;
