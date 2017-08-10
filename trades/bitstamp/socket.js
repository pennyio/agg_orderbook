// 'use strict'

// const request = require('request-promise')
// const moment = require('moment')
// const hbase = require('../lib/hbase')
// const Pusher = require('pusher-js/node')
// const pusher = new Pusher('de504dc5763aeef9ff52')
// const table_name = 'fct_exchange_transaction'

// /*
//  * given incoming data stream from socket
//  * process data into the right format
//  */
// function organizeData(options, data) {
//   console.log('organizing data...')
//   const timestamp = moment.unix(data.timestamp).utc()
//   const trade = {}

//   const keybase = [
//     'bitstamp',
//     options.base,
//     options.counter,
//     timestamp,
//     data.id].join('|')

//   const columns = {
//     'f:source': 'bitstamp',
//     'f:base': options.base,
//     'f:counter': options.counter,
//     'f:timestamp': timestamp,
//     'f:id': data.id,
//     'amount': data.amount,
//     'price': data.price,
//     'type': data.type, // 0 for buy and 1 for sell
//     'buy_order_id': data.buy_order_id,
//     'sell_order_id': data.sell_order_id
//   }

//   trade[keybase] = columns

//   return Promise.resolve({
//     trade: trade
//   })

// }

// /*
//  * write data to hbase
//  */
// function saveData(data) {
//   console.log('saving data to table..')
//   console.log(data)
//   return Promise.all([
//     hbase.putRows({
//       table: table_name,
//       rows: data.trade
//     })
//   ])
// }

// module.exports.startFeed = function(options) {
//   console.log('starting feed..')
//   let key = 'live_trades'
//   if (options.base !== 'BTC' &&
//     options.counter !== 'USD') {
//     key += '_' +
//     options.base.toLowerCase() +
//     options.counter.toLowerCase()
//   }

//   const channel = pusher.subscribe(key)
//   channel.bind('trade', data => {
//     organizeData(options, data)
//     .then(saveData)
//     .catch(err => {
//       console.log(err)
//     })
//   })
// }
