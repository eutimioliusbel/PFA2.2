/**
 * Artillery Processor: Authentication helpers
 * Provides utility functions for load test scenarios
 */

module.exports = {
  /**
   * Set custom variables for the scenario
   */
  setVariables: function (requestParams, context, ee, next) {
    // Add timestamp for unique operations
    context.vars.timestamp = Date.now();
    context.vars.randomSuffix = Math.floor(Math.random() * 10000);
    return next();
  },

  /**
   * Log successful authentication
   */
  logAuth: function (requestParams, response, context, ee, next) {
    if (response.statusCode === 200 && response.body) {
      const body = JSON.parse(response.body);
      if (body.token) {
        console.log(`✅ Auth successful: ${context.vars.username}`);
      }
    } else {
      console.log(`❌ Auth failed: ${context.vars.username} - Status ${response.statusCode}`);
    }
    return next();
  },

  /**
   * Log permission check results
   */
  logPermissionCheck: function (requestParams, response, context, ee, next) {
    if (response.statusCode === 200) {
      console.log(`✅ Permission granted: ${context.vars.username}`);
    } else if (response.statusCode === 403) {
      console.log(`🚫 Permission denied: ${context.vars.username}`);
    } else {
      console.log(`❌ Permission check error: ${context.vars.username} - Status ${response.statusCode}`);
    }
    return next();
  },

  /**
   * Measure response time and track latency
   */
  measureLatency: function (requestParams, response, context, ee, next) {
    const latency = response.timings?.firstByte || 0;

    if (latency > 200) {
      console.log(`⚠️  High latency detected: ${latency}ms for ${context.vars.username}`);
    }

    // Emit custom metric
    ee.emit('customStat', {
      stat: 'permission_check_latency',
      value: latency
    });

    return next();
  }
};
