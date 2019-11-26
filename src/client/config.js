/*
  Author: Sreenivas Doosa
*/

const config = {
  serverHost: "https://127.0.0.1:8888",

  updateServerHost: function updateServerHost(host) {
    console.log('updating server host to = ' + host);
    config.serverHost = host;
  }
};

module.exports = config;
