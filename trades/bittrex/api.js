'use strict'

const request = require('request-promise')
const moment = require('moment')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const timeout = 8000

function Bittrex(options) {
  this.name = 'bittrex'
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:bittrex') + '/api/v1.1/public/getmarkethistory'
}

/* get the last transaction
 * facilitated by the index
 * return index
 */
Bittrex.prototype.getLastTrade = function() {
  return hbase.getLastTrade({
    exchange: this.name,
    base: this.base,
    counter: this.counter
  })
}

/*
 * scan table for the last trade
 * make api call to trade endpoint
 * save new trade to hbase
 * each row is indexed by timeinfinity - timestamp
 */
Bittrex.prototype.pullTransactions = function() {
  const self = this

  /*
   * save data to hbase
   */
  function saveData(data) {
    return hbase.saveTradeData(data)
  }

  /*
   * call Bittrex api to get a snapshot of latest trades
   * object contains lastTrade and lastTrade contains index
   * Bittrex reverse the position of base and counter
   * counter is BTC base is XRP
   */
  function getSnapshot(last) {
    const pair = self.counter.toUpperCase() + '-' + self.base.toUpperCase()
    const url = self.url + '?market=' + pair

    return request({
      url: url,
      json: true,
      timeout: timeout
    }).then(trades => {
      const new_trades = []

      trades.result.forEach(d => {
        const timestamp = moment.utc(d.TimeStamp)

        // index is an inversed timestamp
        const index = hbase.getInverseTimestamp(timestamp)

        if (index <= last.index && d.Id !== last.tid) {
          const new_trade = {
            source: self.name,
            base: self.base,
            counter: self.counter,
            index: index,
            tid: d.Id,
            type: d.OrderType.toLowerCase(),
            timestamp: timestamp,
            amount: d.Quantity,
            price: d.Price,
            size: d.Total
          }

          new_trades.push(new_trade)
        }
      })
      const num_new_trades = new_trades.length
      console.log(self.name + ' ' + self.base + self.counter +
        ' - ' + num_new_trades + '/' + trades.result.length + ' new')

      return new_trades
    })
  }

  return self.getLastTrade()
    .then(getSnapshot)
    .then(saveData)
}

module.exports = Bittrex
