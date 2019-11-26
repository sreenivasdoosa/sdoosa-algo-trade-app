
import VWAPStrategy from '../strategies/VWAPStrategy.js';
import logger from '../logger/logger.js';

export const getStrategyInstance = (strategy) => {

  switch(strategy) {
    case 'VWAP':
      return VWAPStrategy;

    default:
      logger.error(`getStrategyInstance: no instance found for strategy ${strategy}`);
  }

  return null;
};
