'use strict'

const request = require('request-promise')
const moment = require('moment')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const table_name = 'exchange_orderbook'
const exchange_name = 'bitfinex'
const timeout = 8000

function Bitfinex(options) {
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:bitfinex') + '/v1/book/'
}

/*
 * make api call to orderbook endpoint
 * save new snapshot to hbase
 * each row is indexed by timeinfinity - timestamp
 */
Bitfinex.prototype.pullOrderBook = function() {

  /*
   * save data to hbase
   */
  function saveData(data) {
    return hbase.saveOrderBookData(data)
  }

  /*
   * call Bitfinex api to get a snapshot of latest orderbook
   * preprocess data to return an object of relevant data
   * to be further formatted and saved to hbase
   * base is XRP and counter is BTC
   */
  function getSnapshot(object) {
    const pair = (object.base + object.counter).toUpperCase()
    const url = object.url + pair

    return request({
      url: url,
      json: true,
      timeout: timeout
    }).then(orderbook => {
      const timestamp = moment().utc()
      const index = hbase.getInverseTimestamp(timestamp)
      const new_orderbook = {}

      const formatBids = []
      const formatAsks = []

      // convert list of lists
      // to a list of objects
      function formatRows(type, d) {
        const price = Number(d.price)
        const amount = Number(d.amount)

        const entry = {
          'price': price,
          'amount': amount
        }

        if (type === 'bid') {
          formatBids.push(entry)
        } else if (type === 'ask') {
          formatAsks.push(entry)
        }
      }

      const processBids = formatRows.bind(this, 'bid')
      const processAsks = formatRows.bind(this, 'ask')

      // sort bids in descending order
      // highest bid comes first
      const sortedBids = orderbook.bids.sort(function(a, b) {
        return Number(b.price) - Number(a.price)
      })

      // sort asks in ascending order
      // lowest ask comes first
      const sortedAsks = orderbook.asks.sort(function(a, b) {
        return Number(a.price) - Number(b.price)
      })

      sortedBids.forEach(processBids)
      sortedAsks.forEach(processAsks)

      new_orderbook.source = exchange_name
      new_orderbook.base = object.base
      new_orderbook.counter = object.counter
      new_orderbook.index = index
      new_orderbook.timestamp = timestamp
      new_orderbook.bids = formatBids
      new_orderbook.asks = formatAsks

      return Promise.resolve({
        table: table_name,
        data: new_orderbook
      })
    })
  }

  const self = this
  const param = {
    base: self.base,
    counter: self.counter,
    url: self.url
  }

  getSnapshot(param)
    .then(saveData)
    .catch(console.log)

}

module.exports = Bitfinex
