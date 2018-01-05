-- Copyright 2015 Boundary, Inc.
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--    http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.

local framework = require('framework')
local Plugin = framework.Plugin
local DataSource = framework.DataSource
local Accumulator = framework.Accumulator
local mysql = require('mysql')
local sum = framework.util.sum
local merge = framework.table.merge
local PollerCollection = framework.PollerCollection
local DataSourcePoller = framework.DataSourcePoller
local Cache = framework.Cache
local ipack = framework.util.ipack
local notEmpty = framework.string.notEmpty
local ratio = framework.util.ratio

local json = require('json')
local env = require('env')
 
local params = env.get("TSP_PLUGIN_PARAMS")
if(params == nil or  params == '') then
   params = framework.params
else
   params = json.parse(params)
end

params.items = params.items or {}

local cache = Cache(function () return Accumulator() end)

local MySQLDataSource = DataSource:extend()
function MySQLDataSource:initialize(opts)
  self.host = opts.host or 'localhost'
  self.port = opts.port or 3306
  self.user = opts.username or 'root'
  self.password = opts.password
  self.logging = true 
  self.source = opts.source
end

function MySQLDataSource:fetch(context, callback, params)
  if not self.client or not self.client.connected then
    self.client = mysql.createClient(self)
    self.client:propagate('error', self)
  end
  self.client:query('SHOW /*!50002 GLOBAL */ STATUS', function (err, status, fields) 
    if err then
      --err.source = self.source -- removed for luvit platform
      self:emit('error', err)
    else
      self.client:query('SHOW GLOBAL VARIABLES', function (err, variables, fields)
        if (err) then
          --err.source = self.source
          self:emit('error', err)
        else
          local result = merge(status, variables)
          callback(result, { context = self })
        end
      end)
    end
  end)
end

local function parse(data, context)
  local result = { curr = {}, diff = {}}
  local acc = cache:get(context.source)
  for _, row in ipairs(data) do
    local value = tonumber(row.Value)
    if value then
      result.diff[row.Variable_name] = acc(row.Variable_name, value)
      result.curr[row.Variable_name] = value
    end
  end
  return result
end

local function poller(item)
  item.pollInterval = notEmpty(item.pollInterval, 1000)
  local ds = MySQLDataSource:new(item)
  local p = DataSourcePoller(item.pollInterval, ds)
  return p 
end

local function createPollers(items)
  local pollers = PollerCollection()
  for _, i in ipairs(items) do
    pollers:add(poller(i))
  end
  return pollers
end

local pollers = createPollers(params.items)

local plugin = Plugin({ pollInterval = 1000 }, pollers)
function plugin:onParseValues(data, extra)
  local result = {}
  local metric = function (...)
    ipack(result, ...)
  end
  local parsed = parse(data, extra.context)
  local curr = parsed.curr
  local diff = parsed.diff
  local qcache_memory_usage = (curr.query_cache_size - curr.Qcache_free_memory) / curr.query_cache_size;
  local qcache_hits = ratio(diff.Qcache_hits, diff.Com_select + diff.Qcache_hits)
  local source = extra.context.source
  metric('MYSQL_CONNECTIONS', diff.Connections, nil, source)
  metric('MYSQL_ABORTED_CONNECTIONS', sum({ diff.Aborted_connects, diff.Aborted_clients }), nil, source)
  metric('MYSQL_BYTES_IN', diff.Bytes_received, nil, source)
  metric('MYSQL_BYTES_OUT', diff.Bytes_sent, nil, source)
  metric('MYSQL_SLOW_QUERIES', diff.Slow_queries, nil, source)
  metric('MYSQL_ROW_MODIFICATIONS', sum({ diff.Handler_write, diff.Handler_update, diff.Handler_delete }), nil, source)
  metric('MYSQL_ROW_READS', sum({ diff.Handler_read_first, diff.Handler_read_key, diff.Handler_read_next, diff.Handler_read_prev, diff.Handler_read_rnd, diff.Handler_read_rnd_next }), nil, source)
  metric('MYSQL_TABLE_LOCKS', diff.Table_locks_immediate, nil, source)
  metric('MYSQL_TABLE_LOCKS_WAIT', diff.Table_locks_waited, nil, source)
  metric('MYSQL_COMMITS', diff.Handler_commit, nil, source)
  metric('MYSQL_ROLLBACKS', diff.Handler_rollback, nil, source)
  metric('MYSQL_QCACHE_HITS', qcache_hits, nil, source)
  metric('MYSQL_QCACHE_PRUNES', diff.Qcache_lowmem_prunes, nil, source)
  metric('MYSQL_QCACHE_MEMORY', qcache_memory_usage, nil, source)
  return result
end

plugin:run()
