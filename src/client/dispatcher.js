/*
  Author: Sreenivas Doosa
*/

import Guid from  'guid';

var listeners = {};

export const dispatch = (payload) => {
  for (var id in listeners) {
    listeners[id](payload);
  }
};

export const register = (cb) => {
  var id = Guid.create();
  listeners[id] = cb;
};
