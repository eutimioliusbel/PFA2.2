# Natural Language Permission Queries - User Guide

**Phase 6, Task 6.4** of ADR-005 Multi-Tenant Access Control

---

## Overview

The **Natural Language Permission Search** feature allows administrators to query user permissions using plain English instead of navigating through multiple admin panels. Powered by Google Gemini AI, it understands semantic variations and provides instant, accurate results.

### Key Features

- **AI-Powered Semantic Understanding** - Ask questions in natural language
- **Real-Time Confidence Scoring** - See how confident the AI is in understanding your query (70%+ threshold)
- **Auto-Complete Suggestions** - Get query examples organized by category
- **Query History** - Quick access to recent searches
- **Structured Results** - User-friendly display with follow-up suggestions

---

## How to Access

1. Log in to PFA Vanguard as an admin user
2. Navigate to **Admin Dashboard**
3. Click **"Permission Search"** in the left sidebar (Search icon)

---

## Query Types & Examples

### 1. User Permission Lookup

**What it does**: Find out what a specific user can do.

**Example Queries**:
```
What can john.doe do?
Show me alice's permissions
What access does bob.jones have?
john.doe's permissions
List permissions for jane.smith
```

**What You'll See**:
- User's email and username
- Organizations they have access to
- Permissions for each organization (Read, Edit, Delete, etc.)
- Suggested follow-up queries

**Example Response**:
```
john.doe (john.doe@example.com) has access to 2 organizations:

HOLNG: Read, Edit Forecast, Delete, Export
RIO: Read, View Financials
```

---

### 2. Organization Access

**What it does**: Find all users who have access to a specific organization.

**Example Queries**:
```
Who has access to HOLNG?
List users in Rio Tinto
Show me everyone in PEMS_Global
Users in HOLNG organization
Who can access BECH?
```

**What You'll See**:
- Organization name and code
- List of users with their roles
- User count

**Example Response**:
```
Found 12 users in HOLNG:

- john.doe (admin)
- alice.smith (editor)
- bob.jones (viewer)
...
```

---

### 3. Capability Search

**What it does**: Find all users who have a specific permission.

**Example Queries**:
```
Who can delete records?
Show me users with financial access
List users who can manage settings
Who has export permissions?
Who can sync data to PEMS?
Show me all admins
```

**Semantic Variations** (AI understands these as equivalent):
- "financial access" = "view costs" = "see prices" = "cost data"
- "manage settings" = "configure system" = "change settings"
- "delete" = "remove" = "erase"
- "admin" = "administrator" = "full access"

**Example Response**:
```
Found 5 users with Delete capability:

- john.doe (HOLNG, RIO)
- admin (HOLNG, BECH, RIO)
- pm_lead (BECH)
```

---

### 4. Advanced Queries

**Filtered Organization Queries**:
```
Who can delete records in HOLNG?
List users with financial access in Rio Tinto
Show me editors in BECH
Who has admin rights in PEMS_Global?
```

**Cross-Organization Analysis**:
```
Who has access to multiple organizations?
Show me users with admin in more than one org
Which users have financial access across all orgs?
List users with access to 5+ organizations
```

---

## Confidence Scoring

The AI displays a **confidence score** for each query to show how certain it is about the interpretation:

| Score | Badge | Meaning | Action |
|-------|-------|---------|--------|
| **90-100%** | High Confidence (Green) | AI is very confident | Results are highly reliable |
| **70-89%** | Good Confidence (Blue) | AI is reasonably confident | Results are generally accurate |
| **50-69%** | Low Confidence (Yellow) | AI is uncertain | Review results carefully, consider rephrasing |
| **Below 70%** | Very Low Confidence (Red) | Query rejected | **Must rephrase** - query too ambiguous |

**What Happens with Low Confidence (<70%)**:
- Query is **rejected** with a warning message
- AI suggests clearer query examples
- You'll see: "Query interpretation confidence (65%) is below the required threshold (70%). Please rephrase your question to be more specific."

---

## Query Suggestions

Click any suggested query to auto-fill the search box:

**User Lookup**:
- What can [username] do?
- Show me [username]'s permissions
- What access does [username] have?

**Organization**:
- Who has access to [organization]?
- List users in [organization] with admin rights
- Who can delete records in [organization]?

**Capability Search**:
- Who can delete records?
- Show me users with financial access
- Who has export permissions?
- List users who can manage other users

**Cross-Organization**:
- Who has access to multiple organizations?
- Show me users with admin access in more than one org
- Which users have financial access across all organizations?

**Security Analysis**:
- Who has the most permissions?
- Show me users with high-risk permissions
- List recently granted admin access

---

## Query History

Your 5 most recent queries are displayed below the search box when no results are shown. Click any previous query to re-run it instantly.

**What's Stored**:
- Query text
- Query type (user_permissions, org_permissions, capability_search, etc.)
- Result count
- Timestamp

---

## Tips for Better Results

### 1. Be Specific
```
✅ Good: "Who can delete records in HOLNG?"
❌ Vague: "Who can do stuff?"
```

### 2. Use Full Organization Codes
```
✅ Good: "Who has access to RIO?"
❌ Partial: "Who has access to R?"
```

### 3. Use Exact Usernames
```
✅ Good: "What can john.doe do?"
❌ Vague: "What can john do?" (might match multiple users)
```

### 4. Stick to Supported Permissions
- Read, Edit Forecast, Edit Actuals, Delete
- Import, Refresh Data, Export
- View Financials (use "financial", "cost", or "price" keywords)
- Save Draft, Sync
- Manage Users, Manage Settings, Configure Alerts, Impersonate

---

## Supported Permissions

### Data Scope Permissions
- **Read**: View PFA records
- **Edit Forecast**: Modify forecast dates/costs
- **Edit Actuals**: Modify actual dates/costs
- **Delete**: Remove PFA records

### Data Operations
- **Import**: Upload CSV data
- **Refresh Data**: Trigger PEMS sync
- **Export**: Download CSV data

### Financial Access
- **View Financials**: See cost/rate data (masked for users without this permission)

### Process Permissions
- **Save Draft**: Save changes without committing
- **Sync**: Push data to PEMS

### Admin Permissions
- **Manage Users**: Add/remove users, assign permissions
- **Manage Settings**: Configure organization settings
- **Configure Alerts**: Set up notifications
- **Impersonate**: Act as another user

---

## Semantic Keyword Map

The AI understands these keyword variations:

| Permission | Keywords AI Recognizes |
|------------|------------------------|
| **View Financials** | financial, financials, costs, cost data, rates, prices, money, budget |
| **Edit Forecast** | edit forecast, modify forecast, change forecast, update forecast, edit, modify |
| **Delete** | delete, remove, destroy, erase |
| **Manage Settings** | settings, configuration, configure, manage settings |
| **Import** | import, upload, bulk import, CSV import |
| **Export** | export, download, CSV export, extract |
| **Sync** | sync, synchronize, PEMS sync, push to PEMS |
| **Admin** | admin, administrator, full access, super user, superuser |

---

## Structured Answer Format

Results include:

**Summary**: Quick overview (e.g., "3 users have delete access")

**Users List**:
- Username and email
- Organizations they belong to
- Visual tags for each organization

**Follow-Up Suggestions**:
- Related queries you might want to run
- Click any suggestion to auto-fill the search

---

## How the AI Works

1. **Query Parsing**: Gemini AI analyzes your natural language query
2. **Intent Classification**: Determines query type (user lookup, org access, capability search, etc.)
3. **Confidence Scoring**: Assigns a confidence score (0-100%)
4. **Threshold Check**: Rejects queries below 70% confidence
5. **Database Query**: Executes the appropriate database search
6. **Natural Language Response**: Formats results in human-readable text
7. **Structured Data**: Provides machine-readable results for the UI
8. **Audit Logging**: Records the query for analytics

---

## Security & Privacy

- **Audit Logging**: All queries are logged in the audit trail
- **Permission Required**: Only users with `perm_ManageUsers` can use this feature
- **Organization Isolation**: Non-admin users can only query their own organizations
- **No Data Exposure**: Query results respect existing permission boundaries

---

## Fallback Behavior

If Google Gemini AI is unavailable:
- System falls back to **regex-based pattern matching**
- Confidence scores will be lower (typically 60%)
- You'll see "Parsing: Pattern Matching" instead of "Parsing: AI-Powered"
- Low-confidence warning will appear for most queries
- Consider rephrasing queries to match exact patterns

---

## Troubleshooting

### "Query interpretation confidence (XX%) is below the required threshold (70%)"

**Solution**: Rephrase your query to be more specific. Use exact usernames, organization codes, or permission names from the suggested examples.

### "I couldn't find a user matching '[username]'"

**Solution**:
- Check the spelling of the username
- Use the exact username (case-sensitive)
- Try using the user's email address instead

### "I couldn't find an organization matching '[org code]'"

**Solution**:
- Use the exact organization code (e.g., "HOLNG", not "holng" or "Holcim")
- Check available organizations in the Organization Management panel

### "Failed to process query"

**Solution**:
- Check your internet connection
- Verify Gemini AI is configured correctly
- Try again in a few moments
- Contact your system administrator if the issue persists

---

## API Usage

For developers integrating this feature:

**Endpoint**: `POST /api/ai/nl-query`

**Request**:
```json
{
  "query": "Who can delete records in HOLNG?",
  "organizationId": "optional-org-filter"
}
```

**Response**:
```json
{
  "success": true,
  "queryType": "capability_search",
  "response": "Found 3 users with delete capability...",
  "confidence": 0.92,
  "parsingMethod": "llm",
  "data": { ... },
  "structuredAnswer": {
    "users": [ ... ],
    "summary": "3 users have delete access",
  },
  "suggestedFollowUps": [ ... ]
}
```

---

## Future Enhancements

Planned improvements:
- **Multi-language support** - Query in Spanish, French, etc.
- **Voice input** - Speak your queries
- **Saved queries** - Bookmark frequently used searches
- **Scheduled reports** - Get daily/weekly permission reports
- **Anomaly detection** - AI flags unusual permission patterns

---

## Feedback

Found a bug or have a suggestion? Contact the PFA Vanguard team or submit a ticket through the support portal.

**Last Updated**: 2025-11-27
**Version**: 1.0.0
**ADR**: ADR-005, Phase 6, Task 6.4
