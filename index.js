// log the error as soon as possible
process.on('uncaughtException', function(err) {
    console.error('msg %s, name %s, stack->\n%s', err.message, err.name, err.stack || 'NONE');
    process.exit(-1);
});

var _format = require('util').format;
var _mysql = require('mysql');
var _os = require('os');

var _param  = process.env.TSP_PLUGIN_PARAMS;
if (_param == null || _param == ''){
  _param = require('./param.json');
}else{
  _param = parseJSON(_param); 
} 
var _tools = require('graphdat-plugin-tools');

var _connection; // the mysql connection
var _pollInterval; // the interval to poll the metrics
var _previous = {}; // remember the previous poll data so we can provide proper counts
var _source; // the source of the metrics

// ================
// HELPER FUNCTIONS
// ================

// get the natural difference between a and b
function diff(a, b)
{
    if (a == null || b == null)
        return 0;
    else
        return Math.max(a - b, 0);
}

// get the natural sum of the passed in values
function sum()
{
    var s = 0;
    for (var i = 0; i < arguments.length; i++)
        s += (arguments[i] == null || isNaN(arguments[i])) ? 0 : arguments[i];

    return Math.max(s, 0);
}

function parse(x)
{
    var y = parseFloat(x, 10);
    return (isNaN(y) ? 0 : y);
}

function closeAndExit(err)
{
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    if (_connection)
        _connection.end(function(err1) { process.exit((err || err1) ? -1 : 0); });
    else
        process.exit((err) ? -1 : 0);
}
function handleError(err)
{
    console.error(err);
    closeAndExit(err);
}

process.on('SIGINT', closeAndExit);
process.on('SIGTERM', closeAndExit);

// ==========
// VALIDATION
// ==========

// Check that we have all of the SQL creds
if (!_param.hostname && !_param.socketPath)
    return handleError('To get statistics from MySQL, either a Socket Path or hostname is required');
if (!_param.username)
    return handleError('To get statistics from MySQL, a username is required');
if (!_param.password)
    return handleError('To get statistics from MySQL, a password is required');

// If we do not have a port, use the default
_param.port = _param.port || 3306;

// If you do not have a poll intevarl, use 1000 as the default
_pollInterval = _param.pollInterval || 1000;

// If we do not have a source, we prefix everything with the servers hostname
_source = (_param.source || _os.hostname()).trim();

// mysql config
var _mysqlConfig = {
    host : _param.hostname,
    port : _param.port,
    socketPath : _param.socketPath,
    user : _param.username,
    password : _param.password
};

// ===============
// LET GET STARTED
// ===============

var connectAttempt = 0;
function mysqlConnect()
{
    // init the connection
    _connection = _mysql.createConnection(_mysqlConfig);

    _connection.connect(function(err)
    {
        // this is the first attempt to connect, you probably entered in the wrong details
        // so exit early and let you update them
        if (err && ++connectAttempt === 1)
        {
            return handleError(_format('Could not connect to the database\nmsg %s, name %s, stack->\n%s', err.message, err.name, err.stack || 'NONE'));
        }
        else if (err)
        {
            console.error('Could not connect to the database:', err);
            setTimeout(mysqlConnect, 2000);
        }
    });

    _connection.on('error', function(err)
    {
        console.error('Error connecting to the database:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST')
        {
            // try again, mysql was probably restarted
            mysqlConnect();
        }
        else
        {
            handleError(err);
        }
    });
}
mysqlConnect();

function poll()
{
    _connection.query('SHOW GLOBAL STATUS;', function(err1, status, _)
    {
        if (err1)
            return handleError(err1);

        _connection.query('SHOW GLOBAL VARIABLES;', function(err2, vars, _)
        {
            if (err2)
                return handleError(err2);

            var adjusted = {};
            var current = {};
            var rows = status.concat(vars);

            rows.forEach(function(row)
            {
                if (!row || (!('Variable_name' in row)) || (!('Value' in row)))
                    return;

                var c = parse(row.Value);
                current[row.Variable_name] = parse(c);
                adjusted[row.Variable_name] = diff(c, _previous[row.Variable_name]);
            });

            // QUERY CACHE
            var qcacheMemory = parse(diff(current.query_cache_size, current.Qcache_free_memory) / current.query_cache_size);
            var qcacheHits = parse(adjusted.Qcache_hits / (adjusted.Com_select + adjusted.Qcache_hits));

            console.log('MYSQL_CONNECTIONS %d %s', adjusted.Connections, _source);
            console.log('MYSQL_ABORTED_CONNECTIONS %d %s', sum(adjusted.Aborted_connects, adjusted.Aborted_clients), _source);
            console.log('MYSQL_BYTES_IN %d %s', adjusted.Bytes_received, _source);
            console.log('MYSQL_BYTES_OUT %d %s', adjusted.Bytes_sent, _source);
            console.log('MYSQL_SLOW_QUERIES %d %s', adjusted.Slow_queries, _source);
            console.log('MYSQL_ROW_MODIFICATIONS %d %s', sum(adjusted.Handler_write, adjusted.Handler_update, adjusted.Handler_delete), _source);
            console.log('MYSQL_ROW_READS %d %s', sum(adjusted.Handler_read_first, adjusted.Handler_read_key, adjusted.Handler_read_next,adjusted.Handler_read_prev, adjusted.Handler_read_rnd, adjusted.Handler_read_rnd_next), _source);
            console.log('MYSQL_TABLE_LOCKS %d %s', adjusted.Table_locks_immediate, _source);
            console.log('MYSQL_TABLE_LOCKS_WAIT %d %s', adjusted.Table_locks_waited, _source);
            console.log('MYSQL_COMMITS %d %s', adjusted.Handler_commit, _source);
            console.log('MYSQL_ROLLBACKS %d %s', adjusted.Handler_rollback, _source);
            console.log('MYSQL_QCACHE_MEMORY %d %s', qcacheMemory, _source);
            console.log('MYSQL_QCACHE_HITS %d %s', qcacheHits, _source);
            console.log('MYSQL_QCACHE_PRUNES %d %s', adjusted.Qcache_lowmem_prunes, _source);

            _previous = current;
            setTimeout(poll, _pollInterval);
        });
    });
}

poll();
