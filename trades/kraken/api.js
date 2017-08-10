'use strict'

const request = require('request-promise')
const moment = require('moment')
const crypto = require('crypto')
const hbase = require('../../lib/hbase')
const config = require('../../lib/nconf')
const timeout = 10000
const accessCodes = {
  'XRPBTC': 'XXRPXXBT',
  'XRPUSD': 'XXRPZUSD',
  'XRPEUR': 'XXRPZEUR',
  'XRPJPY': 'XXRPZJPY',
  'XRPCAD': 'XXRPZCAD'
}

function Kraken(options) {
  this.name = 'kraken'
  this.base = options.base
  this.counter = options.counter
  this.url = config.get('apis:kraken') + '/0/public/Trades'
}

/* get the last transaction
 * facilitated by the index
 * return index
 */
Kraken.prototype.getLastTrade = function() {
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
Kraken.prototype.pullTransactions = function() {
  const self = this

  /*
   * save data to hbase
   */
  function saveData(data) {
    return hbase.saveTradeData(data)
  }

  /*
   * call Kraken api to get a snapshot of latest trades
   * object contains lastTrade and lastTrade contains index
   * base is XRP counter is XBT
   */
  function getSnapshot(last) {
    const pair = accessCodes[self.base + self.counter]
    const url = self.url + '?pair=' + pair

    if (!pair) {
      return Promise.reject('invalid currency pair')
    }

    return request({
      url: url,
      json: true,
      timeout: timeout
    }).then(trades => {
      const new_trades = []
      const count = trades.result[pair].length
      trades.result[pair].forEach(d => {
        const hash = crypto.createHash('sha256')
        const timestamp = moment(d[2] * 1000).utc()

        // index is an inversed timestamp
        const index = hbase.getInverseTimestamp(timestamp)
        const type = ((d[3] === 'b') ? 'buy' : 'sell')
        const volume = Number(d[1]) * Number(d[0])
        // create a hash of price, volume and timestamp and type
        const id = hash.update(d[0] + d[1] + d[2].toString() +
        d[3]).digest('hex').substring(0, 20)


        if (index <= last.index && id !== last.tid) {
          const new_trade = {
            source: self.name,
            base: self.base,
            counter: self.counter,
            index: index,
            tid: id,
            type: type,
            timestamp: timestamp,
            amount: d[1],
            price: d[0],
            size: volume
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

module.exports = Kraken
