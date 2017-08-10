'use strict'

const exchanges = {
  'bitbank': require('./orderbook/bitbank/api.js'),
  'bitfinex': require('./orderbook/bitfinex/api.js'),
  'bithumb': require('./orderbook/bithumb/api.js'),
  'bitstamp': require('./orderbook/bitstamp/api.js'),
  'bitso': require('./orderbook/bitso/api.js'),
  'bittrex': require('./orderbook/bittrex/api.js'),
  'btc38': require('./orderbook/btc38/api.js'),
  'coinone': require('./orderbook/coinone/api.js'),
  'jubi': require('./orderbook/jubi/api.js'),
  'kraken': require('./orderbook/kraken/api.js'),
  'korbit': require('./orderbook/korbit/api.js'),
  'poloniex': require('./orderbook/poloniex/api.js')
}

const markets = [
  {
    source: 'bitfinex',
    base: 'XRP',
    counter: 'BTC'
  },
  {
    source: 'bitstamp',
    base: 'XRP',
    counter: 'BTC'
  },
  {
    source: 'bitso',
    base: 'XRP',
    counter: 'BTC'
  },
  {
    source: 'bittrex',
    base: 'XRP',
    counter: 'BTC'
  },
  {
    source: 'kraken',
    base: 'XRP',
    counter: 'XBT'
  },
  {
    source: 'poloniex',
    base: 'XRP',
    counter: 'BTC'
  },
  {
    source: 'bitfinex',
    base: 'XRP',
    counter: 'USD'
  },
  {
    source: 'bitstamp',
    base: 'XRP',
    counter: 'USD'
  },
  {
    source: 'kraken',
    base: 'XRP',
    counter: 'USD'
  },
  {
    source: 'poloniex',
    base: 'XRP',
    counter: 'USDT'
  },
  {
    source: 'bitso',
    base: 'XRP',
    counter: 'MXN'
  },
  {
    source: 'bitstamp',
    base: 'XRP',
    counter: 'EUR'
  },
  {
    source: 'kraken',
    base: 'XRP',
    counter: 'EUR'
  },
  {
    source: 'coinone',
    base: 'XRP',
    counter: 'KRW'
  },
  {
    source: 'bithumb',
    base: 'XRP',
    counter: 'KRW'
  },
  {
    source: 'korbit',
    base: 'XRP',
    counter: 'KRW'
  },
  {
    source: 'bitbank',
    base: 'XRP',
    counter: 'JPY'
  },
  {
    source: 'kraken',
    base: 'XRP',
    counter: 'JPY'
  },
  {
    source: 'kraken',
    base: 'XRP',
    counter: 'CAD'
  },
  {
    source: 'btc38',
    base: 'XRP',
    counter: 'CNY'
  },
  {
    source: 'jubi',
    base: 'XRP',
    counter: 'CNY'
  }
]

markets.forEach(m => {
  const market = new exchanges[m.source]({
    base: m.base,
    counter: m.counter
  })

  market.pullOrderBook()
  m.interval = setInterval(() => {
    market.pullOrderBook()
  }, 60 * 1000)
})
