'use strict'

const hbase = require('./hbase')
const config = require('./nconf')
const markets = config.get('markets')
const chalk = require('chalk')

const intervals = [
  {
    interval: 5,
    unit: 'minute'
  },
  {
    interval: 15,
    unit: 'minute',
    lastInterval: '5minute'
  },
  {
    interval: 30,
    unit: 'minute',
    lastInterval: '15minute'
  },
  {
    interval: 1,
    unit: 'hour',
    lastInterval: '30minute'
  },
  {
    interval: 2,
    unit: 'hour',
    lastInterval: '1hour'
  },
  {
    interval: 4,
    unit: 'hour',
    lastInterval: '2hour'
  },
  {
    interval: 1,
    unit: 'day',
    lastInterval: '4hour'
  }
]

function logError(e) {
  console.log(chalk.red(e))
}

module.exports = function() {
  console.log(chalk.cyan('aggregating trades'))
  let index = 0
  let d = Date.now()

  function aggregateMarket(options) {
    return hbase.getTradeAggregate(options)
    .then(hbase.saveTradeAggregate)
    .catch(logError) // let other markets finish
  }

  function aggregateNext() {
    const current = intervals[index]
    const tasks = []

    console.log(chalk.cyan('aggregating ' + current.interval +
               current.unit + ' data'))

    markets.forEach(m => {
      tasks.push(aggregateMarket({
        source: m.source,
        base: m.base,
        counter: m.counter,
        interval: current.interval,
        unit: current.unit,
        lastInterval: current.lastInterval
      }))
    })

    return Promise.all(tasks)
    .then(() => {
      return intervals[++index] ?
        aggregateNext() : undefined
    })
  }

  return aggregateNext()
  .then(() => {
    d = (Date.now() - d) / 1000
    console.log(chalk.cyan('finished aggregations in ' + d + 's'))
  })
}
