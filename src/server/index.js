/*
  Author: Sreenivas Doosa
*/

import { getAppStoragePath }  from './config.js';
import fs from 'fs-extra';

const appStoragePath = getAppStoragePath();

console.log('APP STORAGE PATH = ' + appStoragePath);

// create the app storage path if does not exist
fs.ensureDirSync(appStoragePath);

// start server and configure all the apis
require('./init-server.js');

