'use strict'

const request = require('request-promise')
const moment = require('moment-timezone')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const crypto = require('crypto')
const timeout = 8000

function Bithumb(options) {
  this.name = 'bithumb'
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:bithumb') + '/public/recent_transactions'
}

/* get the last transaction
 * facilitated by the index
 * return index
 */
Bithumb.prototype.getLastTrade = function() {
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
Bithumb.prototype.pullTransactions = function() {
  const self = this

  /*
   * save data to hbase
   */
  function saveData(data) {
    return hbase.saveTradeData(data)
  }

  /*
   * call Bithumb api to get a snapshot of latest trades
   * object contains lastTrade and lastTrade contains index
   * base XRP counter KRW
   */
  function getSnapshot(last) {
    const pair = self.base.toUpperCase()
    const url = self.url + '/' + pair
    return request({
      url: url,
      json: true,
      timeout: timeout,
      qs: {
        count: 100
      }
    }).then(trades => {
      const new_trades = []

      trades.data.forEach(d => {
        const hash = crypto.createHash('sha256')
        const format = 'YYYY-MM-DD HH:mm:ss'
        const tz = 'Asia/Seoul'
        const timestamp = moment.tz(d.transaction_date, format, tz).utc()

        // index is an inversed timestamp
        const index = hbase.getInverseTimestamp(timestamp)
        const size = Number(d.units_traded) * Number(d.price)
        // create a hash of price, volume and timestamp
        const id = hash.update(d.price + d.units_traded +
          d.transction_date).digest('hex').substring(0, 20)

        if (index <= last.index && id !== last.tid) {
          const new_trade = {
            source: self.name,
            base: self.base,
            counter: self.counter,
            index: index,
            tid: id,
            type: d.type === 'bid' ? 'sell' : 'buy',
            timestamp: timestamp,
            amount: d.units_traded,
            price: d.price,
            size: size
          }

          new_trades.push(new_trade)
        }
      })

      const num_new_trades = new_trades.length
      console.log(self.name + ' ' + self.base + self.counter +
        ' - ' + num_new_trades + '/' + trades.data.length + ' new')
      return new_trades
    })
  }

  return self.getLastTrade()
    .then(getSnapshot)
    .then(saveData)
}

module.exports = Bithumb
