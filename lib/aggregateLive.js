'use strict'

const moment = require('moment')
const hbase = require('./hbase')
const config = require('./nconf')
const markets = config.get('markets')
const chalk = require('chalk')

const periods = [
  {
    unit: 'hour',
    period: '5minute'
  },
  {
    unit: 'day',
    period: '5minute'
  },
  {
    interval: 3,
    unit: 'day',
    period: '15minute'
  },
  {
    interval: 7,
    unit: 'day',
    period: '1hour'
  },
  {
    interval: 30,
    unit: 'day',
    period: '1day'
  }
]

function logError(e) {
  console.log(chalk.red(e))
}

function getKeys(options) {
  const now = moment().utc()
  const then = moment().utc()

  then.subtract(options.interval || 1, options.unit)

  const start = hbase.getInverseTimestamp(now)
  const end = hbase.getInverseTimestamp(then)

  return Promise.resolve({
    start: [
      options.source,
      options.base,
      options.counter,
      options.period,
      start
    ].join('|'),
    end: [
      options.source,
      options.base,
      options.counter,
      options.period,
      end
    ].join('|')
  })
}

/**
 * reduce
 */

function reduce(data) {
  const reduced = {
    base_volume: 0,
    counter_volume: 0,
    count: 0
  }

  if (data.rows.length) {
    reduced.source = data.rows[0].columns.source
    reduced.base_currency = data.rows[0].columns.base
    reduced.counter_currency = data.rows[0].columns.counter
  }


  data.rows.forEach(function(d) {
    reduced.base_volume += Number(d.columns.base_volume || 0)
    reduced.counter_volume += Number(d.columns.counter_volume || 0)
    reduced.count += Number(d.columns.count || 0)
  })

  if (!reduced.count) {
    delete reduced.count
  }

  if (reduced.counter_volume) {
    reduced.vwap = reduced.counter_volume / reduced.base_volume
    reduced.vwap = hbase.round(reduced.vwap, 6)

  } else {
    delete reduced.counter_volume
  }

  return reduced
}

function formatResult(label, data) {

  const result = {
    components: data.filter(function(d) {
      return Boolean(d) && d.base_volume
    }).sort((a, b) => {
      return b.base_volume - a.base_volume
    }),
    period: label,
    total: 0,
    date: moment.utc().format()
  }

  result.components.forEach(function(d) {
    result.total += d.base_volume
  })

  return result
}

function saveResult(result) {
  console.log(chalk.yellow('saving: ' + result.period +
              ' ' + result.total + ' XRP'))

  return hbase.putRow({
    table: 'agg_metrics',
    rowkey: 'trade_volume|external|live|' + result.period,
    columns: result
  })
}

module.exports = function() {

  let index = 0
  let d = Date.now()
  console.log(chalk.yellow('aggregating rolling metrics'))

  function getMarketSummary(options) {
    return getKeys(options)
    .then(keys => {
      return hbase.getScan({
        table: 'agg_external_trades',
        startRow: keys.start,
        stopRow: keys.end
      })
    })
    .then(reduce)
  }

  function aggregateNext() {
    const current = periods[index]
    const tasks = []
    const label = (current.interval || '1') + current.unit
    const format = formatResult.bind(this, label)

    markets.forEach(m => {
      tasks.push(getMarketSummary({
        source: m.source,
        base: m.base,
        counter: m.counter,
        period: current.period,
        unit: current.unit,
        interval: current.interval
      }))
    })

    return Promise.all(tasks)
    .then(format)
    .then(saveResult)
    .then(() => {
      return periods[++index] ?
      aggregateNext() : undefined
    })
    .catch(logError)
  }

  return aggregateNext()
  .then(() => {
    d = (Date.now() - d) / 1000
    console.log(chalk.yellow('finished aggregations in ' + d + 's'))
  })
}
