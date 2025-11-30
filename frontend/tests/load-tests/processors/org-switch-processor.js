/**
 * Artillery Processor: Organization Switch helpers
 * Provides utility functions for org switching load tests
 */

module.exports = {
  /**
   * Track organization context switches
   */
  trackOrgSwitch: function (requestParams, response, context, ee, next) {
    const currentOrg = context.vars.organizationId;

    if (!context.vars.previousOrg) {
      context.vars.previousOrg = currentOrg;
    } else if (context.vars.previousOrg !== currentOrg) {
      console.log(`🔄 Org switch: ${context.vars.previousOrg} → ${currentOrg} (${context.vars.username})`);

      // Emit custom metric
      ee.emit('customStat', {
        stat: 'org_switches',
        value: 1
      });

      context.vars.previousOrg = currentOrg;
    }

    return next();
  },

  /**
   * Check for race conditions during org switch
   */
  checkRaceCondition: function (requestParams, response, context, ee, next) {
    if (response.statusCode === 500) {
      const body = response.body ? JSON.parse(response.body) : {};
      if (body.error && (body.error.includes('race') || body.error.includes('concurrent'))) {
        console.log(`⚠️  RACE CONDITION DETECTED: ${context.vars.username}`);
        ee.emit('customStat', {
          stat: 'race_conditions',
          value: 1
        });
      }
    }
    return next();
  },

  /**
   * Measure org switch latency
   */
  measureSwitchLatency: function (requestParams, response, context, ee, next) {
    const latency = response.timings?.firstByte || 0;

    if (latency > 400) {
      console.log(`⚠️  High org switch latency: ${latency}ms for ${context.vars.username}`);
    }

    // Emit custom metric
    ee.emit('customStat', {
      stat: 'org_switch_latency',
      value: latency
    });

    return next();
  },

  /**
   * Log organization access results
   */
  logOrgAccess: function (requestParams, response, context, ee, next) {
    if (response.statusCode === 200) {
      console.log(`✅ Org access granted: ${context.vars.organizationId} for ${context.vars.username}`);
    } else if (response.statusCode === 403) {
      console.log(`🚫 Org access denied: ${context.vars.organizationId} for ${context.vars.username}`);
    } else if (response.statusCode === 404) {
      console.log(`❓ Org not found: ${context.vars.organizationId}`);
    } else {
      console.log(`❌ Org access error: Status ${response.statusCode}`);
    }
    return next();
  }
};
