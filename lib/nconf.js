'use strict'

const nconf = require('nconf')

nconf.argv()
.env()
.file({
  file: __dirname + '/../config.json'
})
.defaults({
  apis: {
    bitbank: 'https://public.bitbank.cc',
    bitfinex: 'https://api.bitfinex.com',
    bithumb: 'https://api.bithumb.com',
    bitso: 'https://api.bitso.com',
    bitstamp: 'https://www.bitstamp.net',
    bittrex: 'https://bittrex.com',
    btc38: 'http://api.btc38.com',
    coinone: 'https://api.coinone.co.kr',
    jubi: 'https://www.jubi.com',
    korbit: 'https://api.korbit.co.kr',
    kraken: 'https://api.kraken.com',
    poloniex: 'https://poloniex.com',
    hitbtc: 'https://api.hitbtc.com',
    btcxindia: 'https://api.btcxindia.com'
  },
  markets: [
    {
      source: 'btcxindia',
      base: 'XRP',
      counter: 'INR'
    },
    {
      source: 'hitbtc',
      base: 'XRP',
      counter: 'BTC'
    },
    {
      source: 'bitfinex',
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
      counter: 'BTC'
    },
    {
      source: 'bitstamp',
      base: 'XRP',
      counter: 'USD'
    },
    {
      source: 'bitstamp',
      base: 'XRP',
      counter: 'EUR'
    },
    {
      source: 'bitso',
      base: 'XRP',
      counter: 'BTC'
    },
    {
      source: 'bitso',
      base: 'XRP',
      counter: 'MXN'
    },
    {
      source: 'bittrex',
      base: 'XRP',
      counter: 'BTC'
    },
    {
      source: 'bittrex',
      base: 'XRP',
      counter: 'ETH'
    },
    {
      source: 'bittrex',
      base: 'XRP',
      counter: 'USDT'
    },
    {
      source: 'kraken',
      base: 'XRP',
      counter: 'BTC'
    },
    {
      source: 'kraken',
      base: 'XRP',
      counter: 'USD'
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
      source: 'poloniex',
      base: 'XRP',
      counter: 'BTC',
      interval: 30
    },
    {
      source: 'poloniex',
      base: 'XRP',
      counter: 'USDT'
    },
    {
      source: 'coinone',
      base: 'XRP',
      counter: 'KRW'
    },
    {
      source: 'bithumb',
      base: 'XRP',
      counter: 'KRW',
      interval: 20
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
      source: 'btc38',
      base: 'XRP',
      counter: 'CNY',
      interval: 20
    },
    {
      source: 'jubi',
      base: 'XRP',
      counter: 'CNY'
    }
  ]
})

module.exports = nconf
