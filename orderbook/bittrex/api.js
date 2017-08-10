'use strict'

const request = require('request-promise')
const moment = require('moment')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const table_name = 'exchange_orderbook'
const exchange_name = 'bittrex'
const timeout = 8000

function Bittrex(options) {
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:bittrex') + '/api/v1.1/public/getorderbook'
}

/*
 * make api call to orderbook endpoint
 * save new snapshot to hbase
 * each row is indexed by timeinfinity - timestamp
 */
Bittrex.prototype.pullOrderBook = function() {

  /*
   * save data to hbase
   */
  function saveData(data) {
    return hbase.saveOrderBookData(data)
  }

  /*
   * call Bittrex api to get a snapshot of latest orderbook
   * preprocess data to return an object of relevant data
   * to be further formatted and saved to hbase
   * Bittrex of a weird structure that puts counter before base
   * counter is BTC base is XRP
   * in its api call
   */
  function getSnapshot(object) {
    const pair = object.counter.toUpperCase() + '-' + object.base.toUpperCase()
    const url = object.url + '?market=' + pair + '&type=both'

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
        const price = Number(d.Rate)
        const amount = Number(d.Quantity)

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
      const sortedBids = orderbook.result.buy.sort(function(a, b) {
        return Number(b.Rate) - Number(a.Rate)
      })

      // sort asks in ascending order
      // lowest ask comes first
      const sortedAsks = orderbook.result.sell.sort(function(a, b) {
        return Number(a.Rate) - Number(b.Rate)
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

      // leaving out isFrozen and seq
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

module.exports = Bittrex
