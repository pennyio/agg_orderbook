'use strict'

const config = require('./nconf.js')
const moment = require('moment')
const Hbase = require('ripple-hbase-client')
const hbase = new Hbase(config.get('hbase'))
const formatKey = 'YYYYMMDDHHmmss'
const timeInfinity = 99999999999999
const agg_table = 'agg_external_trades'
const trade_table = 'external_trades'

/**
 * round
 * round to siginficant digits
 */

function round(n, sig) {
  const mult = Math.pow(10,
      sig - Math.floor(Math.log(n) / Math.LN10) - 1)
  return Math.round(n * mult) / mult
}

hbase.round = round

/*
 * obtain an index by reversing timestamp
 * index = timeInfinity - timestamp
 */
hbase.getInverseTimestamp = function(dateObject) {
  return timeInfinity - Number(dateObject.format(formatKey))
}

/*
 * aggregate trade data
 * object contains source, base, counter
 * input_table, output_table, interval, unit, lastInterval
 * lastInterval is optional
 * difference in key structure
 */
hbase.getTradeAggregate = function(object) {

  /**
   * reduce
   */

  function reduce(res) {
    const buckets = {}

    res.rows.forEach(d => {
      let bucketObj = moment(d.columns.timestamp).utc()
      const price = Number(d.columns.price)
      const amount = Number(d.columns.amount)
      const open = price || Number(d.columns.open)
      const high = price || Number(d.columns.high)
      const low = price || Number(d.columns.low)
      const close = price || Number(d.columns.close)

      const count = Number(d.columns.count) || 1 // default to 1
      const base_volume = amount || Number(d.columns.base_volume)
      const counter_volume = (amount * price)
        || Number(d.columns.counter_volume)

      const sell_volume = amount || Number(d.columns.sell_volume)
      const buy_volume = amount || Number(d.columns.buy_volume)
      // sell_count and buy_count only exist in processed data
      const sell_count = Number(d.columns.sell_count) || 0 // default to 0
      const buy_count = Number(d.columns.buy_count) || 0// default to 0
      const method = object.unit + 's'

      bucketObj = bucketObj.startOf(object.unit)
        .subtract(bucketObj[method]() % object.interval, method)
      const bucket = bucketObj.format(formatKey)

      if (!buckets[bucket]) {
        buckets[bucket] = {
          base_volume: 0,
          counter_volume: 0,
          count: 0,
          buy_volume: 0,
          sell_volume: 0,
          buy_count: 0,
          sell_count: 0,
          open: open,
          high: high,
          low: low,
          close: close,
          date_object: bucketObj
        }
      }

      if (high > buckets[bucket].high) {
        buckets[bucket].high = high
      }

      if (low < buckets[bucket].low) {
        buckets[bucket].low = low
      }

      buckets[bucket].close = close
      buckets[bucket].base_volume += base_volume
      buckets[bucket].counter_volume += counter_volume
      buckets[bucket].count += count

      // type only exists for raw trade data
      if (d.columns.type) {
        // this is different from the starter code
        // d.maker_side in starter code
        if (d.columns.type === 'sell') {
          buckets[bucket].sell_volume += sell_volume
          buckets[bucket].sell_count += 1
        } else if (d.columns.type === 'buy') {
          buckets[bucket].buy_volume += buy_volume
          buckets[bucket].buy_count += 1
        }
      } else {
        // could be zeros
        buckets[bucket].buy_volume += buy_volume
        buckets[bucket].buy_count += buy_count

        buckets[bucket].sell_volume += sell_volume
        buckets[bucket].sell_count += sell_count

      }
    })

    const results = Object.keys(buckets).map(function(key) {
      const row = buckets[key]
      row.source = object.source
      row.interval = object.interval + object.unit
      row.base = object.base
      row.counter = object.counter
      row.timestamp = key
      row.vwap = row.counter_volume / row.base_volume
      row.vwap = round(row.vwap, 6)

      return row
    })

    console.log(object.source + ' ' +
                object.base + object.counter + ' ' +
                object.interval + object.unit + ': ' +
                results.length + ' rows')

    return results
  }

  /**
   * aggregateTrades
   */

  function aggregateTrades() {
    const now = moment().utc()
    const then = moment().utc()

    then.startOf('minute')
    .subtract(then.minutes() % 5, 'minute')
    .subtract(4, 'hours')
    .subtract(1, 'second') // scan not inclusive

    const start = hbase.getInverseTimestamp(now)
    const end = hbase.getInverseTimestamp(then)

    const startKey = [
      object.source.toLowerCase(),
      object.base.toUpperCase(),
      object.counter.toUpperCase(),
      start
    ].join('|')

    const endKey = [
      object.source.toLowerCase(),
      object.base.toUpperCase(),
      object.counter.toUpperCase(),
      end
    ].join('|')

    return hbase.getScan({
      table: trade_table,
      startRow: startKey,
      stopRow: endKey
    }).then(reduce)
  }

  /**
   * aggregateIntervals
   */

  function aggregateIntervals() {
    const now = moment().utc()
    const then = moment().utc()
    const method = object.unit + 's'

    then.startOf(object.unit)
    .subtract(then[method]() % object.interval, object.unit)
    .subtract(object.interval * 20, object.unit)
    .subtract(1, 'second') // scan not inclusive

    const start = hbase.getInverseTimestamp(now)
    const end = hbase.getInverseTimestamp(then)

    const startKey = [
      object.source.toLowerCase(),
      object.base.toUpperCase(),
      object.counter.toUpperCase(),
      object.lastInterval.toLowerCase(),
      start
    ].join('|')

    const endKey = [
      object.source.toLowerCase(),
      object.base.toUpperCase(),
      object.counter.toUpperCase(),
      object.lastInterval.toLowerCase(),
      end
    ].join('|')

    // console.log(then, now, object)
    return hbase.getScan({
      table: agg_table,
      startRow: startKey,
      stopRow: endKey
    }).then(reduce)
  }

  if (object.lastInterval) {
    return aggregateIntervals()
  } else {
    return aggregateTrades()
  }
}

/*
 * receive aggregated data from aggregate trades
 * process row and create new key structure
 * source | base | counter | interval | inverse timestamp
 * inverse timestamp is used to get latest trade first
 * for plotting of charts
 */
hbase.saveTradeAggregate = function(data) {
  const rows = {}

  data.forEach(d => {
    const index = hbase.getInverseTimestamp(d.date_object)
    const keybase = [
      d.source.toLowerCase(),
      d.base.toUpperCase(),
      d.counter.toUpperCase(),
      d.interval,
      index
    ].join('|')

    const columns = {
      'f:source': d.source.toLowerCase(),
      'f:base': d.base.toUpperCase(),
      'f:counter': d.counter.toUpperCase(),
      'f:interval': d.interval.toLowerCase(),
      'f:timestamp': d.date_object.toISOString(),
      'vwap': d.vwap,
      'base_volume': d.base_volume,
      'counter_volume': d.counter_volume,
      'count': d.count,
      'buy_volume': d.buy_volume,
      'sell_volume': d.sell_volume,
      'buy_count': d.buy_count,
      'sell_count': d.sell_count,
      'open': d.open,
      'high': d.high,
      'low': d.low,
      'close': d.close
    }

    rows[keybase] = columns
  })

  return hbase.putRows({
    table: agg_table,
    rows: rows
  })
}

/*
 * get last trade from hbase
 * external_trades table
 * object contains exchange, base, counter
 */
hbase.getLastTrade = function(object) {
  const now = moment().utc()
  const start = hbase.getInverseTimestamp(now)

  const startKey = [
    object.exchange.toLowerCase(),
    object.base.toUpperCase(),
    object.counter.toUpperCase(),
    start
  ].join('|')

  const endKey = [
    object.exchange.toLowerCase(),
    object.base.toUpperCase(),
    object.counter.toUpperCase(),
    'z'
  ].join('|')

  return hbase.getScan({
    table: trade_table,
    startRow: startKey,
    stopRow: endKey,
    limit: 1
  }).then(res => {
    if (res.rows.length) {
      const parts = res.rows[0].rowkey.split('|')

      return {
        source: parts[0],
        base: parts[1],
        counter: parts[2],
        index: Number(parts[3]),
        tid: res.rows[0].columns.tid,
        timestamp: res.rows[0].columns.timestamp
      }

    } else {
      return {
        index: timeInfinity
      }
    }
  })
}

/*
 * process trade data into hbase format
 * write data to respective hbase table
 * object contains table name and data
 */
hbase.saveTradeData = function(data) {
  const rows = {}

  if (data && data.length) {
    data.forEach(d => {
      const keybase = [
        d.source.toLowerCase(),
        d.base.toUpperCase(),
        d.counter.toUpperCase(),
        d.index,
        d.tid].join('|')

      const columns = {
        'f:source': d.source.toLowerCase(),
        'f:base': d.base.toUpperCase(),
        'f:counter': d.counter.toUpperCase(),
        'f:tid': d.tid,
        'f:timestamp': d.timestamp.toISOString(),
        'amount': d.amount,
        'price': d.price,
        'type': d.type ? d.type.toLowerCase() : undefined,
        'size': d.size
      }

      rows[keybase] = columns
    })
  }

  return hbase.putRows({
    table: trade_table,
    rows: rows
  })
}

/*
 * process orderbook data into hbase format
 * write data to respective hbase table
 * object contains table name and data
 */
hbase.saveOrderBookData = function(object) {
  // console.log(object)
  const rows = {}
  if (!object) {
    console.log('no data received at saveOrderBookData')
    return undefined

  } else if (object.data.source && object.data.base &&
    object.data.counter && object.table) {
    console.log(object.data.source + ' ' + object.data.base
      + object.data.counter + ' to table ' + object.table)

    const keybase = [
      object.data.source.toLowerCase(),
      object.data.base.toUpperCase(),
      object.data.counter.toUpperCase(),
      object.data.index
    ].join('|')

    const columns = {
      'f:source': object.data.source.toLowerCase(),
      'f:base': object.data.base.toUpperCase(),
      'f:counter': object.data.counter.toUpperCase(),
      'f:timestamp': object.data.timestamp.toISOString(),
      'bids': object.data.bids,
      'asks': object.data.asks
    }
    rows[keybase] = columns
  }

  return hbase.putRows({
    table: object.table,
    rows: rows
  })
}

module.exports = hbase
