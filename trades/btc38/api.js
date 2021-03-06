'use strict'

const request = require('request-promise')
const moment = require('moment')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const timeout = 8000

function Btc38(options) {
  this.name = 'btc38'
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:btc38') + '/v1/trades.php'
}

/* get the last transaction
 * facilitated by the index
 * return index
 */
Btc38.prototype.getLastTrade = function() {
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
Btc38.prototype.pullTransactions = function() {
  const self = this

  /*
   * save data to hbase
   */
  function saveData(data) {
    return hbase.saveTradeData(data)
  }

  /*
   * call Btc38 api to get a snapshot of latest trades
   * object contains lastTrade and lastTrade contains index
   * base is xrp counter is always cny
   */
  function getSnapshot(last) {
    const url = self.url + '?c=' + self.base.toLowerCase()
    return request({
      url: url,
      json: true,
      timeout: timeout
    }).then(trades => {
      const new_trades = []

      trades.forEach(d => {
        const timestamp = moment.unix(d.date).utc()

        // index is an inversed timestamp
        const index = hbase.getInverseTimestamp(timestamp)
        const size = d.amount * d.price

        if (index <= last.index && d.tid !== last.tid) {
          const new_trade = {
            source: self.name,
            base: self.base,
            counter: self.counter,
            index: index,
            tid: d.tid,
            type: d.type,
            timestamp: timestamp,
            amount: d.amount,
            price: d.price,
            size: size
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

module.exports = Btc38
