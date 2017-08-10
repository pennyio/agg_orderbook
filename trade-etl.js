'use strict'
const moment = require('moment')
const aggregate = require('./lib/aggregate')
const aggregateLive = require('./lib/aggregateLive')
const config = require('./lib/nconf')
const markets = config.get('markets')
const chalk = require('chalk')

const exchanges = {
  'bitbank': require('./trades/bitbank/api.js'),
  'bitfinex': require('./trades/bitfinex/api.js'),
  'bithumb': require('./trades/bithumb/api.js'),
  'bitstamp': require('./trades/bitstamp/api.js'),
  'bitso': require('./trades/bitso/api.js'),
  'bittrex': require('./trades/bittrex/api.js'),
  'btc38': require('./trades/btc38/api.js'),
  'coinone': require('./trades/coinone/api.js'),
  'jubi': require('./trades/jubi/api.js'),
  'kraken': require('./trades/kraken/api.js'),
  'korbit': require('./trades/korbit/api.js'),
  'poloniex': require('./trades/poloniex/api.js'),
  'hitbtc': require('./trades/hitbtc/api.js'),
  'btcxindia': require('./trades/btcxindia/api.js')
}

function logError(m, e) {
  console.log(chalk.red.bold(m.source + ' ' +
                        m.base + m.counter +
                        ' '), chalk.red(e))
}

/**
 * ingestMarket
 */

function ingestMarket(m, i) {
  const interval = m.interval || 60
  const market = new exchanges[m.source]({
    base: m.base,
    counter: m.counter
  })

  /**
   * getTransaction
   */

  function getTransactions() {
    console.log(chalk.greenBright(moment.utc().format() +
                ' Get TX: ' + m.source + ' ' +
                m.base + m.counter +
                ' interval: ' + interval + 's'))
    market.pullTransactions()
    .catch(logError.bind(this, m))
  }

  // stagger the start to minimise
  // impact on the DB
  setTimeout(() => {
    getTransactions()
    m.interval = setInterval(getTransactions, interval * 1000)
  }, i * 1000)
}

markets.forEach(ingestMarket)
setInterval(aggregate, 60 * 1000)
setInterval(aggregateLive, 60 * 1000)
// ingestMarket(markets[11])
