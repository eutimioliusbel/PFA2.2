/**
 * Artillery Processor: Permission Grant helpers
 * Provides utility functions for permission grant load tests
 */

// Simulated user pool for random selection
const TEST_USER_POOL = [];
let userPoolInitialized = false;

module.exports = {
  /**
   * Select a random target user for permission grant
   */
  selectRandomUser: function (context, events, done) {
    // Generate a random target user ID from the load test users
    // In a real scenario, we'd query the database, but for load testing we simulate
    const orgCode = context.vars.organizationId ? context.vars.organizationId.split('_')[2] : '01';
    const randomUserNum = Math.floor(Math.random() * 100) + 1;
    const targetUsername = `loadtest_load_test_${orgCode.toLowerCase()}_user${randomUserNum.toString().padStart(3, '0')}`;

    // In a real implementation, we'd need the actual user ID
    // For this load test, we'll use a placeholder
    context.vars.targetUserId = `user-${orgCode}-${randomUserNum}`;
    context.vars.targetUsername = targetUsername;

    console.log(`🎯 Selected target user: ${targetUsername}`);

    return done();
  },

  /**
   * Log permission grant result
   */
  logPermissionGrant: function (requestParams, response, context, ee, next) {
    if (response.statusCode === 200) {
      console.log(`✅ Permission granted to ${context.vars.targetUsername} by ${context.vars.username}`);
    } else if (response.statusCode === 403) {
      console.log(`🚫 Permission grant denied for ${context.vars.username}`);
    } else if (response.statusCode === 404) {
      console.log(`❌ User not found: ${context.vars.targetUsername}`);
    } else {
      console.log(`❌ Permission grant error: Status ${response.statusCode}`);
    }
    return next();
  },

  /**
   * Check for database deadlocks
   */
  checkDeadlock: function (requestParams, response, context, ee, next) {
    if (response.statusCode === 500) {
      const body = response.body ? JSON.parse(response.body) : {};
      if (body.error && body.error.includes('deadlock')) {
        console.log(`💀 DEADLOCK DETECTED: ${context.vars.username} → ${context.vars.targetUsername}`);
        ee.emit('customStat', {
          stat: 'database_deadlocks',
          value: 1
        });
      }
    }
    return next();
  },

  /**
   * Measure permission grant latency
   */
  measureGrantLatency: function (requestParams, response, context, ee, next) {
    const latency = response.timings?.firstByte || 0;

    if (latency > 200) {
      console.log(`⚠️  High grant latency: ${latency}ms for ${context.vars.targetUsername}`);
    }

    // Emit custom metric
    ee.emit('customStat', {
      stat: 'permission_grant_latency',
      value: latency
    });

    return next();
  }
};
