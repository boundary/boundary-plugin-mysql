# TrueSight Pulse MySQL Plugin

Collects metrics from a MySQL database instance. See video [walkthrough](https://help.truesight.bmc.com/hc/en-us/articles/201536772).

### Prerequisites

User account should have the appropriate privilleges granted to connect remotely/locally.

#### Supported OS

|     OS    | Linux | Windows | OS X |
|:----------|:-----:|:-------:|:----:|
| Supported |   v   |    v    |  v   |

#### TrueSight Pulse Meter versions v4.5 or later

- To install new meter go to Settings->Installation or [see instructions](https://help.truesight.bmc.com/hc/en-us/sections/200634331-Installation).
- To upgrade the meter to the latest version - [see instructions](https://help.truesight.bmc.com/hc/en-us/articles/201573102-Upgrading-the-Boundary-Meter).

### Plugin Setup

None

#### Plugin Configuration Fields

|Field Name   |Description                                                                                           |
|:------------|:-----------------------------------------------------------------------------------------------------|
|Host         |The hostname of the MySQL Server (Socket Path or Hostname is required)                                |
|Port         |Port to use when accessing the MySQL Server                                                           |
|Username     |Username to access the MySQL database (Username is required)                                          |
|Password     |Password to access the MySQL database (Password is required)                                          |
|Poll Interval|How often (in milliseconds) to poll for metrics                                                       |
|Source       |The Source to display in the legend for the mysql data.  It will default to the hostname of the server|

### Metrics Collected

#### For All Versions

|Metric Name              |Description                                                                   |
|:------------------------|:-----------------------------------------------------------------------------|
|MySQL Connections        |The number of connection attempts                                             |
|MySQL Aborted Connections|The number of failed connection attempts including those aborted by the client|
|MySQL Bytes In           |bytes in                                                                      |
|MySQL Bytes Out          |bytes out                                                                     |
|MySQL Slow Queries       |The number of queries that have taken more than long_query_time seconds       |
|MySQL Row Modification   |The number of requests to insert/update/delete a row                          |
|MySQL Row Reads          |The number of requests to read a row                                          |
|MySQL Table Locks        |The number of table locks granted                                             |
|MySQL Table Wait Locks   |The number of table locks that required a wait                                |
|MySQL Commits            |The number commits                                                            |
|MySQL Rollback           |The number rollbacks                                                          |
|MySQL Query Memory       |The percentage of used query memory                                           |
|MySQL Query Cache Hits   |The percentage of queries from cache                                          |
|MySQL Query Cache Prunes |The number of queries delete from the query cache                             |

### Dashboards

- MySQL

### References

Tracks the following metrics for [mysql](http://www.mysql.com/)
