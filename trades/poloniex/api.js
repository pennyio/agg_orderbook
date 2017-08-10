'use strict'

const request = require('request-promise')
const moment = require('moment')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const timeout = 8000

function Poloniex(options) {
  this.name = 'poloniex'
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:poloniex') + '/public?command=returnTradeHistory'
}

/* get the last transaction
 * facilitated by the index
 * return index
 */
Poloniex.prototype.getLastTrade = function() {
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
Poloniex.prototype.pullTransactions = function() {
  const self = this

  /*
   * save data to hbase
   */
  function saveData(data) {
    return hbase.saveTradeData(data)
  }

  /*
   * call Poloniex api to get a snapshot of latest trades
   * object contains lastTrade and lastTrade contains index
   * poloniex reverse the position of base and counter
   */
  function getSnapshot(last) {
    const pair = '&currencyPair=' + self.counter.toUpperCase() +
      '_' + self.base.toUpperCase()
    const url = self.url + pair
    return request({
      url: url,
      json: true,
      timeout: timeout
    }).then(trades => {
      const new_trades = []

      trades.forEach(d => {
        const timestamp = moment.utc(d.date)

        // index is an inversed timestamp
        const index = hbase.getInverseTimestamp(timestamp)

        if (index <= last.index && d.globalTradeID !== last.tid) {
          const new_trade = {
            source: self.name,
            base: self.base,
            counter: self.counter,
            index: index,
            tid: d.globalTradeID,
            type: d.type,
            timestamp: timestamp,
            amount: d.amount,
            price: d.rate,
            size: d.total
          }

          new_trades.push(new_trade)
        }
      })
      const num_new_trades = new_trades.length
      console.log(self.name + ' ' + self.base + self.counter +
        ' - ' + num_new_trades + '/' + trades.length + ' new')

      return new_trades
    })
  }

  return self.getLastTrade()
    .then(getSnapshot)
    .then(saveData)
}

module.exports = Poloniex
