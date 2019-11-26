/*
  Author: Sreenivas Doosa
*/

import React from 'react';
import ReactDOM from 'react-dom';
import Header from './components/Header.js';
import Login from "./components/Login.js";
import TabPanel from './components/TabPanel.js';
import HttpRequest from "request";
import url from "url";
import config from "./config.js";

const req = url.parse(window.location.href, false);
var serverHost = req.protocol + '//' + req.hostname;
if (req.port) {
  serverHost = serverHost + ':' + req.port;
}
config.updateServerHost(serverHost);
const queryString = req.query || '';
console.log('query params = ' + queryString);

const queryObj = url.parse(window.location.href, true).query; // 2nd arg for query object else it will give query string
const broker = queryObj.broker || '';

let isLoggedIn = false;
let user = null;

const checkAuthenticated = () => {
  HttpRequest(config.serverHost + "/authentication/status", { json: true }, (err, resp, data) => {
    if (err) {
      console.error('Not authenticated: ', err);
    }
    if (data && data.isAuthenticated) {
      isLoggedIn = true;
      user = data.user;
      console.log('Authenticate: user: ', data.user);
    }
    render();
  });
};
// check if user is authenticated (using browser cookies)
checkAuthenticated();

const onLoginSuccess = (userDetails) => {
  user = userDetails;
  isLoggedIn = true;
  render();
};

const onLogoutSuccess = () => {
  isLoggedIn = false;
  user = null;
  render();
};

const render = () => {
  if (!isLoggedIn) {
    ReactDOM.render(<div>
      <Header isLoggedIn={isLoggedIn} />
      <Login onLoginSuccess={onLoginSuccess} />
    </div>, document.getElementById("container"));

  } else {
    ReactDOM.render(<div>
      <Header isLoggedIn={isLoggedIn} user={user} onLogoutSuccess={onLogoutSuccess} />
      <TabPanel broker={broker}/>
    </div>, document.getElementById("container"));
  }
};
