'use strict'

const request = require('request-promise')
const moment = require('moment-timezone')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const timeout = 8000

function Bitbank(options) {
  this.name = 'btcxindia'
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:btcxindia')
}

/* get the last transaction
 * facilitated by the index
 * return index
 */
Bitbank.prototype.getLastTrade = function() {
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
Bitbank.prototype.pullTransactions = function() {
  const self = this

  /*
   * save data to hbase
   */
  function saveData(data) {
    return hbase.saveTradeData(data)
  }

  /*
   * call api to get a snapshot of latest trades
   */
  function getSnapshot(last) {
    const url = self.url + '/trades'
    return request({
      url: url,
      json: true,
      timeout: timeout
    }).then(trades => {

      const new_trades = []
      const count = trades.length

      trades.forEach(d => {
        const format = 'YYYY-MM-DD HH:mm:ss'
        const tz = 'Asia/Kolkata'
        const timestamp = moment.tz(d.time, format, tz).utc()

        // index is an inversed timestamp
        const index = hbase.getInverseTimestamp(timestamp)
        const size = Number(d.volume) * Number(d.price)

        if (index <= last.index &&
            d.trade_id !== last.tid) {
          const new_trade = {
            source: self.name,
            base: self.base,
            counter: self.counter,
            index: index,
            tid: d.trade_id,
            timestamp: timestamp,
            amount: d.volume,
            price: d.price,
            size: size
          }

          new_trades.push(new_trade)
        }
      })
      const num_new_trades = new_trades.length
      console.log(self.name + ' ' + self.base + self.counter +
        ' - ' + num_new_trades + '/' + count + ' new')

      return new_trades
    })
  }

  return self.getLastTrade()
    .then(getSnapshot)
    .then(saveData)
}

module.exports = Bitbank
