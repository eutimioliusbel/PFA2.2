/**
 * Artillery Processor: Database Stress Test helpers
 * Provides utility functions for database connection pool and query stress tests
 */

module.exports = {
  /**
   * Select a random target user for database operations
   */
  selectRandomUser: function (context, events, done) {
    const randomUserNum = Math.floor(Math.random() * 100) + 1;
    context.vars.targetUserId = `user-${randomUserNum}`;

    return done();
  },

  /**
   * Check for connection pool exhaustion
   */
  checkConnectionPoolExhaustion: function (requestParams, response, context, ee, next) {
    if (response.statusCode === 503) {
      console.log(`💥 CONNECTION POOL EXHAUSTED: ${context.vars.username}`);
      ee.emit('customStat', {
        stat: 'connection_pool_exhaustions',
        value: 1
      });
    } else if (response.statusCode === 500) {
      const body = response.body ? JSON.parse(response.body) : {};
      if (body.error && body.error.includes('connection')) {
        console.log(`⚠️  Connection error: ${body.error}`);
        ee.emit('customStat', {
          stat: 'connection_errors',
          value: 1
        });
      }
    }
    return next();
  },

  /**
   * Check for slow queries
   */
  checkSlowQuery: function (requestParams, response, context, ee, next) {
    const latency = response.timings?.firstByte || 0;

    if (latency > 1000) {
      console.log(`🐌 SLOW QUERY DETECTED: ${latency}ms for ${context.vars.username}`);
      ee.emit('customStat', {
        stat: 'slow_queries',
        value: 1
      });
    }

    return next();
  },

  /**
   * Measure database query latency
   */
  measureQueryLatency: function (requestParams, response, context, ee, next) {
    const latency = response.timings?.firstByte || 0;

    // Emit custom metric
    ee.emit('customStat', {
      stat: 'db_query_latency',
      value: latency
    });

    return next();
  },

  /**
   * Log database operation results
   */
  logDbOperation: function (requestParams, response, context, ee, next) {
    if (response.statusCode === 200) {
      console.log(`✅ DB operation success: ${context.vars.username}`);
    } else if (response.statusCode === 500) {
      console.log(`❌ DB operation error: ${context.vars.username} - Status ${response.statusCode}`);
    } else if (response.statusCode === 503) {
      console.log(`🚫 DB service unavailable: ${context.vars.username}`);
    } else if (response.statusCode === 504) {
      console.log(`⏱️  DB operation timeout: ${context.vars.username}`);
    }
    return next();
  },

  /**
   * Check for database deadlocks
   */
  checkDatabaseDeadlock: function (requestParams, response, context, ee, next) {
    if (response.statusCode === 500) {
      const body = response.body ? JSON.parse(response.body) : {};
      if (body.error && body.error.includes('deadlock')) {
        console.log(`💀 DATABASE DEADLOCK DETECTED: ${context.vars.username}`);
        ee.emit('customStat', {
          stat: 'database_deadlocks',
          value: 1
        });
      }
    }
    return next();
  }
};
