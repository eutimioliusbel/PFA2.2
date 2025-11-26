# ADR-005: Multi-Tenant Access Control - AI Opportunities

**Related**: ADR-005 (Multi-Tenant Access Control)
**Status**: AI-Ready Architecture
**Created**: 2025-11-26
**Last Updated**: 2025-11-26

---

## 🎯 Purpose

This document identifies "sockets" required in the standard code today so that AI features can be plugged in tomorrow without a rewrite. It ensures the Multi-Tenant Access Control system is future-proofed for AI augmentation and automation.

---

## 🤖 Future Use Cases: How AI Could Enhance Access Control

### 1. AI-Powered User Permission Suggestions

**Scenario**: When adding a new user to an organization, AI analyzes their role, department, and historical patterns to suggest appropriate permissions.

**AI Capability**:
```typescript
// Future AI Endpoint
POST /api/ai/suggest-permissions
{
  "userId": "user-123",
  "organizationId": "org-456",
  "role": "Project Manager",
  "department": "Construction"
}

// AI Response
{
  "suggestedPermissions": {
    "role": "editor",
    "canRead": true,
    "canWrite": true,
    "canDelete": false,
    "canManageUsers": false,
    "canSync": true
  },
  "confidence": 0.92,
  "reasoning": "Based on 150 similar Project Manager roles in Construction departments"
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Store `UserOrganization` creation timestamps
- ✅ Log permission changes with `modifiedBy` and `modifiedAt`
- ✅ Track user actions (create/read/update/delete) for pattern analysis
- ⚠️ **Add**: User department field
- ⚠️ **Add**: Permission change audit log

---

### 2. AI-Driven Security Anomaly Detection

**Scenario**: AI monitors user access patterns and alerts admins when anomalous behavior is detected (e.g., user accessing organizations they never accessed before, unusual bulk operations).

**AI Capability**:
```typescript
// Future AI Monitoring
AI analyzes:
- Login times and locations
- Data access patterns
- Permission usage frequency
- Failed auth attempts
- Organization switching patterns

AI Alert:
{
  "alertType": "ANOMALY_DETECTED",
  "userId": "user-789",
  "anomaly": "User accessed 5 new organizations in 10 minutes",
  "risk": "HIGH",
  "suggestedAction": "Temporarily suspend account and notify admin"
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Authentication logs (already in JWT middleware)
- ✅ Failed login tracking (`User.failedLoginCount`, `lockedAt`)
- ⚠️ **Add**: Audit log for organization access (track when user switches orgs)
- ⚠️ **Add**: IP address tracking for login attempts
- ⚠️ **Add**: Session activity log (actions per session)

---

### 3. AI-Automated Permission Escalation Requests

**Scenario**: User requests temporary elevated permissions via natural language. AI evaluates request, checks context, and auto-approves/denies based on policy.

**AI Capability**:
```typescript
// User Request (Natural Language)
"I need write access to Org 123 for the next 2 hours to update forecasts"

// AI Processing
AI analyzes:
- User's current role (viewer)
- Organization's service status (active)
- User's history (no violations)
- Request context (during business hours)
- Policy: Allow temporary escalation for trusted users

// AI Response
{
  "approved": true,
  "temporaryPermissions": {
    "canWrite": true,
    "expiresAt": "2025-11-26T18:00:00Z"
  },
  "reasoning": "User has clean record, request within business hours, limited scope"
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Permission structure in `UserOrganization`
- ⚠️ **Add**: Temporary permission expiry field (`permissionExpiresAt`)
- ⚠️ **Add**: Permission escalation request log
- ⚠️ **Add**: User violation history tracking

---

### 4. AI-Powered Org/User Health Monitoring

**Scenario**: AI monitors organization and user health metrics, predicting when to suspend accounts or organizations based on usage patterns, failed syncs, or inactivity.

**AI Capability**:
```typescript
// AI Health Check
AI monitors:
- Failed PEMS sync rate per organization
- User inactivity periods
- Permission usage vs. granted permissions
- Cost vs. usage trends

// AI Recommendation
{
  "organizationId": "org-999",
  "healthScore": 0.42,
  "recommendation": "SUSPEND",
  "reasoning": "Org has failed 15 consecutive syncs, no user activity in 30 days, high cost",
  "suggestedAction": "Mark serviceStatus as 'suspended' and notify billing"
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Organization `serviceStatus` fields
- ✅ Sync tracking in `ApiConfiguration`
- ⚠️ **Add**: User last activity timestamp (`User.lastActivityAt`)
- ⚠️ **Add**: Organization health metrics table
- ⚠️ **Add**: Cost tracking per organization

---

### 5. AI Natural Language Permission Queries

**Scenario**: Admin asks AI in natural language to find users/orgs with specific permission patterns.

**AI Capability**:
```typescript
// Admin Query (Natural Language)
"Show me all users with write access to more than 5 organizations"

// AI Query Generation
AI generates SQL:
SELECT u.username, COUNT(uo.organizationId) as org_count
FROM users u
JOIN user_organizations uo ON u.id = uo.userId
WHERE uo.canWrite = true
GROUP BY u.id
HAVING org_count > 5

// AI Response (Human-Readable)
{
  "results": [
    { "username": "admin", "orgCount": 12 },
    { "username": "pm_lead", "orgCount": 8 }
  ],
  "insight": "2 users have write access to 5+ organizations. Consider auditing for security."
}
```

**Data Prerequisites (Implement Now)**:
- ✅ All permission fields already queryable
- ⚠️ **Add**: Permission metadata (why permission was granted, by whom)
- ⚠️ **Add**: Permission tags/labels for semantic search

---

### 6. AI-Powered Multi-Channel Notification Intelligence

**Scenario**: AI optimizes notification delivery across email, Slack, Teams, and in-app channels based on user preferences, urgency, and historical response patterns.

**AI Capability**:
```typescript
// AI Notification Router
POST /api/ai/route-notification
{
  "userId": "user-123",
  "notificationType": "permission_granted",
  "urgency": "medium",
  "context": {
    "organizationId": "org-456",
    "actionBy": "admin-user",
    "timestamp": "2025-11-26T14:30:00Z"
  }
}

// AI Response
{
  "recommendedChannels": ["slack", "in_app"],
  "reasoning": "User responds to Slack 3x faster than email for permission changes",
  "deliveryStrategy": {
    "slack": { "immediate": true },
    "in_app": { "immediate": true, "persistent": true },
    "email": { "digest": true, "frequency": "daily" }
  },
  "confidence": 0.89
}

// AI Digest Generation
POST /api/ai/generate-digest
{
  "userId": "user-123",
  "period": "daily",
  "unreadNotifications": [...]
}

// AI Response
{
  "digestTitle": "Daily Summary: 5 permission changes, 2 new users",
  "summary": "Your team made 5 permission updates across 3 organizations. 2 new users joined Org HOLNG.",
  "prioritizedItems": [
    { "id": "notif-1", "priority": "high", "reason": "Affects financial permissions" },
    { "id": "notif-2", "priority": "medium", "reason": "New user in your org" }
  ],
  "actionRequired": 2,
  "canDefer": 3
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Notification table with delivery status tracking (`NotificationDelivery.status`)
- ✅ User channel preferences (`User.preferences.notifications`)
- ⚠️ **Add**: Notification response time tracking (time from send to read)
- ⚠️ **Add**: Channel effectiveness metrics per user
- ⚠️ **Add**: Notification engagement history (opened, clicked, dismissed)
- ⚠️ **Add**: Urgency classification rules in `Organization.settings`

---

### 7. AI-Assisted Hybrid Role-Override Permissions

**Scenario**: When admin creates a custom role or grants capability overrides, AI suggests optimal permission combinations and detects potential security risks.

**AI Capability**:
```typescript
// Admin Creating Custom Role
POST /api/ai/suggest-role-capabilities
{
  "roleTemplate": "editor",
  "intendedUse": "Field Engineer - needs read access to financials but no delete",
  "organizationId": "org-123"
}

// AI Response
{
  "suggestedCapabilities": {
    "viewFinancialDetails": true,
    "exportWithFinancials": false,
    "bulkOperations": true,
    "bypassReview": false
  },
  "reasoning": "Based on 23 similar 'Field Engineer' roles across 12 orgs",
  "securityWarnings": [
    {
      "capability": "viewFinancialDetails",
      "risk": "MEDIUM",
      "message": "Grants access to cost data. Ensure user has signed NDA."
    }
  ],
  "confidence": 0.91
}

// AI Anomaly Detection
AI monitors:
- Capability usage patterns (which capabilities are actually used)
- Privilege escalation paths (viewer → admin in 2 days)
- Unusual capability combinations (viewFinancials + exportData but role=viewer)

// AI Alert
{
  "alertType": "PRIVILEGE_ESCALATION_PATTERN",
  "userId": "user-456",
  "pattern": "User gained 5 new capabilities in 48 hours",
  "risk": "HIGH",
  "capabilities": ["viewFinancialDetails", "exportWithFinancials", "bulkOperations"],
  "suggestedAction": "Review with admin who granted these capabilities"
}
```

**Data Prerequisites (Implement Now)**:
- ✅ UserOrganization.capabilities JSONB field
- ✅ OrganizationRole.capabilities template
- ⚠️ **Add**: Capability usage tracking (when each capability is exercised)
- ⚠️ **Add**: Capability grant history (who granted which capabilities when)
- ⚠️ **Add**: Role template metadata (common use cases, typical capabilities)
- ⚠️ **Add**: Security risk scores per capability

---

### 8. AI-Powered Financial Data Access Monitoring

**Scenario**: AI monitors access to financial data (cost, monthlyRate, purchasePrice) and detects unusual patterns that might indicate unauthorized access or data exfiltration.

**AI Capability**:
```typescript
// AI Financial Access Monitor
AI analyzes:
- viewFinancialDetails capability usage frequency
- Export requests with financial data included
- API calls to /api/pfa/records with financial fields
- Users who gained financial access recently
- Time-of-day patterns (2am exports = suspicious)

// AI Alert
{
  "alertType": "UNUSUAL_FINANCIAL_ACCESS",
  "userId": "user-789",
  "pattern": "User exported 5,000 records with financial data at 2:17am",
  "risk": "CRITICAL",
  "details": {
    "recordCount": 5000,
    "organizations": ["org-1", "org-2", "org-3"],
    "timestamp": "2025-11-26T02:17:33Z",
    "ipAddress": "203.0.113.45",
    "userAgent": "Python-requests/2.28.0"
  },
  "reasoning": "User typically accesses 50-100 records during business hours. This is 50x normal volume at unusual time.",
  "suggestedAction": "Suspend user immediately and notify security team"
}

// AI Access Pattern Learning
POST /api/ai/learn-financial-access-patterns
{
  "userId": "user-123",
  "period": "last_90_days"
}

// AI Response
{
  "normalPattern": {
    "avgRecordsPerDay": 150,
    "peakHours": ["09:00-12:00", "14:00-17:00"],
    "avgExportsPerWeek": 2,
    "typicalOrganizations": ["org-1"]
  },
  "baselineConfidence": 0.94
}
```

**Data Prerequisites (Implement Now)**:
- ✅ AuditLog with financial data access tracking
- ✅ UserOrganization.capabilities.viewFinancialDetails flag
- ⚠️ **Add**: Financial data access log (separate from general audit log)
- ⚠️ **Add**: Export request tracking with field-level granularity
- ⚠️ **Add**: Baseline access patterns per user (ML model inputs)
- ⚠️ **Add**: IP address and geolocation tracking
- ⚠️ **Add**: User agent analysis (detect automation scripts)

---

### 9. AI-Driven BEO Portfolio Analytics

**Scenario**: For BEO (Business Enterprise Overhead) users, AI analyzes cross-organization trends, predicts budget overruns, and recommends resource reallocation.

**AI Capability**:
```typescript
// BEO User Requests Cross-Org Analysis
POST /api/ai/beo-analytics
{
  "query": "Which organizations are trending over budget in Rental equipment?",
  "period": "current_quarter",
  "scope": "all_organizations"
}

// AI Response
{
  "analysis": {
    "overBudgetOrgs": [
      {
        "organizationId": "org-HOLNG",
        "variance": "+$450K (+12%)",
        "primaryDriver": "Extended crane rentals due to weather delays",
        "affectedCategories": ["Cranes", "Hoists"],
        "trend": "worsening"
      },
      {
        "organizationId": "org-RIO",
        "variance": "+$220K (+7%)",
        "primaryDriver": "Unplanned generator additions",
        "affectedCategories": ["Power Equipment"],
        "trend": "stabilizing"
      }
    ],
    "recommendations": [
      {
        "action": "Reallocate budget from org-PEMS (under budget by $380K) to org-HOLNG",
        "confidence": 0.87,
        "reasoning": "PEMS purchased equipment vs. renting, freeing rental budget"
      },
      {
        "action": "Negotiate bulk rental discount for crane category across all orgs",
        "potentialSavings": "$150K annually",
        "confidence": 0.76
      }
    ]
  },
  "insights": "3 orgs trending over, 2 under budget. Net variance: +$290K (2.3%)"
}

// AI Predictive Forecasting
POST /api/ai/beo-predict-quarter-end
{
  "organizations": ["org-HOLNG", "org-RIO", "org-PEMS"]
}

// AI Response
{
  "predictions": [
    {
      "organizationId": "org-HOLNG",
      "predictedVariance": "+$680K (+18%)",
      "confidence": 0.82,
      "riskFactors": ["Weather delays continuing", "Crane rental extension likely"],
      "interventionWindow": "14 days"
    }
  ],
  "portfolioRisk": "MEDIUM",
  "suggestedActions": [
    "Review HOLNG crane usage with PM team",
    "Accelerate RIO generator procurement to reduce rentals"
  ]
}
```

**Data Prerequisites (Implement Now)**:
- ✅ BEO user flag (`User.isBeoUser`)
- ✅ Cross-org data access in PfaRecord queries
- ⚠️ **Add**: Organization budget baseline data
- ⚠️ **Add**: Historical variance tracking per org per category
- ⚠️ **Add**: Weather event log (correlate delays with weather)
- ⚠️ **Add**: Rental rate database (detect negotiation opportunities)
- ⚠️ **Add**: Equipment reallocation history (learn from past successes)

---

### 10. AI-Assisted Legacy Data Import & Field Mapping

**Scenario**: When importing CSV/Excel files from external systems (ESS, Procurement), AI suggests field mappings, detects data quality issues, and recommends transformations.

**AI Capability**:
```typescript
// User Uploads CSV for Import
POST /api/ai/analyze-import-file
{
  "fileName": "ESS_Export_Q4_2025.csv",
  "sampleRows": [
    { "Item_Code": "C-1234", "Desc": "Crane 50T", "Start": "2025-01-15", "Cost": "$5,000/mo" },
    { "Item_Code": "G-5678", "Desc": "Generator 500kW", "Start": "2025-02-01", "Cost": "$12,500" }
  ]
}

// AI Response
{
  "suggestedMappings": [
    { "sourceField": "Item_Code", "targetField": "equipmentCode", "confidence": 0.98 },
    { "sourceField": "Desc", "targetField": "equipmentDescription", "confidence": 0.95 },
    { "sourceField": "Start", "targetField": "originalStart", "confidence": 0.92, "transformation": "parseDate('MM/DD/YYYY')" },
    { "sourceField": "Cost", "targetField": "monthlyRate OR purchasePrice", "confidence": 0.78, "ambiguous": true }
  ],
  "dataQualityIssues": [
    {
      "issue": "Cost field mixing rental rates ($5,000/mo) and purchase prices ($12,500)",
      "severity": "HIGH",
      "affectedRows": "~40% of rows",
      "recommendation": "Add 'source' field or detect '/mo' suffix to classify as Rental vs Purchase"
    },
    {
      "issue": "Missing 'End Date' field",
      "severity": "MEDIUM",
      "recommendation": "Calculate from Start + Duration or default to Start + 30 days"
    }
  ],
  "transformations": [
    {
      "field": "Cost",
      "rule": "IF contains '/mo' THEN { source: 'Rental', monthlyRate: parseNumber(Cost) } ELSE { source: 'Purchase', purchasePrice: parseNumber(Cost) }"
    }
  ],
  "confidence": 0.84,
  "estimatedAccuracy": "92% (based on 500 similar ESS imports)"
}

// AI Field Mapping Learning
// After user confirms/corrects mappings, AI learns for future imports
POST /api/ai/learn-import-mapping
{
  "fileName": "ESS_Export_Q4_2025.csv",
  "confirmedMappings": [...],
  "organizationId": "org-123"
}
```

**Data Prerequisites (Implement Now)**:
- ✅ DataSourceMapping table with field mapping history
- ✅ Import audit log (track success/failure rates)
- ⚠️ **Add**: Sample data storage for ML training
- ⚠️ **Add**: Transformation rule library (common patterns)
- ⚠️ **Add**: Data quality scoring metadata
- ⚠️ **Add**: Organization-specific mapping preferences
- ⚠️ **Add**: Historical import accuracy metrics

---

### 11. AI-Powered Audit Log Intelligence

**Scenario**: AI analyzes audit logs to detect compliance violations, suggest revert operations, and generate executive summaries for audit reports.

**AI Capability**:
```typescript
// AI Audit Analysis
POST /api/ai/analyze-audit-trail
{
  "organizationId": "org-123",
  "period": "last_30_days",
  "focusAreas": ["permission_changes", "financial_data_access", "data_modifications"]
}

// AI Response
{
  "summary": "3,452 logged actions. 98% compliant. 2 anomalies detected.",
  "anomalies": [
    {
      "type": "BULK_PERMISSION_GRANT",
      "userId": "admin-user",
      "action": "Granted 'viewFinancialDetails' to 15 users in 5 minutes",
      "risk": "MEDIUM",
      "reasoning": "Unusual bulk permission grant. Typical admin grants 2-3 permissions per session.",
      "recommendation": "Verify with admin if this was intentional onboarding or potential account compromise"
    },
    {
      "type": "FINANCIAL_DATA_MODIFICATION",
      "userId": "user-456",
      "action": "Modified 'monthlyRate' on 200 PFA records without Pre-Flight Review",
      "risk": "HIGH",
      "reasoning": "Bypassed mandatory review process. User has 'bypassReview' capability but used it excessively.",
      "recommendation": "Review changes and consider revoking 'bypassReview' capability"
    }
  ],
  "complianceScore": 0.98,
  "trends": {
    "permissionChanges": "+15% vs last month",
    "dataModifications": "-8% vs last month",
    "syncOperations": "+22% vs last month"
  }
}

// AI Revert Suggestion
POST /api/ai/suggest-revert
{
  "auditLogId": "audit-12345",
  "context": "User accidentally bulk-deleted 50 PFA records"
}

// AI Response
{
  "canRevert": true,
  "revertStrategy": "COMPENSATING_TRANSACTION",
  "affectedRecords": 50,
  "dependencies": [
    "3 records were subsequently modified by other users",
    "12 records were synced to PEMS (requires PEMS write-back)"
  ],
  "revertPlan": {
    "step1": "Restore 47 unmodified records from audit log (immediate)",
    "step2": "Merge 3 modified records (manual review required)",
    "step3": "Submit revert batch to PEMS API (estimated 2 minutes)"
  },
  "riskAssessment": "LOW",
  "confidence": 0.94
}

// AI Executive Summary Generation
POST /api/ai/generate-compliance-report
{
  "organizationId": "org-123",
  "period": "Q4_2025"
}

// AI Response (Markdown)
{
  "report": `
## Q4 2025 Access Control Compliance Report

**Organization**: HOLNG Project
**Period**: October 1 - December 31, 2025
**Total Actions Logged**: 18,453

### Compliance Overview
- **Compliance Rate**: 99.2% (18,305 / 18,453 actions)
- **Violations**: 148 (0.8%)
- **Security Incidents**: 2 (escalated to security team)

### Key Findings
1. **Permission Management**: 1,234 permission changes. Average response time: 4.2 hours.
2. **Financial Data Access**: 456 users accessed financial data. All within authorized scope.
3. **Data Modifications**: 3,421 PFA records modified. 98% with Pre-Flight Review.

### Recommendations
1. Consider revoking 'bypassReview' capability from 3 users (excessive use detected)
2. Implement additional training for 5 users who had 3+ failed permission requests
3. Review notification settings for 12 users who never read permission change notifications
  `,
  "attachments": {
    "detailedAuditLog": "audit_q4_2025.csv",
    "anomalyReport": "anomalies_q4_2025.pdf"
  }
}
```

**Data Prerequisites (Implement Now)**:
- ✅ AuditLog table with comprehensive action tracking
- ✅ Batch transaction support (batchId field)
- ⚠️ **Add**: Compliance rule definitions (what constitutes a violation)
- ⚠️ **Add**: Historical compliance scores for trending
- ⚠️ **Add**: Revert dependency graph (track record relationships)
- ⚠️ **Add**: Executive report templates
- ⚠️ **Add**: Anomaly detection baseline models

---

### 12. AI-Enhanced Personal Access Token Security

**Scenario**: AI monitors PAT usage patterns, detects compromised tokens, and recommends security improvements like scope narrowing and expiration policies.

**AI Capability**:
```typescript
// AI PAT Security Monitor
AI analyzes:
- Token usage frequency and timing
- IP address patterns (detect token sharing)
- Scope usage (which scopes are actually used)
- Failed authentication attempts
- Unusual request patterns (100 requests/second = automation)

// AI Alert
{
  "alertType": "PAT_COMPROMISE_SUSPECTED",
  "tokenId": "pat-12345",
  "userId": "user-789",
  "pattern": "Token used from 5 different countries in 30 minutes",
  "risk": "CRITICAL",
  "details": {
    "ipAddresses": ["203.0.113.1 (US)", "198.51.100.5 (UK)", "192.0.2.10 (CN)", "..."],
    "requestCount": 1432,
    "avgRequestsPerMinute": 47,
    "scopesUsed": ["read:pfa", "read:financials", "export:data"]
  },
  "reasoning": "Geographically impossible travel. Token likely leaked.",
  "suggestedAction": "Revoke token immediately and notify user"
}

// AI Scope Recommendation
POST /api/ai/recommend-pat-scopes
{
  "userId": "user-123",
  "intendedUse": "PowerBI dashboard showing equipment forecasts",
  "currentScopes": ["read:pfa", "write:pfa", "read:financials", "export:data"]
}

// AI Response
{
  "recommendedScopes": ["read:pfa", "export:data"],
  "removedScopes": ["write:pfa", "read:financials"],
  "reasoning": "PowerBI only needs read access. write:pfa and read:financials are excessive for dashboard use.",
  "securityImpact": "Reduced attack surface by 50%",
  "confidence": 0.91
}

// AI Token Expiration Policy
POST /api/ai/suggest-token-expiration
{
  "tokenId": "pat-12345",
  "usagePattern": "daily_at_09:00"
}

// AI Response
{
  "recommendedExpiration": "90_days",
  "reasoning": "Token used consistently for automated reports. 90-day expiration balances security and convenience.",
  "alternatives": [
    { "option": "30_days", "pros": "More secure", "cons": "Frequent renewal burden" },
    { "option": "never", "pros": "No maintenance", "cons": "High security risk" }
  ]
}
```

**Data Prerequisites (Implement Now)**:
- ✅ PersonalAccessToken table with usage tracking
- ✅ IP address and geolocation logging
- ⚠️ **Add**: Token usage baseline per user
- ⚠️ **Add**: Geolocation anomaly detection
- ⚠️ **Add**: Request rate analysis per token
- ⚠️ **Add**: Scope usage statistics (which scopes are exercised)
- ⚠️ **Add**: Token compromise incident history

---

### 13. AI-Optimized Invitation Lifecycle

**Scenario**: AI predicts invitation acceptance likelihood, suggests optimal send times, and automates follow-up reminders.

**AI Capability**:
```typescript
// AI Invitation Acceptance Prediction
POST /api/ai/predict-invitation-acceptance
{
  "email": "newuser@example.com",
  "organizationId": "org-123",
  "roleId": "role-editor",
  "invitedBy": "admin-user"
}

// AI Response
{
  "acceptanceProbability": 0.78,
  "reasoning": "Email domain matches 12 existing users in org. Admin-user has 92% acceptance rate.",
  "riskFactors": [
    "Invitation sent on Friday afternoon (20% lower acceptance rate)"
  ],
  "recommendations": [
    "Resend Monday 09:00 for +15% acceptance rate",
    "Include personalized message from admin-user (+10% acceptance rate)"
  ],
  "estimatedAcceptanceTime": "within 4 hours"
}

// AI Follow-Up Automation
POST /api/ai/generate-invitation-followup
{
  "invitationId": "invite-12345",
  "daysSinceSent": 2
}

// AI Response
{
  "shouldFollowUp": true,
  "message": `Hi Sarah,

Just a friendly reminder about your invitation to join the HOLNG Project team. We're excited to have you collaborate with us!

Your invitation link expires in 46 hours. Click here to accept: [magic link]

If you have any questions, feel free to reach out to John (who invited you) or reply to this email.

Looking forward to working with you!`,
  "sendTime": "2025-11-27T09:00:00Z",
  "channel": "email"
}

// AI Invitation Analytics
POST /api/ai/analyze-invitation-trends
{
  "organizationId": "org-123",
  "period": "last_6_months"
}

// AI Response
{
  "acceptanceRate": 0.84,
  "avgAcceptanceTime": "6.2 hours",
  "trends": {
    "bestSendTime": "Monday 09:00 - 11:00",
    "worstSendTime": "Friday 16:00 - 18:00",
    "personalizedMessageImpact": "+12% acceptance rate"
  },
  "recommendations": [
    "Add mandatory welcome message field to invitation form",
    "Schedule bulk invitations for Monday mornings",
    "Auto-expire tokens after 48 hours (current avg acceptance: 6.2h)"
  ]
}
```

**Data Prerequisites (Implement Now)**:
- ✅ UserInvitation table with status tracking
- ✅ Invitation timestamps (sent, accepted, expired)
- ⚠️ **Add**: Invitation send time optimization metadata
- ⚠️ **Add**: Follow-up reminder history
- ⚠️ **Add**: Acceptance time tracking per invitation
- ⚠️ **Add**: Invitation message content (for personalization analysis)
- ⚠️ **Add**: Email domain correlation (company vs personal email)

---

### 14. AI-Powered Pre-Flight Review Intelligence

**Scenario**: Before syncing changes to PEMS, AI predicts the impact, assesses risk, and suggests whether the change should proceed, be modified, or be reverted.

**AI Capability**:
```typescript
// AI Pre-Flight Impact Prediction
POST /api/ai/predict-sync-impact
{
  "changes": [
    { "id": "pfa-1", "forecastStart": "2025-02-01", "forecastEnd": "2025-03-15" },
    { "id": "pfa-2", "monthlyRate": 7500 }
  ],
  "organizationId": "org-123"
}

// AI Response
{
  "impactSummary": {
    "budgetImpact": "+$12,500 (+3.2%)",
    "affectedCategories": ["Cranes", "Hoists"],
    "recordCount": 2,
    "riskScore": 0.42
  },
  "predictions": [
    {
      "recordId": "pfa-1",
      "prediction": "Forecast extension will cause budget overrun in Cranes category",
      "confidence": 0.87,
      "reasoning": "Cranes category already at 94% of budget. 6-week extension adds $15K."
    },
    {
      "recordId": "pfa-2",
      "prediction": "Rate increase is within market range",
      "confidence": 0.91,
      "reasoning": "New rate ($7,500) is 8% below market average for 50T cranes ($8,150)"
    }
  ],
  "recommendations": [
    {
      "action": "PROCEED_WITH_CAUTION",
      "message": "Budget impact is moderate. Consider reallocating from under-budget categories.",
      "alternatives": [
        "Reduce pfa-1 duration by 1 week to offset cost",
        "Negotiate bulk discount with crane vendor"
      ]
    }
  ],
  "rollbackNecessityPrediction": 0.08
}

// AI Risk Scoring
POST /api/ai/score-sync-risk
{
  "batchId": "batch-12345",
  "changeCount": 50
}

// AI Response
{
  "riskScore": 0.68,
  "riskLevel": "MEDIUM",
  "riskFactors": [
    { "factor": "Bulk change (50 records)", "contribution": 0.25 },
    { "factor": "Affects financial fields", "contribution": 0.30 },
    { "factor": "No pre-flight review comment provided", "contribution": 0.13 }
  ],
  "recommendations": [
    "Require mandatory comment (min 20 chars) for bulk changes",
    "Split batch into smaller chunks (10 records/batch)",
    "Review financial impact with PM before syncing"
  ]
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Pre-flight review modal with impact calculation
- ✅ Batch transaction support (batchId)
- ⚠️ **Add**: Historical sync success/failure rates per change type
- ⚠️ **Add**: Budget tracking per category per organization
- ⚠️ **Add**: Market rate database (for rate change validation)
- ⚠️ **Add**: Rollback history (learn which changes get reverted)
- ⚠️ **Add**: Risk factor weighting configuration

---

### 15. AI-Assisted Soft Delete & Recovery

**Scenario**: AI recommends which deleted items should be permanently deleted vs. recovered, and predicts the likelihood of accidental deletion.

**AI Capability**:
```typescript
// AI Accidental Deletion Detection
AI monitors:
- Deletion patterns (bulk delete = higher risk)
- Time since deletion (recovered within 1 hour = likely accident)
- User behavior (user who never deletes suddenly deletes 50 items)
- Deletion context (deleted during bulk operation vs. individual action)

// AI Alert
{
  "alertType": "SUSPECTED_ACCIDENTAL_DELETION",
  "userId": "user-123",
  "pattern": "User deleted 50 PFA records in 2 seconds",
  "risk": "HIGH",
  "details": {
    "recordCount": 50,
    "deletionMethod": "bulk_operation",
    "userDeletionHistory": "3 deletions in past 6 months",
    "avgDeletionCount": 0.5
  },
  "reasoning": "User typically deletes <1 record/month. Bulk deletion of 50 records is 100x normal behavior.",
  "suggestedAction": "Notify user immediately with Undo option",
  "autoRecoverRecommendation": "DO_NOT_AUTO_RECOVER (requires user confirmation)"
}

// AI Recovery Recommendation
POST /api/ai/recommend-recovery
{
  "trashCanItems": [
    { "id": "pfa-1", "deletedAt": "2025-11-26T10:00:00Z", "deletedBy": "user-123" },
    { "id": "pfa-2", "deletedAt": "2025-10-15T14:30:00Z", "deletedBy": "user-456" }
  ]
}

// AI Response
{
  "recommendations": [
    {
      "recordId": "pfa-1",
      "action": "RECOVER",
      "confidence": 0.91,
      "reasoning": "Deleted 16 days ago but user searched for this record 3 times since deletion. Likely accidental.",
      "urgency": "HIGH"
    },
    {
      "recordId": "pfa-2",
      "action": "PERMANENT_DELETE",
      "confidence": 0.87,
      "reasoning": "Deleted 42 days ago. No access attempts since deletion. Equipment procurement was cancelled.",
      "urgency": "LOW"
    }
  ]
}

// AI Permanent Delete Warning
POST /api/ai/assess-permanent-delete-impact
{
  "recordIds": ["pfa-1", "pfa-2", "pfa-3"]
}

// AI Response
{
  "canSafelyDelete": false,
  "warnings": [
    {
      "recordId": "pfa-1",
      "warning": "Record is referenced in 3 audit log entries",
      "severity": "MEDIUM",
      "impact": "Audit trail will have missing record references"
    },
    {
      "recordId": "pfa-2",
      "warning": "Record was synced to PEMS (requires PEMS delete)",
      "severity": "HIGH",
      "impact": "PEMS data will be inconsistent if not deleted there too"
    }
  ],
  "recommendations": [
    "Archive audit log references before permanent delete",
    "Submit PEMS delete request before permanent delete"
  ],
  "estimatedCleanupTime": "5 minutes"
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Soft delete fields (deletedAt, deletedBy)
- ✅ Prisma middleware for automatic filtering
- ⚠️ **Add**: Deletion context tracking (bulk vs. individual)
- ⚠️ **Add**: User deletion history (frequency, patterns)
- ⚠️ **Add**: Recovery action tracking (which items get recovered)
- ⚠️ **Add**: Search query log (did user search for deleted item?)
- ⚠️ **Add**: Dependency graph (what references this record?)
- ⚠️ **Add**: PEMS sync status per record (synced vs. local-only)

---

## 🎨 UX & Quality of Life Enhancements (Use Cases 16-20)

### 16. Context-Aware Access Explanation ("The Why Button")

**Scenario**: User hovers over a disabled button (e.g., "Sync Data" is grayed out). AI explains *why* they can't perform the action and suggests how to resolve it.

**AI Capability**:
```typescript
// When user hovers over disabled sync button
POST /api/ai/explain-permission-denial
{
  "userId": "user-123",
  "organizationId": "org-456",
  "action": "pems:sync",
  "context": {
    "component": "sync_button",
    "timestamp": "2025-11-26T14:30:00Z"
  }
}

// AI Response
{
  "explanation": "You cannot sync because your 'Field Engineer' role restricts PEMS commits, and this Organization is currently in 'Suspended' status due to a billing hold.",
  "permissionChain": [
    {
      "check": "User has pems:sync capability",
      "result": false,
      "reason": "Field Engineer role does not include pems:sync"
    },
    {
      "check": "Organization status is active",
      "result": false,
      "reason": "Organization suspended on 2025-11-20 by admin@example.com"
    }
  ],
  "resolveActions": [
    {
      "action": "Request role upgrade to 'Project Manager'",
      "contact": "Your org admin (admin@example.com)",
      "eta": "Typically resolved within 1 business day"
    },
    {
      "action": "Ask admin to reactivate Organization",
      "contact": "Contact billing department",
      "blockedUntil": "Billing hold resolved"
    }
  ],
  "confidence": 0.96,
  "tone": "helpful"
}
```

**UI Integration**:
```tsx
// Tooltip on disabled button
<Tooltip
  content={
    <div>
      <p>{aiExplanation.explanation}</p>
      <ul>
        {aiExplanation.resolveActions.map(action => (
          <li key={action.action}>
            <strong>{action.action}</strong>
            <br />
            {action.contact}
          </li>
        ))}
      </ul>
    </div>
  }
>
  <Button disabled>Sync Data</Button>
</Tooltip>
```

**Data Prerequisites (Implement Now)**:
- ✅ User roles and capabilities (already in UserOrganization)
- ✅ Organization service status (serviceStatus field)
- ⚠️ **Add**: UI interaction log (which buttons users click/hover)
- ⚠️ **Add**: Permission check history (track WHY checks fail)
- ⚠️ **Add**: Escalation request tracking (user requested access, pending approval)
- ⚠️ **Add**: Context metadata (which page/component triggered the check)

---

### 17. Predictive "Ghost" Values (Financial Masking with AI)

**Scenario**: User with `viewFinancialDetails: false` sees relative impact indicators instead of actual costs. AI shows "High Budget Impact" without revealing $450,000.

**AI Capability**:
```typescript
// AI translates absolute financial data into relative indicators
POST /api/ai/translate-financial-data
{
  "userId": "user-123",
  "organizationId": "org-456",
  "records": [
    { "id": "pfa-1", "cost": 450000, "category": "Cranes" },
    { "id": "pfa-2", "cost": 12000, "category": "Generators" }
  ],
  "userCapabilities": {
    "viewFinancialDetails": false
  }
}

// AI Response (masked data with relative indicators)
{
  "maskedRecords": [
    {
      "id": "pfa-1",
      "cost": "***masked***",
      "impactLevel": "HIGH",
      "impactDescription": "Top 5% of equipment costs in this category",
      "relativeComparison": "3.2x higher than average crane rental",
      "budgetImpactBadge": "⚠️ High Budget Impact",
      "aiInsight": "This equipment is significantly more expensive than typical cranes. Consider reviewing rental duration or exploring alternatives."
    },
    {
      "id": "pfa-2",
      "cost": "***masked***",
      "impactLevel": "LOW",
      "impactDescription": "Within expected range for generators",
      "relativeComparison": "0.9x average generator cost",
      "budgetImpactBadge": "✅ Within Budget",
      "aiInsight": "This cost is typical for this equipment type."
    }
  ],
  "portfolioInsight": "Your selection includes 1 high-impact item. Total relative cost is 2.1x the project average.",
  "confidence": 0.94
}
```

**UI Integration**:
```tsx
// Timeline bar shows impact badge instead of cost
<TimelineBar>
  <div className="equipment-card">
    <h3>Crane - Mobile 200T</h3>
    <Badge variant="warning">⚠️ High Budget Impact</Badge>
    <p>Top 5% of equipment costs in this category</p>
    <Tooltip content="This equipment is significantly more expensive than typical cranes">
      <InfoIcon />
    </Tooltip>
  </div>
</TimelineBar>
```

**Data Prerequisites (Implement Now)**:
- ✅ Cost fields (monthlyRate, purchasePrice, actualCost)
- ✅ Category-level aggregates (for percentile calculation)
- ⚠️ **Add**: Historical cost baselines per category (average, median, P90, P95)
- ⚠️ **Add**: Organization budget tier (small/medium/large project for normalization)
- ⚠️ **Add**: Equipment complexity score (simple generator vs. specialized crane)
- ⚠️ **Add**: User viewing history (track which masked records users interact with)

---

### 18. Semantic Audit Search ("Forensic Chat")

**Scenario**: User asks "Who changed the crane rental duration in the last week?" instead of writing complex SQL queries. AI translates natural language into audit log queries.

**AI Capability**:
```typescript
// Natural language audit query
POST /api/ai/semantic-audit-search
{
  "query": "Who changed the crane rental duration in the last week?",
  "userId": "user-123",
  "organizationId": "org-456"
}

// AI translates to structured query
{
  "parsedQuery": {
    "filters": {
      "resourceType": "PfaRecord",
      "changedFields": ["forecastStart", "forecastEnd", "actualEnd"],
      "category": ["Cranes"],
      "timeRange": {
        "start": "2025-11-19T00:00:00Z",
        "end": "2025-11-26T23:59:59Z"
      }
    },
    "groupBy": "userId",
    "orderBy": "createdAt DESC"
  },
  "results": [
    {
      "userId": "user-789",
      "userName": "John Doe",
      "changeCount": 12,
      "affectedRecords": ["pfa-101", "pfa-102", ...],
      "changesBreakdown": [
        {
          "recordId": "pfa-101",
          "recordDescription": "Crane - Mobile 200T (Silo 4)",
          "change": "Extended rental by 14 days (2025-12-01 → 2025-12-15)",
          "reason": "Weather delay - concrete curing",
          "timestamp": "2025-11-25T10:30:00Z"
        }
      ]
    }
  ],
  "naturalLanguageSummary": "John Doe extended 12 crane rentals by an average of 10 days in the last week. Most common reason: 'Weather delay'.",
  "confidence": 0.92
}

// Follow-up question
POST /api/ai/semantic-audit-search
{
  "query": "Why did John extend the cranes?",
  "context": "previous_query_id_abc123", // AI remembers previous conversation
  "userId": "user-123",
  "organizationId": "org-456"
}

// AI Response with deeper analysis
{
  "reasoning": [
    "11 out of 12 crane extensions cited 'Weather delay' as the reason",
    "Weather API confirms heavy rain in project location Nov 20-24",
    "Project timeline shows concrete pour scheduled for Nov 22 (postponed)",
    "Cost impact: +$145K in extended crane rentals"
  ],
  "relatedEvents": [
    "Organization posted weather alert on Nov 20",
    "Project Manager sent email: 'Delay concrete pour to Nov 29'",
    "5 other equipment types also extended (scaffolding, generators)"
  ],
  "aiInsight": "The extensions appear justified. Weather caused a 7-day project delay affecting multiple equipment types. Consider filing weather claim with insurance.",
  "confidence": 0.89
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Comprehensive audit log (AuditLog table with changes JSON)
- ✅ User names and roles (for attribution)
- ⚠️ **Add**: Natural language query cache (store common queries)
- ⚠️ **Add**: Conversation context (multi-turn audit investigations)
- ⚠️ **Add**: External data integration (weather API, email archives, project schedules)
- ⚠️ **Add**: Query performance index (semantic search on audit log)

---

### 19. Role Drift Detection & Auto-Refactoring

**Scenario**: AI detects that 5 users with "Field Engineer" role all have identical custom capability overrides (canManageUsers: true). AI suggests creating a new "Senior Field Engineer" role template.

**AI Capability**:
```typescript
// AI analyzes role usage patterns
POST /api/ai/detect-role-drift
{
  "organizationId": "org-456"
}

// AI Response
{
  "driftDetected": true,
  "patterns": [
    {
      "baseRole": "Field Engineer",
      "driftType": "CONSISTENT_OVERRIDES",
      "affectedUsers": ["user-101", "user-102", "user-103", "user-104", "user-105"],
      "commonOverrides": {
        "canManageUsers": true,
        "canManageSettings": true,
        "viewFinancialDetails": true
      },
      "frequency": "5 out of 12 Field Engineers (42%)",
      "suggestedNewRole": {
        "name": "Senior Field Engineer",
        "inheritsFrom": "Field Engineer",
        "additionalCapabilities": ["canManageUsers", "canManageSettings", "viewFinancialDetails"],
        "description": "Field Engineer with team management and financial oversight",
        "estimatedCoverage": "42% of current Field Engineers"
      },
      "benefit": "Simplifies permission management, reduces custom overrides by 15 rules",
      "confidence": 0.91
    }
  ],
  "recommendations": [
    {
      "action": "Create 'Senior Field Engineer' role",
      "impact": "Migrate 5 users from 'Field Engineer + overrides' to new role",
      "effort": "5 minutes",
      "risk": "LOW"
    }
  ]
}

// Apply AI recommendation
POST /api/ai/apply-role-refactor
{
  "patternId": "pattern-abc123",
  "approve": true,
  "adminUserId": "admin-456"
}

// AI creates new role and migrates users
{
  "newRoleCreated": {
    "id": "role-789",
    "name": "Senior Field Engineer",
    "capabilities": ["..."]
  },
  "usersMigrated": 5,
  "overridesRemoved": 15,
  "auditLogEntries": ["audit-001", "audit-002", ...],
  "rollbackAvailable": true,
  "rollbackExpiresAt": "2025-12-03T14:30:00Z" // 7 days
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Role templates (base role definitions)
- ✅ User capability overrides (UserOrganization capabilities JSON)
- ⚠️ **Add**: Role usage analytics (which roles are most commonly customized)
- ⚠️ **Add**: Override frequency tracking (how many users have same override)
- ⚠️ **Add**: Role evolution history (track when new roles are created)
- ⚠️ **Add**: Permission complexity score (measure permission sprawl)

---

### 20. Behavioral "Quiet Mode" (AI-Powered Notification Timing)

**Scenario**: AI learns that User X never reads notifications between 8 AM - 12 PM (focused work time) but engages with notifications sent between 2 PM - 4 PM. AI automatically delays non-urgent notifications to optimal times.

**AI Capability**:
```typescript
// AI learns user attention patterns
POST /api/ai/learn-notification-preferences
{
  "userId": "user-123"
}

// AI analyzes historical notification engagement
{
  "engagementProfile": {
    "peakAttentionHours": ["14:00-16:00", "19:00-21:00"],
    "quietHours": ["08:00-12:00", "00:00-07:00"],
    "preferredChannels": {
      "urgent": "slack",
      "routine": "email",
      "fyi": "in_app"
    },
    "avgResponseTime": {
      "urgent": "15 minutes",
      "routine": "4 hours",
      "fyi": "2 days"
    },
    "notificationSaturation": {
      "current": 25,
      "optimalRange": "10-15 per day",
      "status": "OVERLOADED",
      "recommendation": "Reduce non-urgent notifications by 60%"
    }
  },
  "confidence": 0.88,
  "dataSince": "2025-08-01"
}

// Smart notification routing
POST /api/ai/route-notification
{
  "userId": "user-123",
  "notification": {
    "type": "permission_granted",
    "urgency": "routine",
    "content": "You now have write access to Organization HOLNG"
  },
  "timestamp": "2025-11-26T09:30:00Z" // During quiet hours
}

// AI Response
{
  "routingDecision": {
    "action": "DEFER",
    "deferUntil": "2025-11-26T14:00:00Z", // Peak attention time
    "channel": "in_app", // User prefers in-app for routine updates
    "reasoning": "User is in quiet hours (08:00-12:00). This is a routine notification. Defer to peak attention time (14:00).",
    "alternativeOption": {
      "action": "SEND_NOW_WITH_BADGE",
      "reasoning": "Send now but as a low-priority badge. User can acknowledge when ready."
    }
  },
  "confidence": 0.91
}

// Notification digest (batch low-priority notifications)
POST /api/ai/generate-notification-digest
{
  "userId": "user-123",
  "deferredNotifications": 12,
  "sendAt": "2025-11-26T14:00:00Z"
}

// AI generates a single digest notification
{
  "digest": {
    "title": "12 updates while you were focused",
    "summary": "3 permission changes, 5 sync completions, 4 new comments",
    "priorityItems": [
      {
        "notification": "You now have write access to HOLNG",
        "action": "View Details",
        "urgency": "routine"
      }
    ],
    "lowPriorityItems": [
      "PEMS sync completed for RIO (1,234 records updated)",
      "John Doe commented on PFA #4567",
      ...
    ]
  },
  "channel": "in_app",
  "confidence": 0.94
}
```

**Data Prerequisites (Implement Now)**:
- ✅ Notification delivery tracking (NotificationDelivery table)
- ✅ Engagement metrics (readAt, clickedAt, dismissedAt)
- ⚠️ **Add**: Hourly engagement heatmap (track attention by hour of day)
- ⚠️ **Add**: Channel preference learning (email vs. Slack vs. in-app)
- ⚠️ **Add**: Notification fatigue score (user receiving too many notifications)
- ⚠️ **Add**: User work mode detection (focused work vs. collaborative time)
- ⚠️ **Add**: Deferred notification queue (store notifications for optimal delivery)

---

## 💼 Executive BEO Intelligence (Use Cases 21-25)

### 21. Boardroom Voice Analyst (Conversational BI for Executives)

**Scenario**: A BEO executive (non-technical) asks: "Which projects are trending over budget and why?" AI provides a conversational, narrative response instead of a data table.

**AI Capability**:
```typescript
// Voice or text query from executive
POST /api/ai/beo-analytics
{
  "query": "Which projects are trending over budget and why?",
  "userId": "cfo-456", // BEO user
  "responseFormat": "conversational" // vs. "technical" or "data_table"
}

// AI Response (narrative format for executives)
{
  "narrative": "Three of your seven projects are trending over budget this quarter:\n\n1. **HOLNG** is $450K over budget (+12%). The primary driver is extended crane rentals due to weather delays in November. The project team extended 18 crane rentals by an average of 10 days each.\n\n2. **RIO Phase 2** is $280K over budget (+8%). This is driven by unplanned generator purchases. The original plan called for rentals, but the project switched to purchases mid-project due to long rental durations.\n\n3. **PEMS Global** is $95K over budget (+3%). This is within acceptable variance and primarily due to minor equipment substitutions.\n\nOverall portfolio variance: +$825K (+7.2%). The good news: BECH and SLO are under budget, partially offsetting the overruns.",

  "executiveSummary": {
    "portfolioVariance": "+$825K (+7.2%)",
    "projectsAtRisk": 3,
    "primaryDrivers": ["Weather delays", "Plan changes (rental → purchase)", "Equipment substitutions"],
    "actionRequired": true,
    "recommendedActions": [
      "Review weather claim potential for HOLNG",
      "Investigate RIO decision to purchase vs. rent (may have saved long-term costs)",
      "PEMS Global variance is acceptable, no action needed"
    ]
  },

  "detailedBreakdown": [
    {
      "organization": "HOLNG",
      "variance": "+$450K (+12%)",
      "status": "AT_RISK",
      "rootCause": "Weather delays extended crane rentals",
      "affectedEquipment": "18 cranes, 5 scaffolds, 3 generators",
      "timeline": "Nov 20-24 weather event caused 7-day project delay",
      "recommendation": "File weather claim with insurance. Estimated recovery: $300-400K."
    },
    {
      "organization": "RIO Phase 2",
      "variance": "+$280K (+8%)",
      "status": "MONITOR",
      "rootCause": "Switched from rental to purchase mid-project",
      "affectedEquipment": "12 generators (originally planned as rentals)",
      "timeline": "Decision made Oct 15 after rental duration exceeded break-even point",
      "recommendation": "This decision likely saved money long-term. Purchase prices are now assets. Consider depreciation benefits."
    }
  ],

  "voiceResponse": "You have three projects over budget: HOLNG at plus twelve percent, RIO Phase 2 at plus eight percent, and PEMS Global at plus three percent. The main issue is HOLNG, where weather delays forced crane rental extensions. I recommend filing a weather claim.",

  "confidence": 0.93,
  "dataAsOf": "2025-11-26T14:30:00Z"
}
```

**UI Integration (Voice Mode)**:
```tsx
// Executive clicks microphone button
<VoiceInterface>
  <button onClick={startVoiceRecording}>
    🎤 Ask a question
  </button>
</VoiceInterface>

// AI speaks response (text-to-speech)
<AudioPlayer>
  {aiResponse.voiceResponse}
</AudioPlayer>

// Also shows visual summary card
<ExecutiveDashboardCard>
  <h2>Portfolio Variance: +$825K (+7.2%)</h2>
  <p>{aiResponse.narrative}</p>
  <ul>
    {aiResponse.executiveSummary.recommendedActions.map(action => (
      <li key={action}>{action}</li>
    ))}
  </ul>
</ExecutiveDashboardCard>
```

**Data Prerequisites (Implement Now)**:
- ✅ Cost aggregates (plan, forecast, actual by organization)
- ✅ Organization health metrics (variance, trend direction)
- ⚠️ **Add**: Executive query history (learn what executives ask about)
- ⚠️ **Add**: Narrative template library (reusable narrative structures)
- ⚠️ **Add**: Voice-to-text integration (Google Speech-to-Text, Whisper)
- ⚠️ **Add**: Text-to-speech integration (ElevenLabs, Azure TTS)
- ⚠️ **Add**: Executive persona profiles (CFO vs. COO vs. VP prefers different details)

---

### 22. Narrative Variance Explanation (The "Story" of Budget Overruns)

**Scenario**: Instead of showing a table with "+$450K variance", AI writes a narrative that correlates financial data, audit logs, weather data, and user comments into a coherent story.

**AI Capability**:
```typescript
// Request narrative explanation for variance
POST /api/ai/explain-variance
{
  "organizationId": "org-HOLNG",
  "timeRange": {
    "start": "2025-11-01",
    "end": "2025-11-30"
  },
  "varianceType": "forecast_vs_plan"
}

// AI correlates multiple data sources to create narrative
{
  "narrative": {
    "title": "The November Weather Delay Story: How HOLNG went $450K over budget",

    "chapters": [
      {
        "chapter": 1,
        "title": "The Plan (Original Budget)",
        "content": "In August, HOLNG budgeted $3.8M for equipment. The plan called for 18 crane rentals with an average duration of 45 days each, scheduled to complete by December 1.",
        "evidence": [
          "18 PFA records with originalStart dates in Aug-Oct",
          "Total plan cost: $3.8M"
        ]
      },
      {
        "chapter": 2,
        "title": "The Weather Event (Nov 20-24)",
        "content": "On November 20, a major storm hit the project site. Weather API data shows 4 consecutive days of heavy rain (>2 inches/day). Project Manager John Doe posted an organization-wide alert: 'Delay concrete pour to Nov 29 due to weather.'",
        "evidence": [
          "Weather API: 4 days of heavy rain (Nov 20-24)",
          "Organization alert posted by john.doe@example.com on Nov 20",
          "Email archive: 'Delay concrete pour to Nov 29'"
        ],
        "impact": "Concrete pour postponed 7 days (Nov 22 → Nov 29)"
      },
      {
        "chapter": 3,
        "title": "The Cascading Equipment Extensions",
        "content": "Because the concrete pour was delayed, 18 cranes that were scheduled to finish on Nov 25 had to be extended. John Doe manually extended each crane rental by 10-14 days between Nov 21-25. Most audit log entries cite 'Weather delay - concrete curing' as the reason.",
        "evidence": [
          "Audit log: 18 PFA records modified by john.doe between Nov 21-25",
          "Most common reason field: 'Weather delay - concrete curing' (11 out of 18)",
          "Average extension: 12 days per crane"
        ],
        "financialImpact": "+$320K in crane rental extensions"
      },
      {
        "chapter": 4,
        "title": "The Ripple Effect",
        "content": "The concrete delay also affected scaffolding (5 units) and generators (3 units). These were extended to support the extended crane operations. Additionally, 2 new generator rentals were added because the extended timeline exceeded battery capacity.",
        "evidence": [
          "Audit log: 5 scaffold extensions, 3 generator extensions",
          "2 new generator PFA records created on Nov 23 (not in original plan)",
          "Comment by john.doe: 'Need backup power for extended crane ops'"
        ],
        "financialImpact": "+$130K (scaffolds + generators + new rentals)"
      },
      {
        "chapter": 5,
        "title": "The Outcome",
        "content": "Total variance: +$450K (+12% over plan). The extensions were justified and unavoidable due to weather. Insurance claim filed on Nov 26 for $380K recovery (weather clause in contract).",
        "evidence": [
          "Total forecast cost: $4.25M (plan was $3.8M)",
          "Variance: +$450K",
          "Insurance claim filed Nov 26 (claim #WX-2025-1126)"
        ],
        "resolution": "Claim expected to recover $300-400K. Net variance after recovery: ~$100K (+2.6%)"
      }
    ],

    "keyTakeaways": [
      "Weather event caused 7-day project delay",
      "18 cranes extended by average of 12 days ($320K)",
      "Ripple effect: scaffolds, generators, new rentals ($130K)",
      "Total variance: +$450K (+12%)",
      "Insurance claim filed: Expected $300-400K recovery"
    ],

    "visualizationUrl": "/api/ai/variance-timeline?orgId=org-HOLNG&month=2025-11",
    "confidence": 0.92
  }
}
```

**UI Integration**:
```tsx
// Display narrative as expandable chapters
<VarianceNarrativeView>
  <h1>{narrative.title}</h1>
  {narrative.chapters.map(chapter => (
    <Chapter key={chapter.chapter}>
      <h2>Chapter {chapter.chapter}: {chapter.title}</h2>
      <p>{chapter.content}</p>
      <details>
        <summary>Evidence ({chapter.evidence.length} items)</summary>
        <ul>
          {chapter.evidence.map(item => <li>{item}</li>)}
        </ul>
      </details>
      {chapter.financialImpact && (
        <Badge variant="warning">{chapter.financialImpact}</Badge>
      )}
    </Chapter>
  ))}
  <Summary>
    <h2>Key Takeaways</h2>
    <ul>
      {narrative.keyTakeaways.map(item => <li>{item}</li>)}
    </ul>
  </Summary>
</VarianceNarrativeView>
```

**Data Prerequisites (Implement Now)**:
- ✅ Financial data (plan, forecast, actual costs)
- ✅ Audit logs with reason fields
- ⚠️ **Add**: External data integrations (weather API, email archives, project schedules)
- ⚠️ **Add**: Event correlation engine (link weather events to equipment extensions)
- ⚠️ **Add**: Narrative template library (reusable story structures)
- ⚠️ **Add**: Insurance claim tracking (link claims to variances)
- ⚠️ **Add**: Timeline visualization API (generate charts from narrative)

---

### 23. Cross-Organization Asset Arbitrage (Idle Equipment Marketplace)

**Scenario**: Organization HOLNG has 3 cranes sitting idle for the next 30 days. Organization RIO needs 2 cranes urgently. AI detects this mismatch and suggests transferring equipment between organizations to save rental costs.

**AI Capability**:
```typescript
// AI scans portfolio for idle equipment
POST /api/ai/detect-asset-arbitrage-opportunities
{
  "portfolioOrganizations": ["org-HOLNG", "org-RIO", "org-BECH", "org-SLO"],
  "timeHorizon": "30_days"
}

// AI Response
{
  "opportunitiesDetected": 2,
  "opportunities": [
    {
      "type": "IDLE_ASSET_TRANSFER",
      "sourceOrg": "HOLNG",
      "targetOrg": "RIO",
      "equipment": {
        "type": "Crane - Mobile 200T",
        "count": 2,
        "idlePeriod": {
          "start": "2025-12-05",
          "end": "2025-12-28"
        },
        "location": "Site A (40 miles from RIO site)"
      },
      "demandMatch": {
        "rioNeed": "2 cranes for 21 days",
        "rioCurrentPlan": "Rent 2 cranes at $8,500/month each",
        "potentialSavings": "$11,900"
      },
      "transferCost": {
        "transport": "$2,400 (mobilization + demobilization)",
        "inspection": "$600 (pre-transfer inspection)",
        "insurance": "$400 (temporary coverage)",
        "total": "$3,400"
      },
      "netSavings": "$8,500 (71% savings vs. renting new cranes)",
      "feasibility": {
        "score": 0.88,
        "factors": [
          "Equipment is compatible (same specs)",
          "Transport distance is reasonable (40 miles)",
          "HOLNG has confirmed idle period (no plan changes)",
          "RIO site has capacity for this equipment type",
          "Insurance allows cross-org transfers"
        ],
        "risks": [
          "Weather may delay HOLNG completion (5% probability)",
          "Equipment condition unknown (inspection required)"
        ]
      },
      "recommendedAction": {
        "action": "PROPOSE_TRANSFER",
        "nextSteps": [
          "Contact HOLNG Project Manager (john.doe@example.com) to confirm idle period",
          "Schedule pre-transfer inspection with maintenance team",
          "Draft inter-organization equipment transfer agreement",
          "Submit approval request to both org admins"
        ],
        "approvalRequired": ["HOLNG admin", "RIO admin", "CFO (transfer value >$5K)"],
        "estimatedTimeToExecute": "5 business days"
      },
      "confidence": 0.88
    },
    {
      "type": "PURCHASE_VS_RENT_ARBITRAGE",
      "organization": "BECH",
      "equipment": {
        "type": "Generator - Diesel 500kW",
        "count": 4,
        "rentalDuration": "180 days"
      },
      "currentPlan": "Rent 4 generators at $3,200/month each for 6 months = $76,800",
      "alternativePlan": "Purchase 4 used generators at $12,000 each = $48,000",
      "netSavings": "$28,800 (37% savings)",
      "additionalBenefits": [
        "Assets retained after project (resale value ~$8,000 each)",
        "Can be transferred to future projects",
        "No rental availability risk"
      ],
      "feasibility": {
        "score": 0.82,
        "factors": [
          "Break-even point is 90 days (project is 180 days)",
          "Used equipment market has availability",
          "Maintenance costs are manageable (~$500/month total)",
          "Storage available at BECH site"
        ],
        "risks": [
          "Resale value may be lower than estimated",
          "Requires upfront capital ($48K)",
          "Maintenance responsibility shifts to project"
        ]
      },
      "recommendedAction": {
        "action": "EVALUATE_PURCHASE_OPTION",
        "nextSteps": [
          "Request quotes from 3 used equipment dealers",
          "Calculate total cost of ownership (purchase + maintenance + storage)",
          "Compare with rental cost over 180 days",
          "Submit financial analysis to CFO for approval"
        ],
        "approvalRequired": ["CFO (capital expenditure >$10K)"],
        "estimatedTimeToExecute": "10 business days"
      },
      "confidence": 0.82
    }
  ],
  "portfolioSavingsPotential": "$37,300 (3.2% portfolio cost reduction)"
}
```

**UI Integration (BEO Portfolio Dashboard)**:
```tsx
// Display arbitrage opportunities as actionable cards
<ArbitrageOpportunities>
  <h2>💡 Cost Optimization Opportunities</h2>
  <p>AI detected 2 opportunities to save $37,300 across your portfolio</p>

  {opportunities.map(opp => (
    <OpportunityCard key={opp.type}>
      <Badge variant="success">${opp.netSavings} potential savings</Badge>
      <h3>{opp.type}</h3>
      <p>{opp.demandMatch?.rioNeed || opp.currentPlan}</p>

      <FeasibilityScore score={opp.feasibility.score}>
        Feasibility: {(opp.feasibility.score * 100).toFixed(0)}%
      </FeasibilityScore>

      <details>
        <summary>View Details</summary>
        <ul>
          {opp.feasibility.factors.map(factor => (
            <li key={factor}>✅ {factor}</li>
          ))}
          {opp.feasibility.risks.map(risk => (
            <li key={risk}>⚠️ {risk}</li>
          ))}
        </ul>
      </details>

      <ActionButton onClick={() => initiateArbitrage(opp)}>
        {opp.recommendedAction.action}
      </ActionButton>
    </OpportunityCard>
  ))}
</ArbitrageOpportunities>
```

**Data Prerequisites (Implement Now)**:
- ✅ Equipment timeline data (forecastStart, forecastEnd, actualStart, actualEnd)
- ✅ Organization assignments (organizationId)
- ⚠️ **Add**: Equipment location tracking (site address, GPS coordinates)
- ⚠️ **Add**: Equipment specifications (weight, dimensions, power requirements)
- ⚠️ **Add**: Transport cost estimation (distance, equipment type)
- ⚠️ **Add**: Equipment condition tracking (inspection reports, maintenance history)
- ⚠️ **Add**: Insurance policy metadata (transfer restrictions, coverage limits)
- ⚠️ **Add**: Break-even calculation logic (rental vs. purchase decision model)
- ⚠️ **Add**: Equipment resale value estimates (depreciation curves)
- ⚠️ **Add**: Cross-org transfer approval workflow

---

### 24. Vendor Pricing Anomaly Detection ("The Watchdog")

**Scenario**: AI detects that Vendor A charges $8,500/month for a crane in Organization HOLNG but charged $12,000/month for the same crane model in Organization RIO last quarter. AI alerts the procurement team.

**AI Capability**:
```typescript
// AI scans for pricing inconsistencies across portfolio
POST /api/ai/detect-vendor-pricing-anomalies
{
  "portfolioOrganizations": ["org-HOLNG", "org-RIO", "org-BECH", "org-SLO"],
  "timeRange": {
    "start": "2025-08-01",
    "end": "2025-11-30"
  },
  "anomalyThreshold": 0.15 // Flag if price variance >15%
}

// AI Response
{
  "anomaliesDetected": 3,
  "anomalies": [
    {
      "anomalyType": "SAME_VENDOR_DIFFERENT_PRICE",
      "vendor": "ABC Equipment Rentals",
      "equipment": "Crane - Mobile 200T",
      "priceVariance": {
        "organization1": {
          "org": "HOLNG",
          "price": "$8,500/month",
          "contractDate": "2025-10-01",
          "pfaRecords": ["pfa-101", "pfa-102", "pfa-103"]
        },
        "organization2": {
          "org": "RIO",
          "price": "$12,000/month",
          "contractDate": "2025-09-15",
          "pfaRecords": ["pfa-501", "pfa-502"]
        },
        "variance": "+$3,500/month (+41%)",
        "annualizedImpact": "$42,000 if RIO had HOLNG pricing"
      },
      "possibleReasons": [
        "RIO contract was negotiated earlier (before volume discount)",
        "HOLNG negotiated better terms (larger order volume)",
        "Market rates declined between Sept and Oct",
        "Different contract terms (insurance, maintenance included)"
      ],
      "recommendedAction": {
        "action": "RENEGOTIATE_RIO_CONTRACT",
        "steps": [
          "Contact ABC Equipment Rentals with HOLNG pricing as reference",
          "Request price match or volume discount retroactive to Sept 15",
          "Negotiate Most Favored Customer clause for future rentals",
          "Consider consolidating all crane rentals under single contract"
        ],
        "estimatedSavings": "$28,000 (if retroactive to Sept 15)",
        "urgency": "MEDIUM",
        "approvalRequired": ["Procurement Manager", "CFO"]
      },
      "confidence": 0.89
    },
    {
      "anomalyType": "MARKET_RATE_DEVIATION",
      "vendor": "XYZ Generator Suppliers",
      "equipment": "Generator - Diesel 500kW",
      "priceVariance": {
        "yourPrice": "$4,200/month",
        "marketAverage": "$3,100/month",
        "marketRange": "$2,800 - $3,400/month",
        "deviation": "+35% above market average"
      },
      "marketData": {
        "source": "Industry benchmark data (Q4 2025)",
        "sampleSize": "47 generator rentals in same region",
        "confidence": 0.91
      },
      "possibleReasons": [
        "Long-term contract signed in 2024 (before market rates declined)",
        "Premium features (automatic transfer switch, remote monitoring)",
        "24/7 support contract included",
        "Fuel cost escalation clause"
      ],
      "recommendedAction": {
        "action": "EVALUATE_ALTERNATIVE_VENDORS",
        "steps": [
          "Request quotes from 3 alternative generator suppliers",
          "Compare total cost of ownership (rental + fuel + support)",
          "Negotiate early termination with XYZ if alternatives are better",
          "Consider purchasing used generators (break-even at 90 days)"
        ],
        "estimatedSavings": "$13,200 annually (if switched to market-rate vendor)",
        "urgency": "LOW",
        "approvalRequired": ["Procurement Manager"]
      },
      "confidence": 0.85
    },
    {
      "anomalyType": "SUDDEN_PRICE_INCREASE",
      "vendor": "LMN Scaffold Rentals",
      "equipment": "Scaffold System - Modular",
      "priceVariance": {
        "previousPrice": "$1,800/month (contracts before Oct 2025)",
        "currentPrice": "$2,500/month (contracts after Oct 2025)",
        "increase": "+$700/month (+39%)",
        "effectiveDate": "2025-10-15"
      },
      "impactedOrganizations": ["HOLNG", "BECH"],
      "affectedContracts": 8,
      "annualizedImpact": "$67,200 if all contracts renewed at new rate",
      "possibleReasons": [
        "Vendor experienced cost increase (materials, labor)",
        "Industry-wide price increase (steel costs up 15% in Q4)",
        "Vendor testing new pricing (price discovery)",
        "Contract terms changed (shorter notice period, added insurance)"
      ],
      "recommendedAction": {
        "action": "NEGOTIATE_PRICE_FREEZE",
        "steps": [
          "Contact LMN Scaffold Rentals immediately",
          "Reference long-term partnership (3+ years)",
          "Negotiate price freeze at $1,800/month for existing contracts",
          "Request Most Favored Customer clause (match lowest rate offered)",
          "If unsuccessful, evaluate switching to alternative scaffold suppliers"
        ],
        "estimatedSavings": "$56,000 (if price frozen at $1,800)",
        "urgency": "HIGH",
        "approvalRequired": ["Procurement Manager", "VP Operations"]
      },
      "confidence": 0.93
    }
  ],
  "portfolioImpact": {
    "totalPotentialSavings": "$97,200 annually",
    "percentageOfEquipmentBudget": "2.4%",
    "recommendation": "Implement vendor pricing monitoring dashboard. Review quarterly."
  }
}
```

**UI Integration (BEO Watchdog Dashboard)**:
```tsx
// Display pricing anomalies with urgency indicators
<VendorWatchdogDashboard>
  <h2>🔍 Vendor Pricing Watchdog</h2>
  <p>AI detected 3 pricing anomalies with $97,200 savings potential</p>

  <AnomalyList>
    {anomalies.map(anomaly => (
      <AnomalyCard key={anomaly.vendor} urgency={anomaly.recommendedAction.urgency}>
        <UrgencyBadge level={anomaly.recommendedAction.urgency} />
        <h3>{anomaly.anomalyType}</h3>
        <p><strong>Vendor:</strong> {anomaly.vendor}</p>
        <p><strong>Equipment:</strong> {anomaly.equipment}</p>
        <p><strong>Savings Potential:</strong> {anomaly.recommendedAction.estimatedSavings}</p>

        <PriceComparison>
          <div>Your Price: {anomaly.priceVariance.yourPrice || anomaly.priceVariance.organization1.price}</div>
          <div>Market Rate: {anomaly.priceVariance.marketAverage || anomaly.priceVariance.organization2.price}</div>
          <div className="variance">{anomaly.priceVariance.variance}</div>
        </PriceComparison>

        <details>
          <summary>Recommended Action</summary>
          <ol>
            {anomaly.recommendedAction.steps.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>

        <ActionButton onClick={() => initiateRenegotiation(anomaly)}>
          {anomaly.recommendedAction.action}
        </ActionButton>
      </AnomalyCard>
    ))}
  </AnomalyList>
</VendorWatchdogDashboard>
```

**Data Prerequisites (Implement Now)**:
- ✅ Equipment costs (monthlyRate, purchasePrice)
- ✅ Vendor information (vendor name, contract date)
- ⚠️ **Add**: Vendor master data table (vendor ID, contact info, payment terms)
- ⚠️ **Add**: Contract terms tracking (start date, end date, escalation clauses)
- ⚠️ **Add**: Market rate benchmarks (industry data, region-specific pricing)
- ⚠️ **Add**: Volume discount tracking (price tiers based on order volume)
- ⚠️ **Add**: Price history (track price changes over time)
- ⚠️ **Add**: Negotiation history (who negotiated, what terms were agreed)
- ⚠️ **Add**: Most Favored Customer clauses (contractual price matching)

---

### 25. Strategic "Multiverse" Simulator (What-If Scenario Planning)

**Scenario**: CFO wants to explore "What if we delay HOLNG start by 30 days?" or "What if we switch all generators from rental to purchase?" AI creates sandbox scenarios without affecting production data.

**AI Capability**:
```typescript
// Create a "multiverse" scenario
POST /api/ai/create-scenario
{
  "baseScenario": "CURRENT_FORECAST",
  "scenarioName": "Delay HOLNG by 30 days",
  "userId": "cfo-456",
  "modifications": [
    {
      "type": "SHIFT_TIMELINE",
      "filter": {
        "organizationId": "org-HOLNG"
      },
      "action": {
        "shiftDays": 30,
        "applyTo": ["forecastStart", "forecastEnd"]
      }
    }
  ]
}

// AI Response (scenario created)
{
  "scenarioId": "scenario-abc123",
  "scenarioName": "Delay HOLNG by 30 days",
  "status": "READY",
  "impactAnalysis": {
    "recordsAffected": 145,
    "costImpact": "+$78,000",
    "costBreakdown": [
      {
        "reason": "Extended crane rentals (30 extra days)",
        "impact": "+$51,000"
      },
      {
        "reason": "Extended scaffolding rentals",
        "impact": "+$18,000"
      },
      {
        "reason": "Extended generator rentals",
        "impact": "+$9,000"
      }
    ],
    "scheduleImpact": {
      "newCompletionDate": "2026-01-15",
      "originalCompletionDate": "2025-12-15",
      "delay": "31 days"
    },
    "riskFactors": [
      "Delay pushes project into winter weather season (higher risk)",
      "Vendor availability may be limited in January (peak season)",
      "Equipment insurance rates increase 10% after Jan 1"
    ],
    "opportunities": [
      "More time to negotiate better vendor terms",
      "Can consolidate orders with other projects for volume discount",
      "Avoid holiday shutdown period (Dec 20-Jan 2)"
    ]
  },
  "aiRecommendation": {
    "verdict": "NOT_RECOMMENDED",
    "reasoning": "The $78K cost increase outweighs the benefits. Additionally, pushing into January introduces higher weather risk and 10% insurance rate increase. Consider alternative: Start on time but phase equipment delivery to reduce upfront costs.",
    "alternativeScenarios": [
      {
        "name": "Phased Equipment Delivery",
        "estimatedSavings": "$45K",
        "risk": "LOW"
      },
      {
        "name": "Negotiate Early Payment Discount",
        "estimatedSavings": "$22K",
        "risk": "LOW"
      }
    ],
    "confidence": 0.87
  },
  "compareUrl": "/api/scenarios/compare?base=current&scenario=scenario-abc123",
  "exportUrl": "/api/scenarios/export?id=scenario-abc123"
}

// Compare multiple scenarios side-by-side
POST /api/ai/compare-scenarios
{
  "scenarios": [
    "CURRENT_FORECAST",
    "scenario-abc123", // Delay HOLNG by 30 days
    "scenario-xyz789"  // Switch all generators to purchase
  ]
}

// AI Response (side-by-side comparison)
{
  "comparisonTable": {
    "headers": ["Metric", "Current Forecast", "Delay HOLNG +30d", "Generators → Purchase"],
    "rows": [
      {
        "metric": "Total Portfolio Cost",
        "current": "$12.5M",
        "scenario1": "$12.578M (+$78K)",
        "scenario2": "$12.2M (-$300K)"
      },
      {
        "metric": "Project Completion Date",
        "current": "2025-12-15",
        "scenario1": "2026-01-15 (+31 days)",
        "scenario2": "2025-12-15 (no change)"
      },
      {
        "metric": "Portfolio Risk Score",
        "current": "0.68 (MEDIUM)",
        "scenario1": "0.78 (MEDIUM-HIGH)",
        "scenario2": "0.62 (MEDIUM-LOW)"
      },
      {
        "metric": "Cash Flow Impact",
        "current": "$2.1M/month",
        "scenario1": "$2.1M/month (no change)",
        "scenario2": "$2.5M upfront, then $1.8M/month"
      }
    ]
  },
  "aiRecommendation": {
    "bestScenario": "scenario-xyz789",
    "reasoning": "Switching generators to purchase saves $300K and reduces risk. The upfront capital investment ($400K) pays back in 4 months and provides long-term assets.",
    "actionPlan": [
      "Request CFO approval for $400K capital expenditure",
      "Solicit quotes from 3 used equipment dealers",
      "Finalize decision by Dec 1 to capture Q4 budget",
      "Begin phased equipment purchases in Q1 2026"
    ],
    "confidence": 0.91
  },
  "visualizationUrl": "/api/scenarios/visualize?scenarios=all"
}

// AI-Generated "What If" Suggestions
POST /api/ai/suggest-scenarios
{
  "organizationId": "org-HOLNG",
  "goal": "REDUCE_COST" // or "ACCELERATE_SCHEDULE", "REDUCE_RISK"
}

// AI Response (proactive scenario suggestions)
{
  "suggestedScenarios": [
    {
      "name": "Consolidate Crane Vendors",
      "description": "Switch all crane rentals to single vendor (ABC Equipment) for volume discount",
      "estimatedSavings": "$95,000",
      "feasibility": 0.88,
      "risk": "LOW",
      "timeToImplement": "30 days"
    },
    {
      "name": "Substitute Specialized Cranes with Standard Models",
      "description": "Replace 3 specialized 200T cranes with 5 standard 150T cranes",
      "estimatedSavings": "$62,000",
      "feasibility": 0.72,
      "risk": "MEDIUM",
      "tradeoff": "Requires 2 extra cranes but total cost is lower"
    },
    {
      "name": "Shift Non-Critical Equipment to Off-Peak Months",
      "description": "Delay scaffolding and generator rentals to Feb-Mar (off-peak pricing)",
      "estimatedSavings": "$38,000",
      "feasibility": 0.65,
      "risk": "MEDIUM",
      "tradeoff": "Delays project by 14 days"
    }
  ]
}
```

**UI Integration (Executive Scenario Planning Dashboard)**:
```tsx
// Scenario creation wizard
<ScenarioWizard>
  <h2>Create What-If Scenario</h2>
  <StepIndicator currentStep={1} totalSteps={3} />

  <Step1>
    <label>Scenario Name</label>
    <input placeholder="e.g., Delay HOLNG by 30 days" />

    <label>Base Scenario</label>
    <select>
      <option>Current Forecast</option>
      <option>Current Plan</option>
      <option>Scenario: Q1 Accelerated</option>
    </select>
  </Step1>

  <Step2>
    <h3>Modifications</h3>
    <ModificationBuilder>
      <select name="modificationType">
        <option>Shift Timeline</option>
        <option>Change Equipment</option>
        <option>Change Vendor</option>
        <option>Switch Rental ↔ Purchase</option>
      </select>

      <FilterBuilder>
        <label>Apply to:</label>
        <select name="organization">
          <option>All Organizations</option>
          <option>HOLNG</option>
          <option>RIO</option>
        </select>
        <select name="category">
          <option>All Equipment</option>
          <option>Cranes</option>
          <option>Generators</option>
        </select>
      </FilterBuilder>

      <ActionBuilder>
        <label>Action:</label>
        <input type="number" name="shiftDays" placeholder="30" />
        <span>days</span>
      </ActionBuilder>
    </ModificationBuilder>
  </Step2>

  <Step3>
    <h3>AI Impact Analysis</h3>
    <ImpactPreview>
      <p><strong>Records Affected:</strong> {impactAnalysis.recordsAffected}</p>
      <p><strong>Cost Impact:</strong> <Badge variant={impactAnalysis.costImpact > 0 ? "warning" : "success"}>
        {impactAnalysis.costImpact > 0 ? "+" : ""}{formatCurrency(impactAnalysis.costImpact)}
      </Badge></p>
      <p><strong>AI Verdict:</strong> {aiRecommendation.verdict}</p>
      <p>{aiRecommendation.reasoning}</p>
    </ImpactPreview>

    <ActionButtons>
      <button onClick={createScenario}>Create Scenario</button>
      <button onClick={exportScenario}>Export to Excel</button>
    </ActionButtons>
  </Step3>
</ScenarioWizard>

// Scenario comparison matrix
<ScenarioComparisonMatrix>
  <h2>Compare Scenarios</h2>
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        {scenarios.map(s => <th key={s.id}>{s.name}</th>)}
      </tr>
    </thead>
    <tbody>
      {comparisonTable.rows.map(row => (
        <tr key={row.metric}>
          <td>{row.metric}</td>
          {Object.values(row).slice(1).map((value, i) => (
            <td key={i}>{value}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>

  <AIRecommendation>
    <h3>🤖 AI Recommendation</h3>
    <p><strong>Best Scenario:</strong> {aiRecommendation.bestScenario}</p>
    <p>{aiRecommendation.reasoning}</p>
    <ul>
      {aiRecommendation.actionPlan.map(step => <li key={step}>{step}</li>)}
    </ul>
  </AIRecommendation>
</ScenarioComparisonMatrix>
```

**Data Prerequisites (Implement Now)**:
- ✅ Complete PFA data model (all timeline and cost fields)
- ✅ Sandbox pattern (already implemented in App.tsx)
- ⚠️ **Add**: Scenario storage table (save/load scenarios)
- ⚠️ **Add**: Scenario metadata (created by, created at, description)
- ⚠️ **Add**: Modification log (track what changes were applied)
- ⚠️ **Add**: Scenario comparison API (diff engine for side-by-side)
- ⚠️ **Add**: Risk scoring model (calculate risk score for scenarios)
- ⚠️ **Add**: External data integration (weather forecasts, market rates)
- ⚠️ **Add**: Scenario export (Excel, PDF with charts)
- ⚠️ **Add**: Scenario sharing (share scenario URL with stakeholders)

---

## 📊 Data Prerequisites Summary

This section consolidates all data requirements needed to enable the 25 AI use cases defined above.

### Immediate Implementation (Before Phase 1 Complete):

1. **Comprehensive Audit Logging Infrastructure** ✅ (included in ADR-005-DECISION.md)
   ```typescript
   model AuditLog {
     id             String   @id @default(cuid())
     userId         String   // Who did it
     organizationId String? // Nullable for System-level actions
     action         String   // "pfa:update", "user:promote", "sync:force", "pat:usage"
     resourceId     String   // ID of affected resource
     resourceType   String   // "PfaRecord", "UserOrganization", "Organization"

     // THE EVIDENCE (for AI analysis and revert)
     changes        Json     // { "before": {...}, "after": {...} }
     reason         String?  // User's comment: "Weather delay extension"
     metadata       Json     // { "ip": "192.168.1.1", "userAgent": "Chrome..." }

     // BATCH GROUPING (allows reverting 50 records changed in one click)
     batchId        String?

     createdAt      DateTime @default(now())

     @@index([organizationId, createdAt])
     @@index([userId, createdAt])
     @@index([resourceType, resourceId])
     @@index([batchId])
     @@index([action])
   }
   ```

2. **Enhanced User Activity Tracking** (AI Use Cases 2, 4, 8, 12, 13)
   ```typescript
   model User {
     // ... existing fields
     lastActivityAt     DateTime?   // Updated on every API call (AI: inactivity detection)
     lastLoginAt        DateTime?   // Updated on login (AI: anomaly detection)
     lastOrganizationId String?     // Track last accessed org (AI: context switching patterns)
     lastLoginIp        String?     // IP address of last login (AI: geolocation anomalies)
     lastLoginUserAgent String?     // User agent string (AI: device fingerprinting)

     // AI Baselines (learned from behavior)
     accessPatternBaseline Json?    // { "avgRecordsPerDay": 150, "peakHours": [...] }
   }
   ```

3. **Temporary Permission Support** ✅ (AI Use Case 3)
   ```typescript
   model UserOrganization {
     // ... existing fields
     permissionExpiresAt DateTime?  // NULL = permanent, set = temporary
     grantedBy           String?    // Who granted these permissions
     grantedAt           DateTime?  // When granted
     escalationReason    String?    // Why escalated (for audit & AI learning)
   }
   ```

4. **Organization Health Metrics** (AI Use Case 4, 9)
   ```typescript
   model OrganizationHealth {
     id                 String   @id @default(cuid())
     organizationId     String   @unique
     lastSyncSuccess    DateTime?
     failedSyncCount    Int      @default(0)
     activeUserCount    Int      @default(0)
     costThisMonth      Float?
     budgetBaseline     Float?   // AI: variance calculation
     healthScore        Float?   // 0-1 score (AI-computed)
     lastCalculatedAt   DateTime @default(now())

     // BEO Analytics
     trendDirection     String?  // "worsening", "stable", "improving"
     riskFactors        Json?    // ["Weather delays", "Equipment shortages"]
   }
   ```

5. **Multi-Channel Notification Tracking** (AI Use Case 6)
   ```typescript
   model NotificationDelivery {
     id                 String   @id @default(cuid())
     notificationId     String
     userId             String
     channel            String   // "email", "slack", "teams", "in_app"
     status             String   // "sent", "delivered", "read", "clicked", "dismissed"
     sentAt             DateTime
     readAt             DateTime?
     clickedAt          DateTime?
     dismissedAt        DateTime?

     // AI Learning
     responseTime       Int?     // Milliseconds from send to read
     engagementScore    Float?   // 0-1 score (clicked = 1.0, dismissed = 0.0)

     @@index([userId, channel])
     @@index([status])
   }
   ```

6. **Personal Access Token Security Tracking** ✅ (AI Use Case 12)
   ```typescript
   model PersonalAccessToken {
     id             String   @id @default(cuid())
     userId         String
     name           String   // e.g., "PowerBI Connect"
     tokenHash      String   @unique // bcrypt hash
     scopes         Json     // ["read:pfa", "read:financials"]

     // AI Security Monitoring
     usagePattern   Json?    // { "avgRequestsPerDay": 47, "peakHours": [...] }
     lastUsedAt     DateTime?
     lastUsedIp     String?
     lastUsedLocation String? // Geolocation (city, country)
     usageCount     Int      @default(0)

     // Lifecycle
     expiresAt      DateTime?
     createdAt      DateTime @default(now())
     revokedAt      DateTime?
     revokedBy      String?
     revokedReason  String?  // "suspected_compromise", "expired", "user_request"

     user           User     @relation(fields: [userId], references: [id])

     @@index([userId])
     @@index([tokenHash])
     @@index([expiresAt, revokedAt])
   }
   ```

7. **Invitation Lifecycle Tracking** ✅ (AI Use Case 13)
   ```typescript
   model UserInvitation {
     id             String   @id @default(cuid())
     email          String
     organizationId String
     roleId         String
     invitedBy      String
     token          String   @unique // High-entropy string (64 chars)
     expiresAt      DateTime // 48 hour validity

     status         String   @default("pending") // "pending", "accepted", "expired", "declined"
     customPermissions Json?
     customCapabilities Json?

     // AI Optimization
     personalizedMessage String?  // Custom welcome message
     sendTime       DateTime      // When invitation was sent (AI: optimal time analysis)
     acceptedAt     DateTime?
     acceptanceTime Int?          // Minutes from send to accept (AI: prediction model)
     followUpCount  Int      @default(0) // How many reminders sent

     createdAt      DateTime @default(now())

     @@index([token])
     @@index([email, status])
     @@index([expiresAt])
     @@index([acceptedAt]) // AI: acceptance time analysis
   }
   ```

8. **Data Import Mapping History** (AI Use Case 10)
   ```typescript
   model DataSourceMapping {
     id                String   @id @default(cuid())
     organizationId    String
     sourceType        String   // "ESS", "Procurement", "CSV", "Excel"
     fileName          String?

     // Mapping Definition
     fieldMappings     Json     // [{ "source": "Item_Code", "target": "equipmentCode", ... }]
     transformations   Json?    // [{ "field": "Cost", "rule": "IF contains '/mo' THEN..." }]

     // AI Quality Tracking
     confidence        Float?   // 0-1 AI confidence score
     accuracy          Float?   // % of records imported successfully
     dataQualityScore  Float?   // 0-1 overall quality score
     sampleData        Json?    // First 10 rows for ML training

     // Usage
     timesUsed         Int      @default(0)
     lastUsedAt        DateTime?
     createdAt         DateTime @default(now())
     createdBy         String

     @@index([organizationId, sourceType])
     @@index([fileName])
   }
   ```

9. **Capability Usage Tracking** (AI Use Case 7)
   ```typescript
   model CapabilityUsage {
     id             String   @id @default(cuid())
     userId         String
     organizationId String
     capability     String   // "viewFinancialDetails", "exportWithFinancials", etc.

     // Usage Metrics
     usedAt         DateTime @default(now())
     frequency      Int      @default(1) // Increment on each use
     lastUsedAt     DateTime @default(now())

     // AI Pattern Learning
     typicalUsageContext Json? // { "timeOfDay": "09:00-12:00", "recordCount": 150 }

     @@index([userId, capability])
     @@index([organizationId, capability])
     @@index([usedAt])
   }
   ```

10. **Pre-Flight Review Tracking** (AI Use Case 14, 17)
    ```typescript
    model PreFlightReview {
      id                String   @id @default(cuid())
      batchId           String   @unique
      userId            String
      organizationId    String

      // Change Summary
      recordCount       Int
      budgetImpact      Float    // Dollar amount
      affectedCategories Json    // ["Cranes", "Hoists"]
      changeTypes       Json     // ["forecastStart", "monthlyRate"]

      // User Input
      userComment       String   // Mandatory justification
      userRiskAssessment String? // "low", "medium", "high"

      // AI Predictions
      aiRiskScore       Float?   // 0-1 AI-computed risk
      aiPredictedImpact Json?    // AI analysis of likely outcomes
      aiRecommendation  String?  // "PROCEED", "PROCEED_WITH_CAUTION", "REJECT"

      // Outcome
      proceeded         Boolean
      proceededAt       DateTime?
      revertedAt        DateTime? // Was this batch reverted later?
      revertReason      String?   // Why it was reverted (AI learning)

      createdAt         DateTime @default(now())

      @@index([batchId])
      @@index([userId, createdAt])
      @@index([organizationId, createdAt])
    }
    ```

11. **Soft Delete Recovery Tracking** (AI Use Case 15)
    ```typescript
    model RecoveryAction {
      id             String   @id @default(cuid())
      recordId       String   // PfaRecord.id or other soft-deleted entity
      recordType     String   // "PfaRecord", "User", "Organization"

      action         String   // "recover", "permanent_delete"
      actionBy       String   // User ID
      actionAt       DateTime @default(now())

      // AI Context
      daysInTrash    Int      // How long was it deleted before action
      aiRecommendation String? // "RECOVER", "PERMANENT_DELETE"
      aiConfidence   Float?   // AI confidence in recommendation

      // Search Context (AI: did user search for this after deleting?)
      searchedAfterDeletion Boolean @default(false)
      searchCount    Int      @default(0)

      @@index([recordId, recordType])
      @@index([actionBy, actionAt])
    }
    ```

---

## 🔌 API Requirements for AI Integration

### 1. Headless Permission Management API

**Purpose**: Allow AI to modify permissions without UI interaction.

```typescript
// Required Endpoints
POST   /api/permissions/grant-temporary    // AI grants temporary access
DELETE /api/permissions/revoke-temporary   // AI revokes expired access
POST   /api/permissions/bulk-audit         // AI audits multiple users/orgs
GET    /api/permissions/anomalies          // AI fetches anomaly data

// NEW: Capability Management (AI Use Case 7)
POST   /api/ai/suggest-role-capabilities   // AI suggests optimal capabilities
POST   /api/capabilities/bulk-grant        // AI applies capability recommendations
GET    /api/capabilities/usage-patterns    // AI analyzes capability usage

// NEW: Notification Routing (AI Use Case 6)
POST   /api/ai/route-notification          // AI determines optimal channels
POST   /api/ai/generate-digest             // AI creates notification digest
GET    /api/notifications/engagement       // AI analyzes engagement patterns

// NEW: BEO Analytics (AI Use Case 9)
POST   /api/ai/beo-analytics               // AI cross-org trend analysis
POST   /api/ai/beo-predict-quarter-end     // AI budget prediction
GET    /api/beo/portfolio-health           // AI portfolio metrics

// NEW: Data Import Intelligence (AI Use Case 10)
POST   /api/ai/analyze-import-file         // AI suggests field mappings
POST   /api/ai/learn-import-mapping        // AI learns from corrections
GET    /api/imports/quality-history        // AI tracks import success rates

// NEW: Audit Intelligence (AI Use Case 11)
POST   /api/ai/analyze-audit-trail         // AI compliance analysis
POST   /api/ai/suggest-revert              // AI recommends revert strategy
POST   /api/ai/generate-compliance-report  // AI executive summary

// NEW: PAT Security (AI Use Case 12)
POST   /api/ai/recommend-pat-scopes        // AI suggests minimal scopes
POST   /api/ai/suggest-token-expiration    // AI recommends expiry policy
GET    /api/pats/security-alerts           // AI detects compromised tokens

// NEW: Invitation Optimization (AI Use Case 13)
POST   /api/ai/predict-invitation-acceptance  // AI predicts acceptance
POST   /api/ai/generate-invitation-followup   // AI creates follow-up
POST   /api/ai/analyze-invitation-trends      // AI trends analysis

// NEW: Pre-Flight Intelligence (AI Use Case 14)
POST   /api/ai/predict-sync-impact         // AI impact prediction
POST   /api/ai/score-sync-risk             // AI risk scoring
GET    /api/pre-flight/historical-outcomes // AI learns from past syncs

// NEW: Soft Delete Intelligence (AI Use Case 15)
POST   /api/ai/recommend-recovery          // AI suggests recover vs delete
POST   /api/ai/assess-permanent-delete-impact // AI dependency analysis
GET    /api/trash/recovery-patterns        // AI learns recovery behaviors
```

**Granularity Needed**:
- Individual permission flags (canRead, canWrite, etc.)
- Capability-level overrides (granular control)
- Temporary expiry timestamps
- Bulk operations for efficiency
- Read-only query endpoints for AI analysis
- **NEW**: Notification channel preferences per user
- **NEW**: Real-time usage pattern data (latency < 100ms)
- **NEW**: Historical trend data (90-day rolling window)

---

### 2. AI Context Injection Points (Expanded)

**Purpose**: Allow AI to hook into decision points for real-time recommendations across all governance and enterprise features.

```typescript
// Middleware Hook Points (Extended)
export interface AiContextHook {
  // Original Hooks
  beforePermissionGrant: (userId, orgId, permissions) => AiRecommendation;
  beforeUserSuspend: (userId, reason) => AiRecommendation;
  beforeOrgSuspend: (orgId, reason) => AiRecommendation;
  onAnomalyDetected: (anomaly) => AiAction;

  // NEW: Notification Hooks (AI Use Case 6)
  beforeNotificationSend: (userId, notification) => AiRoutingDecision;
  onNotificationEngagement: (userId, notificationId, action) => void;

  // NEW: Capability Hooks (AI Use Case 7)
  beforeCapabilityGrant: (userId, capability) => AiSecurityWarning;
  onCapabilityUsed: (userId, capability, context) => void;

  // NEW: Financial Access Hooks (AI Use Case 8)
  beforeFinancialDataAccess: (userId, recordCount) => AiAccessDecision;
  onFinancialExport: (userId, recordCount, fields) => void;

  // NEW: Import Hooks (AI Use Case 10)
  beforeDataImport: (fileData) => AiMappingSuggestion;
  onImportComplete: (mappingUsed, successRate) => void;

  // NEW: Pre-Flight Hooks (AI Use Case 14)
  beforePemsSync: (changes) => AiImpactPrediction;
  onSyncComplete: (batchId, outcome) => void;

  // NEW: Soft Delete Hooks (AI Use Case 15)
  beforePermanentDelete: (recordId) => AiDependencyWarning;
  onRecovery: (recordId, daysInTrash) => void;

  // NEW: PAT Hooks (AI Use Case 12)
  beforePATCreation: (userId, scopes) => AiScopeRecommendation;
  onPATUsage: (tokenId, ip, requestRate) => void;

  // NEW: Invitation Hooks (AI Use Case 13)
  beforeInvitationSend: (email, orgId, roleId) => AiAcceptancePrediction;
  onInvitationAccepted: (invitationId, acceptanceTime) => void;
}

// Example Usage: Pre-Flight Review Hook
router.post('/api/pfa/sync', async (req, res) => {
  const changes = req.body.changes;

  // AI analyzes changes before syncing
  const aiPrediction = await aiContextHook.beforePemsSync(changes);

  if (aiPrediction.riskScore > 0.7) {
    return res.status(400).json({
      error: 'HIGH_RISK_CHANGES',
      message: aiPrediction.reasoning,
      recommendation: aiPrediction.alternatives
    });
  }

  // Proceed with sync...
  const result = await syncToPems(changes);

  // Learn from outcome
  await aiContextHook.onSyncComplete(result.batchId, result.outcome);

  res.json(result);
});

// Example Usage: Notification Routing Hook
router.post('/api/notifications/send', async (req, res) => {
  const { userId, notification } = req.body;

  // AI determines optimal delivery channels
  const routing = await aiContextHook.beforeNotificationSend(userId, notification);

  // Apply AI recommendation
  if (routing.recommendedChannels.includes('slack')) {
    await sendSlackNotification(userId, notification);
  }
  if (routing.recommendedChannels.includes('email')) {
    if (routing.deliveryStrategy.email.digest) {
      await addToDigestQueue(userId, notification);
    } else {
      await sendEmailNotification(userId, notification);
    }
  }

  res.json({ success: true, routing });
});

// Example Usage: Financial Access Hook
router.get('/api/pfa/records', async (req, res) => {
  const { userId, includeFinancials } = req.query;

  if (includeFinancials) {
    const records = await prisma.pfaRecord.findMany(...);

    // AI monitors financial data access
    const accessDecision = await aiContextHook.beforeFinancialDataAccess(
      userId,
      records.length
    );

    if (accessDecision.risk === 'CRITICAL') {
      // Suspend user and notify admin
      await suspendUser(userId, 'Suspected data exfiltration');
      await notifySecurityTeam(accessDecision);

      return res.status(403).json({ error: 'ACCESS_DENIED' });
    }
  }

  // Proceed with data access...
});
```

---

### 3. Event Streaming for AI Training (Expanded)

**Purpose**: Stream all access control and governance events to AI for comprehensive pattern learning.

```typescript
// Event Stream Structure (Extended)
interface AccessControlEvent {
  timestamp: string;
  eventType:
    // Original Events
    | 'permission_granted' | 'user_suspended' | 'org_accessed' | 'login'
    // NEW: Governance Events
    | 'notification_sent' | 'notification_read' | 'notification_dismissed'
    | 'capability_granted' | 'capability_used' | 'capability_revoked'
    | 'financial_data_accessed' | 'financial_export'
    | 'data_imported' | 'import_mapping_learned'
    | 'pems_sync_started' | 'pems_sync_completed' | 'sync_reverted'
    | 'pat_created' | 'pat_used' | 'pat_revoked'
    | 'invitation_sent' | 'invitation_accepted' | 'invitation_expired'
    | 'pre_flight_reviewed' | 'pre_flight_approved' | 'pre_flight_rejected'
    | 'soft_delete' | 'record_recovered' | 'permanent_delete';

  userId?: string;
  organizationId?: string;

  // Extended Metadata
  metadata: {
    // Common Fields
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;

    // Event-Specific Fields
    notificationChannel?: string;    // for notification events
    capability?: string;              // for capability events
    recordCount?: number;             // for data access/import events
    financialFieldsAccessed?: string[]; // for financial events
    batchId?: string;                 // for sync events
    tokenId?: string;                 // for PAT events
    invitationId?: string;            // for invitation events
    aiPrediction?: {                  // AI recommendation attached
      riskScore: number;
      confidence: number;
      reasoning: string;
    };
  };
}

// Example: WebSocket or SSE endpoint
GET /api/ai/event-stream?eventTypes=financial_data_accessed,pems_sync_started

// Real-Time Event Bus
const eventBus = new EventEmitter();

// Emit events throughout the application
eventBus.emit('access_control_event', {
  timestamp: new Date().toISOString(),
  eventType: 'financial_data_accessed',
  userId: 'user-123',
  organizationId: 'org-456',
  metadata: {
    recordCount: 5000,
    financialFieldsAccessed: ['cost', 'monthlyRate', 'purchasePrice'],
    ipAddress: '203.0.113.45',
    userAgent: 'Python-requests/2.28.0'
  }
});

// AI subscribes to event stream
eventBus.on('access_control_event', async (event) => {
  // Send to AI for real-time analysis
  const analysis = await aiService.analyzeEvent(event);

  if (analysis.anomaly) {
    // Trigger alert
    await securityService.alert(analysis);
  }

  // Store for ML training
  await aiService.storeForTraining(event, analysis);
});
```

**Benefits**:
- AI learns normal vs. anomalous patterns across all governance features
- Real-time anomaly detection (financial access, PAT compromise, unusual imports)
- Predictive recommendations (notification routing, invitation acceptance, sync risk)
- Comprehensive training dataset for all 15 AI use cases

---

## 🧪 AI-Ready Architecture Validation

### Checklist: Is This Feature AI-Ready? (Expanded)

#### Core Requirements ✅
- [x] **Data Logged**: All permission changes logged with context (AuditLog table)
- [x] **Audit Trail**: Complete history of who changed what and why (batchId, reason, changes)
- [x] **API Granularity**: Fine-grained endpoints for AI manipulation (25+ AI endpoints)
- [x] **Temporal Data**: Timestamps on all critical actions (createdAt, modifiedAt, etc.)
- [x] **Context Fields**: Metadata explaining "why" decisions were made (reason, metadata JSON)
- [x] **Headless Operations**: API works without UI for AI automation (REST APIs)

#### Governance Requirements (NEW) ✅
- [x] **Multi-Channel Notification Tracking**: NotificationDelivery table with engagement metrics
- [x] **Capability Usage Monitoring**: CapabilityUsage table tracks which capabilities are exercised
- [x] **Financial Access Logging**: Audit log with financial-specific metadata
- [x] **PAT Security Tracking**: PersonalAccessToken with usage patterns and geolocation
- [x] **Invitation Analytics**: UserInvitation with acceptance time and follow-up tracking
- [x] **Pre-Flight Review**: PreFlightReview table with AI predictions and outcomes
- [x] **Soft Delete Recovery**: RecoveryAction table with AI recommendations
- [x] **Import Mapping History**: DataSourceMapping with confidence scores and accuracy

#### Real-Time AI Hooks (NEW) 📋
- [ ] **Event Stream**: Real-time event feed for AI training (WebSocket/SSE)
- [ ] **AI Middleware Hooks**: 18 hook points for real-time AI intervention
- [ ] **Anomaly Detection**: Real-time alerts for suspicious patterns
- [ ] **Predictive Analytics**: AI predictions integrated into decision points

#### Advanced AI Capabilities (Future) 📋
- [ ] **Natural Language Query Endpoint**: SQL generation from user questions
- [ ] **Auto-Remediation**: AI automatically fixes detected issues (with approval)
- [ ] **Proactive Recommendations**: AI suggests actions before problems occur
- [ ] **Cross-Organization Learning**: AI learns patterns across multiple organizations

---

## 🚀 Implementation Priority (Updated)

### Phase 1 (Must-Have for AI Readiness): ✅ COMPLETE
1. ✅ Comprehensive audit logging infrastructure (AuditLog with batchId, changes, reason)
2. ✅ Enhanced user activity tracking (`lastActivityAt`, `lastLoginAt`, `lastLoginIp`)
3. ✅ Permission change history with context (grantedBy, grantedAt, escalationReason)
4. ✅ Temporary permission support (`permissionExpiresAt`)
5. ✅ Organization health metrics table (with budgetBaseline, trendDirection)

### Phase 2 (High Value - Governance Features): ✅ PLANNED (Included in DECISION.md)
6. ✅ Multi-channel notification tracking (NotificationDelivery table)
7. ✅ Personal Access Token security (PersonalAccessToken with usage tracking)
8. ✅ Invitation lifecycle tracking (UserInvitation with acceptance metrics)
9. ✅ Capability usage monitoring (CapabilityUsage table)
10. ✅ Pre-flight review tracking (PreFlightReview with AI predictions)
11. ✅ Soft delete recovery tracking (RecoveryAction table)
12. ✅ Data import mapping history (DataSourceMapping with quality scores)

### Phase 3 (High Value - AI Endpoints): 📋 TO BE IMPLEMENTED
13. 📋 Notification routing AI endpoints (route-notification, generate-digest)
14. 📋 Capability recommendation AI (suggest-role-capabilities, usage-patterns)
15. 📋 Financial access monitoring AI (learn-financial-access-patterns, detect anomalies)
16. 📋 BEO portfolio analytics AI (beo-analytics, beo-predict-quarter-end)
17. 📋 Data import intelligence AI (analyze-import-file, learn-import-mapping)
18. 📋 Audit intelligence AI (analyze-audit-trail, suggest-revert, generate-compliance-report)
19. 📋 PAT security AI (recommend-pat-scopes, suggest-token-expiration)
20. 📋 Invitation optimization AI (predict-invitation-acceptance, generate-invitation-followup)
21. 📋 Pre-flight intelligence AI (predict-sync-impact, score-sync-risk)
22. 📋 Soft delete intelligence AI (recommend-recovery, assess-permanent-delete-impact)

### Phase 4 (Future Enhancement - Real-Time AI): 📋 FUTURE
23. 📋 Event streaming infrastructure (WebSocket/SSE for real-time events)
24. 📋 AI middleware hooks (18 hook points integrated into API middleware)
25. 📋 Real-time anomaly detection (alert system with automated responses)
26. 📋 Natural language query endpoint (SQL generation from user questions)
27. 📋 Proactive recommendation engine (AI suggests actions before problems occur)

### Implementation Timeline Estimate

| Phase | Duration | Dependencies | Complexity |
|-------|----------|--------------|------------|
| **Phase 1** | ✅ COMPLETE | Database schema in place | HIGH |
| **Phase 2** | ✅ PLANNED (in ADR-005-IMPLEMENTATION_PLAN.md) | Phase 1 complete | HIGH |
| **Phase 3** | 6-8 weeks | Phase 2 complete, AI provider API keys, ML models trained | VERY HIGH |
| **Phase 4** | 8-12 weeks | Phase 3 complete, real-time infrastructure (WebSocket), production AI models | EXTREME |

**Total AI Readiness: 45-60 weeks** (Phases 1-4 combined)

**Current Status**: Phase 1 complete (5/27 items), Phase 2 planned (12/27 items), Phase 3-4 pending

---

## 📝 Integration Points in Current System (Expanded)

### Existing AI System (Gemini/OpenAI/Claude):

The existing AI assistant can be augmented to support all 15 AI use cases:

#### Basic Queries (Existing)
1. **Answer Permission Questions**: "Who has write access to Org 123?"
2. **Suggest Permission Changes**: "This user should probably have sync permissions"
3. **Generate Audit Reports**: "Show me all permission changes in the last 30 days"

#### NEW: Governance Queries (AI Use Cases 6-15)
4. **Notification Intelligence**: "Why didn't John receive the permission change email?"
   - AI checks NotificationDelivery table, analyzes engagement patterns
   - Response: "John prefers Slack. Email had 0% open rate in past 30 days."

5. **Capability Analysis**: "Which users have 'viewFinancialDetails' but never use it?"
   - AI joins UserOrganization + CapabilityUsage
   - Response: "5 users granted this capability 30+ days ago, 0 uses detected."

6. **Financial Access Audit**: "Show me users who accessed 1000+ financial records in the last week"
   - AI queries AuditLog with financial metadata
   - Response: "3 users. 2 are BEO users (expected). 1 is viewer role (ALERT: investigate)."

7. **BEO Portfolio Insights**: "Which organizations are trending over budget?"
   - AI analyzes OrganizationHealth + PfaRecord variance
   - Response: "Org HOLNG: +$450K (+12%). Driver: Extended crane rentals (weather delays)."

8. **Data Import Quality**: "What's the success rate of ESS imports in the last month?"
   - AI queries DataSourceMapping accuracy metrics
   - Response: "92% success rate (458/500 files). Top error: Cost field ambiguous (Rental vs Purchase)."

9. **Audit Compliance**: "Generate a compliance summary for Q4 2025"
   - AI calls /api/ai/generate-compliance-report
   - Response: Executive markdown summary with violations, trends, recommendations

10. **PAT Security**: "Are there any compromised Personal Access Tokens?"
    - AI checks PersonalAccessToken usage patterns + geolocation anomalies
    - Response: "1 suspected: pat-abc123 used from 5 countries in 30 min. Auto-revoked."

11. **Invitation Analytics**: "Why do Friday afternoon invitations have low acceptance?"
    - AI analyzes UserInvitation acceptance time by send time
    - Response: "Friday 4pm-6pm: 58% acceptance (vs 84% Monday 9am-11am). Recommend rescheduling."

12. **Pre-Flight Risk**: "Is it safe to sync 50 PFA records with +$100K cost increase?"
    - AI calls /api/ai/score-sync-risk
    - Response: "Risk: MEDIUM (0.68). Recommendation: Split into 5 batches, review with PM."

13. **Soft Delete Recovery**: "Should we permanently delete these 10 records?"
    - AI calls /api/ai/assess-permanent-delete-impact
    - Response: "WARNING: 3 records synced to PEMS (requires PEMS delete). 2 referenced in audit logs."

**Required Changes**:
- ✅ Add `accessControl` entity to AI context (existing)
- ✅ Train AI on permission schema structure (existing)
- ✅ Add SQL query generation for permission analysis (existing)
- ⚠️ **NEW**: Add all 11 governance tables to AI context
- ⚠️ **NEW**: Train AI on notification, capability, PAT, invitation schemas
- ⚠️ **NEW**: Implement 25+ AI endpoints for governance intelligence
- ⚠️ **NEW**: Add natural language → SQL for governance queries
- ⚠️ **NEW**: Integrate AI predictions into Pre-Flight Review Modal UI

---

### 26. Sync Conflict Resolution ("The Diplomat")

**Scenario**: PEMS sync indicates User "John Doe" should be a "Viewer", but Local Admin previously upgraded him to "Editor" (marked as `isCustom=true`). AI detects the conflict and recommends a resolution based on configured policy.

**AI Capability**:
```typescript
// AI Hook triggered during PEMS sync
interface SyncConflictEvent {
  syncId: string;
  userId: string;
  organizationId: string;
  field: string; // e.g., "roleId", "permissions"
  pemsValue: any;
  localValue: any;
  resolution: 'local_wins' | 'pems_wins' | 'manual_review';
  timestamp: Date;
}

// AI detection endpoint
POST /api/ai/detect-sync-conflicts
{
  "syncId": "sync-123",
  "conflicts": [
    {
      "userId": "user-john-doe",
      "organizationId": "org-HOLNG",
      "field": "roleId",
      "pemsValue": "viewer",
      "localValue": "editor",
      "isCustom": true,
      "modifiedBy": "admin-sarah",
      "modifiedAt": "2025-11-15T10:30:00Z"
    }
  ]
}

// AI Response
{
  "syncId": "sync-123",
  "conflictCount": 1,
  "resolutions": [
    {
      "userId": "user-john-doe",
      "conflict": {
        "field": "roleId",
        "pemsValue": "viewer",
        "localValue": "editor"
      },
      "recommendation": "local_wins",
      "reasoning": "Local admin 'sarah' manually upgraded this user 11 days ago (marked as custom override). Your configured policy is 'Local Overrides Win'. Preserving local 'Editor' role.",
      "confidence": 0.95,
      "actions": [
        {
          "type": "PRESERVE_LOCAL",
          "field": "roleId",
          "value": "editor",
          "maintainCustomFlag": true
        },
        {
          "type": "LOG_CONFLICT",
          "auditAction": "sync_conflict_resolved",
          "notify": ["admin-sarah"]
        }
      ],
      "alternativeActions": [
        {
          "type": "APPLY_PEMS",
          "description": "Override local changes and apply PEMS value",
          "risk": "HIGH - Undoes manual admin action"
        },
        {
          "type": "MANUAL_REVIEW",
          "description": "Flag for admin review before syncing",
          "estimatedReviewTime": "2-5 minutes"
        }
      ]
    }
  ],
  "notification": {
    "message": "🔄 **Sync Conflict Detected**: PEMS sync attempted to downgrade User 'John Doe' from 'Editor' to 'Viewer'. I have preserved the local 'Editor' role (marked as custom override) per your policy 'Local Overrides Win'. This conflict has been flagged for your review in the Audit Log.",
    "priority": "MEDIUM",
    "actions": [
      {
        "label": "View Conflict",
        "url": "/admin/audit-log?filter=sync_conflict&syncId=sync-123"
      },
      {
        "label": "Change Policy",
        "url": "/admin/settings/sync-policy"
      }
    ]
  }
}
```

**Data Prerequisites (Implement Now)**:
- ✅ `UserOrganization.assignmentSource` field tracks whether assignment came from PEMS or local
- ✅ `UserOrganization.isCustom` flag marks local overrides
- ✅ `UserOrganization.modifiedBy` and `modifiedAt` track who made local changes
- ✅ `Organization.syncPolicy` JSON field stores conflict resolution rules: `{ "conflictResolution": "local_wins" }`
- ✅ Store PEMS sync logs with processed user IDs and detected conflicts

**Data Capture**:
```typescript
// In pems-sync-service.ts → reconcileUserAssignments()
await logAiEvent({
  type: 'sync_conflict_resolved',
  userId: john.id,
  organizationId: 'org-HOLNG',
  metadata: {
    field: 'roleId',
    pemsValue: 'viewer',
    localValue: 'editor',
    resolution: 'local_wins',
    policy: 'local_overrides_win',
    modifiedBy: 'admin-sarah',
    modifiedAt: '2025-11-15T10:30:00Z'
  }
});
```

**UX Integration**:
- Toast notification with "View Conflict" button → Opens audit log entry with diff view
- Admin Dashboard → "Conflicts" tab shows all unresolved sync conflicts
- Conflict list filterable by: organization, user, field, resolution status
- Each conflict shows: User name, Field, PEMS value vs Local value, Resolution applied, Timestamp

**Mandatory Hook**: `pems-sync-service.ts` → `reconcileUserAssignments()` function

---

### 27. Orphan Account Detection ("The Guardian")

**Scenario**: User "JSmith" (`externalId: 'PEMS-10345'`) was deleted in PEMS 2 days ago but remains `status='active'` in Vanguard. AI flags this as a security risk and recommends immediate suspension.

**AI Capability**:
```typescript
// AI Hook triggered after PEMS sync completes
interface OrphanAccountEvent {
  userId: string;
  externalId: string; // PEMS User ID
  lastSeenInPems: Date;
  deletedInPemsAt: Date;
  currentStatus: string; // "active", "suspended"
  recommendedAction: 'suspend' | 'convert_to_local' | 'delete';
  timestamp: Date;
}

// AI detection endpoint (runs after sync)
POST /api/ai/detect-orphan-accounts
{
  "syncId": "sync-123",
  "pemsUsers": [
    { "id": "PEMS-10001", "username": "john.doe" },
    { "id": "PEMS-10002", "username": "jane.smith" }
    // Note: "PEMS-10345" (JSmith) is NOT in this list
  ]
}

// AI Response
{
  "syncId": "sync-123",
  "orphanCount": 1,
  "orphanedAccounts": [
    {
      "userId": "user-jsmith-123",
      "username": "jsmith",
      "email": "jsmith@example.com",
      "externalId": "PEMS-10345",
      "authProvider": "pems",
      "currentStatus": "active",
      "lastSeenInPems": "2025-11-22T10:30:00Z",
      "deletedInPemsAt": "2025-11-24T00:00:00Z", // Estimated
      "daysSinceOrphaned": 2,
      "riskAssessment": {
        "riskLevel": "HIGH",
        "riskScore": 0.87,
        "riskFactors": [
          "User is currently active (can still login)",
          "User has 'Editor' role with financial data access",
          "User last logged in 3 hours ago (recent activity)",
          "User is not in PEMS source for 2 consecutive syncs"
        ]
      },
      "recommendation": {
        "action": "suspend",
        "reasoning": "This user was deleted from PEMS source system 2 days ago but remains active in Vanguard. This is a **CRITICAL SECURITY RISK** - the account could be compromised. Immediate suspension is recommended pending investigation.",
        "confidence": 0.95,
        "urgency": "CRITICAL",
        "alternatives": [
          {
            "action": "convert_to_local",
            "description": "Convert user to local authentication (authProvider='local'), allowing continued access with Vanguard-only credentials",
            "risk": "MEDIUM - Bypasses PEMS deactivation intent",
            "requiresApproval": true
          },
          {
            "action": "delete",
            "description": "Soft-delete user from Vanguard",
            "risk": "LOW - Preserves audit trail, can be recovered",
            "requiresConfirmation": true
          }
        ]
      },
      "suggestedActions": [
        {
          "type": "AUTO_SUSPEND",
          "description": "Immediately suspend user account",
          "endpoint": "PATCH /api/users/user-jsmith-123",
          "payload": { "serviceStatus": "suspended", "suspensionReason": "Orphaned from PEMS" }
        },
        {
          "type": "NOTIFY_ADMIN",
          "description": "Send high-priority alert to system administrators",
          "priority": "HIGH",
          "channels": ["email", "slack"]
        },
        {
          "type": "REVOKE_SESSIONS",
          "description": "Terminate all active sessions for this user",
          "endpoint": "POST /api/auth/revoke-sessions/:userId"
        }
      ]
    }
  ],
  "notification": {
    "message": "⚠️ **Security Alert**: User 'JSmith' (jsmith@example.com) is currently ACTIVE in Vanguard but was deleted from PEMS source system on Nov 22nd. This account has been orphaned for 2 days. Recommended action: Immediate suspension pending investigation.",
    "priority": "HIGH",
    "urgency": "CRITICAL",
    "actions": [
      {
        "label": "Suspend User",
        "url": "/admin/users/user-jsmith-123/suspend",
        "variant": "danger"
      },
      {
        "label": "View Details",
        "url": "/admin/users/user-jsmith-123"
      },
      {
        "label": "Convert to Local",
        "url": "/admin/users/user-jsmith-123/convert-to-local",
        "requiresConfirmation": true
      }
    ]
  }
}
```

**Data Prerequisites (Implement Now)**:
- ✅ `User.externalId` field links to PEMS user ID
- ✅ `User.authProvider` field tracks authentication source ('pems' | 'local')
- ✅ `User.updatedAt` timestamp shows when user record was last modified
- ✅ Store PEMS sync logs with list of processed user IDs
- ✅ Compare current PEMS user list against previous sync to detect deletions

**Data Capture**:
```typescript
// In pems-sync-service.ts → detectOrphanedAccounts()
const pemsExternalIds = pemsUsers.map(u => u.id);

// Find all PEMS users in local DB that were NOT in PEMS response
const orphans = await prisma.user.findMany({
  where: {
    authProvider: 'pems',
    externalId: { notIn: pemsExternalIds },
    serviceStatus: 'active', // Only flag active users
  }
});

for (const orphan of orphans) {
  await logAiEvent({
    type: 'orphan_account_detected',
    userId: orphan.id,
    metadata: {
      externalId: orphan.externalId,
      lastSeenInPems: orphan.updatedAt, // Approximation
      daysSinceOrphaned: daysSince(orphan.updatedAt),
      currentStatus: orphan.serviceStatus,
      recommendedAction: 'suspend'
    }
  });

  // Send admin alert
  await notificationService.sendAlert({
    type: 'security',
    priority: 'high',
    message: `Orphaned account detected: ${orphan.email}`,
    action: `Review user ${orphan.id}`
  });
}
```

**UX Integration**:
- Admin Dashboard → "Security" tab shows "Orphaned Accounts" badge with count
- Clicking badge opens filtered user list showing all orphaned accounts
- Each orphaned account shows: Username, Email, Days Since Orphaned, Last Seen in PEMS, Actions
- Actions: [Suspend] [Convert to Local] [View Audit Log] [Dismiss Alert]
- Alert notification sent to all admins within 1 hour of detection
- Weekly digest email: "5 orphaned accounts detected this week - Review required"

**Mandatory Hook**: `pems-sync-service.ts` → `detectOrphanedAccounts()` function (runs after sync completes)

**Security Consideration**: Orphaned accounts are a **CRITICAL SECURITY RISK**. Attackers could:
1. Compromise a PEMS user account
2. Delete the user in PEMS to evade audit
3. Continue accessing Vanguard with orphaned credentials

**Mitigation**: Orphan detection must run within 24 hours of PEMS sync completion (ideally within 1 hour).

---

## 🔐 Security Considerations for AI (Expanded)

### AI-Driven Risks:

#### Original Risks
1. **Over-Automation**: AI grants permissions too liberally
2. **False Positives**: AI suspends legitimate users
3. **Data Leakage**: AI recommendations expose sensitive patterns

#### NEW: Governance-Specific Risks
4. **Notification Spam**: AI routes all notifications to one channel, overwhelming users
5. **Capability Escalation**: AI suggests excessive capabilities, violating least privilege principle
6. **Financial Data Exposure**: AI caches financial data in logs/recommendations, leaking sensitive costs
7. **BEO Data Aggregation**: AI cross-org analytics expose competitive pricing to unauthorized users
8. **Import Mapping Errors**: AI learns incorrect mappings, corrupting data imports
9. **Audit Log Manipulation**: AI-driven revert suggestions could hide malicious changes
10. **PAT Over-Scoping**: AI recommends overly permissive token scopes
11. **Invitation Timing Attack**: AI predicts acceptance patterns, enabling social engineering
12. **Pre-Flight Bypass**: AI underestimates risk, allowing dangerous syncs
13. **Soft Delete Errors**: AI incorrectly recommends permanent delete, causing data loss

### Mitigation Strategies (Expanded):

#### General AI Security
- **Human-in-Loop**: AI recommends, humans approve (initially) - especially for:
  - Permission grants affecting >10 users
  - Financial data access for non-BEO users
  - Pre-flight reviews with risk score >0.7
  - Permanent deletes of synced records
- **Confidence Thresholds**: Only act on high-confidence (>0.9) recommendations
- **Audit AI Actions**: Log all AI-driven changes with `action: "ai:*"` prefix
- **Rate Limiting**: AI can't make bulk changes without manual override

#### Governance-Specific Mitigations
- **Notification Privacy**:
  - AI notification routing respects user privacy (no cross-org learning)
  - Digest generation excludes sensitive financial data from subject lines
  - Channel selection limited to user-configured preferences

- **Capability Security**:
  - AI capability suggestions never exceed admin's own capabilities
  - Capability usage tracking excludes sensitive actions (password changes, billing)
  - Anomaly detection has 24-hour warm-up period (avoid false positives on new users)

- **Financial Data Protection**:
  - AI financial access monitoring uses anonymized hashes (not actual costs)
  - BEO analytics aggregates only (no drill-down to individual records without permission)
  - Export requests with financial fields require separate re-authentication

- **Import Validation**:
  - AI mapping suggestions require admin approval before first use
  - Data quality score <0.8 triggers manual review
  - Transformation rules sandboxed (test on 10 rows before batch apply)

- **Audit Integrity**:
  - AI revert suggestions include full dependency graph (prevent hiding related changes)
  - Revert actions create compensating audit entries (maintain immutable log)
  - Compliance reports include AI-flagged anomalies (not filtered out)

- **PAT Scope Minimization**:
  - AI scope recommendations default to most restrictive (expand only with justification)
  - Token expiration enforced (AI can suggest extension, not removal)
  - Compromised token alerts trigger immediate revocation (no AI delay)

- **Invitation Security**:
  - AI acceptance prediction doesn't expose invitation content to unauthorized users
  - Follow-up message generation uses templates (no AI-generated phishing risk)
  - Invitation analytics aggregated per org (no cross-org learning)

- **Pre-Flight Safety**:
  - AI risk score >0.6 requires mandatory admin review
  - Impact predictions include worst-case scenarios (not just expected outcome)
  - Sync recommendations never suggest bypassing review

- **Soft Delete Protection**:
  - AI permanent delete recommendations require 48-hour delay (cooling-off period)
  - Dependency warnings block delete (not just warn)
  - Recovery recommendations prioritize safety (default to recover, not delete)

---

## 📚 Related Documentation

- **Decision**: [ADR-005-DECISION.md](./ADR-005-DECISION.md) - Complete database schemas and governance architecture
- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md) - 9-phase implementation roadmap
- **UX Specification**: [ADR-005-UX_SPEC.md](./ADR-005-UX_SPEC.md) - Notification drawer, BEO dashboard, import wizard UI
- **Test Plan**: [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md) - Security, load, and integration tests
- **Agent Workflow**: [ADR-005-AGENT_WORKFLOW.md](./ADR-005-AGENT_WORKFLOW.md) - Execution schedule with parallel tracks

---

**Status**: AI-Ready Architecture Defined (27 AI Use Cases - includes PEMS Hybrid Integration)
**Next Action**: Implement Phase 2 governance features + Phase 3 AI endpoints + Phase 4 UX/Executive Intelligence + PEMS Hybrid Security

**Document Statistics**:
- **AI Use Cases**: 27 total
  - 5 original (Basic AI capabilities)
  - 10 governance/enterprise features (Notifications, PAT security, Invitations, etc.)
  - 10 UX & Executive Intelligence (Context help, Financial masking, Semantic search, BEO analytics, Multiverse simulator)
  - 2 PEMS Hybrid Intelligence (Sync conflict resolution, Orphan account detection)
- **Database Tables**: 18+ AI-ready tables
  - Core: AuditLog, NotificationDelivery, PersonalAccessToken, UserInvitation, CapabilityUsage, PreFlightReview, RecoveryAction, DataSourceMapping, OrganizationHealth
  - Extensions: User, UserOrganization, PfaRecord (with AI tracking fields)
  - New (Use Cases 16-25): VendorMaster, ContractTerms, EquipmentLocation, ScenarioStorage, NotificationQueue, FinancialBaselines, RoleTemplate
- **AI Endpoints**: 35+ specialized endpoints
  - 25 governance intelligence endpoints
  - 10+ new UX/Executive endpoints (explain-permission-denial, translate-financial-data, semantic-audit-search, beo-analytics, detect-vendor-pricing-anomalies, create-scenario, compare-scenarios, etc.)
- **AI Hooks**: 18 middleware injection points for real-time AI intervention
- **Event Types**: 23 event types for AI training stream
- **Document Size**: 3,100+ lines (up from 1,814 lines in v2.0)

*Document created: 2025-11-26*
*Last updated: 2025-11-26*
*AI Readiness Version: 3.0 (UX & Executive Intelligence Edition)*
