/*
  Author: Sreenivas Doosa
*/

import React from "react";
import HttpRequest from "request";
import config from "../config.js";

class Header extends React.Component {

  constructor(props) {
    super(props);

    this.onLogoutButtonClick = this.onLogoutButtonClick.bind(this);
  }

  onLogoutButtonClick(e) {
    e.preventDefault();

    const data = {};
    HttpRequest.post({
      url: config.serverHost + "/logout",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, (err, resp, respBody) => {
      console.log('Logout status code = ' + resp.statusCode);
      if (resp.statusCode === 200 || resp.statusCode === 201) {
        this.props.onLogoutSuccess();
      }
    });
  }

  render() {
    let displayName = '';
    if (this.props.user) {
      if (this.props.user.firstname || this.props.user.lastname) {
        displayName = (this.props.user.firstname || '') + ' ' + (this.props.user.lastname || '');
      } else {
        displayName = this.props.user.username;
      }
    }
    return (
      <div className="navbar navbar-default">
        <div className="container-fluid">
          <div className="navbar-header">
            <a className="navbar-brand" href="#">SDOOSA ALGO TRADE APP</a>
            <div className="logout-section">
              {this.props.isLoggedIn === true && this.props.user ? (<span className="greeting">Hello <span className="user-name">{displayName}</span></span>) : null}
              {this.props.isLoggedIn === true &&
                <button className="btn btn-warning logout-btn" onClick={this.onLogoutButtonClick}>Logout</button>
              }
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default Header;
