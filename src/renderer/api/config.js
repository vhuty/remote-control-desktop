'use strict';

// const host = 'remote-control-server-node.herokuapp.com';
// const port = 80;
const host = 'localhost';
const port = 49150;
const apiUri = `${host}:${port}`;

module.exports = {
  host,
  port,
  apiUri,
  apiUrl: {
    ws: `ws://${apiUri}`,
    http: `http://${apiUri}`,
  },
};
