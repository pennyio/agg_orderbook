'use strict'

const request = require('request-promise')
const moment = require('moment')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const timeout = 8000

function HitBTC(options) {
  this.name = 'hitbtc'
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:hitbtc') + '/api/1/public'
}

/* get the last transaction
 * facilitated by the index
 * return index
 */
HitBTC.prototype.getLastTrade = function() {
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
HitBTC.prototype.pullTransactions = function() {
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
    const pair = self.base.toUpperCase() + self.counter.toUpperCase()
    const url = self.url + '/' + pair + '/trades/recent'

    return request({
      url: url,
      json: true,
      timeout: timeout,
      qs: {
        side: true,
        max_results: 200
      }
    }).then(resp => {
      const new_trades = []

      resp.trades.forEach(d => {
        const timestamp = moment(d[3]).utc()

        // index is an inversed timestamp
        const index = hbase.getInverseTimestamp(timestamp)

        if (index <= last.index && d[0] !== last.tid) {
          const new_trade = {
            source: self.name,
            base: self.base,
            counter: self.counter,
            index: index,
            tid: d[0],
            type: d[4],
            timestamp: timestamp,
            amount: d[2],
            price: d[1],
            size: d[1] * d[2]
          }

          new_trades.push(new_trade)
        }
      })

      const num_new_trades = new_trades.length
      console.log(self.name + ' ' + self.base + self.counter +
        ' - ' + num_new_trades + '/' + resp.trades.length + ' new')
      return new_trades
    })
  }

  return self.getLastTrade()
    .then(getSnapshot)
    .then(saveData)
}

module.exports = HitBTC
