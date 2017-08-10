# Exchanges ETL Pipeline 
XRP market data ingestion pipeline

To run, first set up initialization parameters in config.json.example and rename to config.json.

npm install

To get trade data from external exchanges (limited to Bitstamp for now)

node trade-etl.js

To get order book data from external exchanges (limited to Bitstamp for now)

node orderbook-etl.js

List of markets and currency pairs to look at:

  // 'coincheck.com|XRP|JPY',
  // 'btcxindia.com|XRP|KRW',
  'bithumb.com|XRP|KRW',
  'bittrex.com|XRP|BTC',
  'korbit.co.kr|XRP|KRW',
  'bitbank.cc|XRP|JPY',
  'coinone.co.kr|XRP|KRW',
  'bitfinex.com|XRP|USD',
  'bitfinex.com|XRP|BTC',
  'bitso.com|XRP|MXN',
  'bitso.com|XRP|BTC',
  'bitstamp.net|XRP|BTC',
  'bitstamp.net|XRP|USD',
  'bitstamp.net|XRP|EUR',
  'poloniex.com|XRP|BTC',
  'poloniex.com|XRP|USD',
  'kraken.com|XRP|BTC',
  'kraken.com|XRP|USD',
  'kraken.com|XRP|EUR',
  'kraken.com|XRP|CAD',
  'kraken.com|XRP|JPY',
  'btc38.com|XRP|CNY',
  'btc38.com|XRP|BTC',
  'jubi.com|XRP|CNY'

