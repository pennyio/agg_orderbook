'use strict'

const request = require('request-promise')
const moment = require('moment')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const crypto = require('crypto')
const timeout = 8000

function Coinone(options) {
  this.name = 'coinone'
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:coinone') + '/trades'
}

/* get the last transaction
 * facilitated by the index
 * return index
 */
Coinone.prototype.getLastTrade = function() {
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
Coinone.prototype.pullTransactions = function() {
  const self = this

  /*
   * save data to hbase
   */
  function saveData(data) {
    return hbase.saveTradeData(data)
  }

  /*
   * call Coinone api to get a snapshot of latest trades
   * object contains lastTrade and lastTrade contains index
   * Coinone only takes base which is xrp
   * counter is KRW base is XRP
   */
  function getSnapshot(last) {
    const pair = self.base.toLowerCase()
    const url = self.url + '/?currency=' + pair

    return request({
      url: url,
      json: true,
      timeout: timeout
    }).then(trades => {
      const new_trades = []

      trades.completeOrders.forEach(d => {
        const hash = crypto.createHash('sha256')
        const timestamp = moment.unix(d.timestamp).utc()

        // index is an inversed timestamp
        const index = hbase.getInverseTimestamp(timestamp)
        // create a hash of price, volume and timestamp
        const id = hash.update(d.price + d.qty +
          d.timestamp).digest('hex').substring(0, 20)
        const size = Number(d.price) * Number(d.qty)

        if (index <= last.index && d.id !== last.tid) {
          const new_trade = {
            source: self.name,
            base: self.base,
            counter: self.counter,
            index: index,
            tid: id,
            timestamp: timestamp,
            amount: d.qty,
            price: d.price,
            size: size
          }

          new_trades.push(new_trade)
        }
      })

      const num_new_trades = new_trades.length
      console.log(self.name + ' ' + self.base + self.counter +
        ' - ' + num_new_trades + '/' + trades.completeOrders.length + ' new')

      return new_trades
    })
  }

  return self.getLastTrade()
    .then(getSnapshot)
    .then(saveData)
}

module.exports = Coinone
