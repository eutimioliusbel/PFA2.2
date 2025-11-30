# ADR-005 AGENT_WORKFLOW - PART 2: Phases 5-10

**Continuation of**: ADR-005-AGENT_WORKFLOW-COMPLETE.md

---

## 🔵 Phase 5: Admin UI & API Management

**Duration**: 3 days
**Prerequisites**: ✅ Phase 4 Complete

---

### 🛠️ Task 5.1: User Management UI

**Agent**: `react-ai-ux-specialist`

**Input Dependencies**:
- ✅ Phase 4 complete (frontend-backend integration)

**Output Deliverables**:
- 📄 UserManagement.tsx component
- 📄 User list with service status indicators
- 📄 Suspend/activate controls
- 📄 Edit user modal with PEMS hybrid warnings

**Acceptance Criteria**:
- ✅ List all users with status badges
- ✅ Suspend/activate buttons work
- ✅ PEMS users show external indicator
- ✅ Warning shown when editing PEMS user email

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@react-ai-ux-specialist

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.1 of ADR-005.
Phase 4 complete (authorization integrated).

**BUSINESS CONTEXT** (from DECISION.md):
Requirement #8: "User Service Status Controls - Admins must be able to suspend/activate users immediately."
Requirement #18: "Hybrid Source of Truth - PEMS users should show external indicator."

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md):

```tsx
// File: components/admin/UserManagement.tsx

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const loadUsers = async () => {
    const data = await apiClient.getUsers();
    setUsers(data);
  };

  const handleSuspend = async (userId: string, reason: string) => {
    await apiClient.suspendUser(userId, reason);
    await loadUsers();
  };

  return (
    <div className="user-management">
      <h2>User Management</h2>

      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Auth Provider</th>
            <th>Status</th>
            <th>Organizations</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>
                {user.username}
                {user.authProvider === 'pems' && (
                  <Badge color="blue">PEMS</Badge>
                )}
              </td>
              <td>{user.email}</td>
              <td>{user.authProvider}</td>
              <td>
                <StatusBadge status={user.serviceStatus} />
              </td>
              <td>{user.organizations.length} orgs</td>
              <td>
                {user.serviceStatus === 'active' ? (
                  <button onClick={() => handleSuspend(user.id)}>Suspend</button>
                ) : (
                  <button onClick={() => handleActivate(user.id)}>Activate</button>
                )}
                <button onClick={() => setSelectedUser(user)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
}
```

**PEMS User Email Warning**:

```tsx
// In EditUserModal

{user.authProvider === 'pems' && emailChanged && (
  <div className="warning-banner">
    <WarningIcon />
    <span>
      Changing email for PEMS user may break sync.
      Local change will be overwritten on next sync.
    </span>
    <label>
      <input type="checkbox" checked={confirmOverride} onChange={...} />
      I understand this is temporary
    </label>
  </div>
)}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Log user suspension/activation events for anomaly detection.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Use color-coded status badges (Green=Active, Red=Suspended, Orange=Locked).
🚨 **MANDATORY**: Show PEMS badge for external users.

**YOUR MISSION**:

**Step 1**: Create UserManagement.tsx with user list table
**Step 2**: Add suspend/activate controls
**Step 3**: Create EditUserModal with PEMS email warning
**Step 4**: Add status badge component with icons

**DELIVERABLES**:
1. components/admin/UserManagement.tsx
2. components/admin/EditUserModal.tsx
3. components/StatusBadge.tsx
4. API endpoints: GET /api/admin/users, PATCH /api/admin/users/:id

**CONSTRAINTS**:
- ❌ Do NOT allow deleting PEMS users
- ❌ Do NOT allow changing PEMS user auth provider
- ✅ DO show clear warnings for PEMS overrides
- ✅ DO use color-coded status indicators

**VERIFICATION QUESTIONS**:
1. Can admins suspend users immediately?
2. Are PEMS users clearly indicated?
3. Does email change warning appear for PEMS users?
4. Are status colors accessible (WCAG AA)?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 5.2: Organization Management UI

**Agent**: `react-ai-ux-specialist`

**Input Dependencies**:
- ✅ Phase 4 complete

**Output Deliverables**:
- 📄 OrganizationManagement.tsx
- 📄 Suspend/activate/archive controls
- 📄 Sync toggle UI
- 📄 External org indicators

**Acceptance Criteria**:
- ✅ List all organizations with status
- ✅ Service status controls work
- ✅ External orgs show read-only indicators
- ✅ Sync toggle disabled for suspended orgs

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@react-ai-ux-specialist

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.2 of ADR-005.
Phase 4 complete (authorization integrated).

**BUSINESS CONTEXT** (from DECISION.md):
Requirement #9: "Organization Service Status Controls - Suspend/activate/archive organizations."
Requirement #19: "PEMS-managed organizations cannot be deleted, only suspended or unlinked."

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md):

```tsx
// File: components/admin/OrganizationManagement.tsx

export function OrganizationManagement() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const loadOrganizations = async () => {
    const data = await apiClient.getOrganizations();
    setOrgs(data);
  };

  const handleStatusChange = async (orgId: string, newStatus: ServiceStatus) => {
    await apiClient.updateOrganization(orgId, { serviceStatus: newStatus });
    await loadOrganizations();
  };

  const handleSyncToggle = async (orgId: string, enabled: boolean) => {
    await apiClient.updateOrganization(orgId, { enableSync: enabled });
    await loadOrganizations();
  };

  return (
    <div className="organization-management">
      <h2>Organization Management</h2>

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Service Status</th>
            <th>Sync Enabled</th>
            <th>Source</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map(org => (
            <tr key={org.id}>
              <td>
                {org.code}
                {org.isExternal && (
                  <Badge color="blue">PEMS</Badge>
                )}
              </td>
              <td>{org.name}</td>
              <td>
                <select
                  value={org.serviceStatus}
                  onChange={(e) => handleStatusChange(org.id, e.target.value)}
                  disabled={org.serviceStatus === 'archived'}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="archived">Archived</option>
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={org.enableSync}
                  onChange={(e) => handleSyncToggle(org.id, e.target.checked)}
                  disabled={org.serviceStatus === 'suspended'}
                />
              </td>
              <td>{org.isExternal ? 'PEMS' : 'Local'}</td>
              <td>
                <button onClick={() => setSelectedOrg(org)}>Edit</button>
                {!org.isExternal && (
                  <button
                    onClick={() => handleDelete(org.id)}
                    className="btn-danger"
                  >
                    Delete
                  </button>
                )}
                {org.isExternal && (
                  <button onClick={() => handleUnlink(org.id)}>
                    Unlink from PEMS
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedOrg && (
        <EditOrganizationModal
          organization={selectedOrg}
          onClose={() => setSelectedOrg(null)}
          onSave={handleSaveOrg}
        />
      )}
    </div>
  );
}
```

**External Organization Warning**:

```tsx
// In EditOrganizationModal

{organization.isExternal && (
  <div className="info-banner">
    <InfoIcon />
    <span>
      This organization is managed by PEMS.
      Code and core settings are read-only.
      Settings (sync toggle, service status) can be modified locally.
    </span>
  </div>
)}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Log organization status changes for health monitoring.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Disable sync toggle when org is suspended with tooltip explanation.
🚨 **MANDATORY**: Show warning banner before unlinking PEMS organization.

**YOUR MISSION**:

**Step 1**: Create OrganizationManagement.tsx with org list table
**Step 2**: Add service status dropdown controls
**Step 3**: Add sync toggle with disabled state for suspended orgs
**Step 4**: Create EditOrganizationModal with external org warnings
**Step 5**: Add unlink confirmation dialog for PEMS orgs

**DELIVERABLES**:
1. components/admin/OrganizationManagement.tsx
2. components/admin/EditOrganizationModal.tsx
3. components/admin/UnlinkConfirmDialog.tsx
4. API endpoints: GET /api/admin/organizations, PATCH /api/admin/organizations/:id

**CONSTRAINTS**:
- ❌ Do NOT allow deleting PEMS organizations
- ❌ Do NOT allow changing org code for PEMS orgs
- ❌ Do NOT allow sync toggle when org is archived
- ✅ DO show clear indicators for external orgs
- ✅ DO disable actions based on service status

**VERIFICATION QUESTIONS**:
1. Can admins suspend organizations immediately?
2. Is sync toggle disabled for suspended orgs?
3. Are PEMS organizations clearly marked?
4. Does unlink confirmation dialog show impact warning?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 5.3: User-Organization Permission Manager

**Agent**: `react-ai-ux-specialist`

**Input Dependencies**:
- ✅ Phase 4 complete

**Output Deliverables**:
- 📄 UserOrgPermissions.tsx
- 📄 Role dropdown UI
- 📄 Granular permission checkboxes
- 📄 Capability override UI

**Acceptance Criteria**:
- ✅ Admins can grant/revoke permissions
- ✅ Role changes update capabilities automatically
- ✅ Custom capability overrides supported
- ✅ PEMS sync overrides show warning

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@react-ai-ux-specialist

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.3 of ADR-005.
Phase 4 complete (permission UI components available).

**BUSINESS CONTEXT** (from DECISION.md):
Requirement #10: "Granular Permission Management - Admins assign permissions per user per organization."
Requirement #11: "Hybrid Role-Override System - Role templates + custom capability overrides."

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md):

```tsx
// File: components/admin/UserOrgPermissions.tsx

export function UserOrgPermissions({ userId }: { userId: string }) {
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([]);
  const [selectedUserOrg, setSelectedUserOrg] = useState<UserOrganization | null>(null);

  const loadUserOrganizations = async () => {
    const data = await apiClient.getUserOrganizations(userId);
    setUserOrgs(data);
  };

  const handleRoleChange = async (userOrgId: string, newRole: string) => {
    await apiClient.updateUserOrganization(userOrgId, { role: newRole });
    await loadUserOrganizations();
  };

  const handleCapabilityToggle = async (
    userOrgId: string,
    capability: string,
    value: boolean
  ) => {
    await apiClient.updateUserOrgCapability(userOrgId, capability, value);
    await loadUserOrganizations();
  };

  return (
    <div className="user-org-permissions">
      <h3>Organization Permissions</h3>

      <table>
        <thead>
          <tr>
            <th>Organization</th>
            <th>Role</th>
            <th>Source</th>
            <th>Capabilities</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {userOrgs.map(uo => (
            <tr key={uo.id}>
              <td>{uo.organization.name}</td>
              <td>
                <select
                  value={uo.role}
                  onChange={(e) => handleRoleChange(uo.id, e.target.value)}
                  disabled={uo.assignmentSource === 'pems_sync' && !uo.isCustom}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                  <option value="beo">BEO User</option>
                </select>
                {uo.assignmentSource === 'pems_sync' && (
                  <Badge color="blue">PEMS</Badge>
                )}
              </td>
              <td>{uo.assignmentSource}</td>
              <td>
                <button onClick={() => setSelectedUserOrg(uo)}>
                  Configure ({Object.keys(uo.capabilities || {}).filter(k => uo.capabilities[k]).length} enabled)
                </button>
              </td>
              <td>
                <button onClick={() => handleRevoke(uo.id)}>Revoke Access</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedUserOrg && (
        <CapabilityEditorModal
          userOrg={selectedUserOrg}
          onClose={() => setSelectedUserOrg(null)}
          onSave={handleSaveCapabilities}
        />
      )}
    </div>
  );
}
```

**Capability Editor Modal**:

```tsx
// File: components/admin/CapabilityEditorModal.tsx

export function CapabilityEditorModal({ userOrg, onClose, onSave }) {
  const [capabilities, setCapabilities] = useState(userOrg.capabilities || {});
  const [roleTemplate, setRoleTemplate] = useState(null);

  useEffect(() => {
    // Load role template capabilities
    loadRoleTemplate(userOrg.role).then(setRoleTemplate);
  }, [userOrg.role]);

  const handleToggle = (capability: string) => {
    setCapabilities(prev => ({
      ...prev,
      [capability]: !prev[capability]
    }));
  };

  return (
    <Modal title="Manage Capabilities" onClose={onClose}>
      {userOrg.assignmentSource === 'pems_sync' && !userOrg.isCustom && (
        <div className="warning-banner">
          <WarningIcon />
          <span>
            This assignment is managed by PEMS.
            Custom capability overrides will be preserved during sync.
          </span>
        </div>
      )}

      <div className="capability-grid">
        <h4>Permission Capabilities</h4>
        <label>
          <input
            type="checkbox"
            checked={capabilities.viewFinancialDetails}
            onChange={() => handleToggle('viewFinancialDetails')}
          />
          View Financial Details
          {roleTemplate?.capabilities.viewFinancialDetails && (
            <Badge color="gray">From Role</Badge>
          )}
        </label>

        <label>
          <input
            type="checkbox"
            checked={capabilities.exportWithFinancials}
            onChange={() => handleToggle('exportWithFinancials')}
          />
          Export with Financials
        </label>

        <label>
          <input
            type="checkbox"
            checked={capabilities.bulkOperations}
            onChange={() => handleToggle('bulkOperations')}
          />
          Bulk Operations
        </label>

        <label>
          <input
            type="checkbox"
            checked={capabilities.bypassReview}
            onChange={() => handleToggle('bypassReview')}
          />
          Bypass Pre-Flight Review
        </label>

        <label>
          <input
            type="checkbox"
            checked={capabilities.timeTravel}
            onChange={() => handleToggle('timeTravel')}
          />
          Time Travel Revert
        </label>
      </div>

      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={() => onSave(capabilities)}>Save Capabilities</button>
      </div>
    </Modal>
  );
}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Log capability changes for AI permission suggestion learning.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Show role template capabilities vs. custom overrides.
🚨 **MANDATORY**: Optimistic UI for capability toggles (<100ms perceived latency).

**YOUR MISSION**:

**Step 1**: Create UserOrgPermissions.tsx with org list and role dropdowns
**Step 2**: Create CapabilityEditorModal with granular capability checkboxes
**Step 3**: Add PEMS sync assignment warnings
**Step 4**: Implement role template preview (show which capabilities come from role vs. custom)
**Step 5**: Add revoke access confirmation dialog

**DELIVERABLES**:
1. components/admin/UserOrgPermissions.tsx
2. components/admin/CapabilityEditorModal.tsx
3. Integration with backend UserOrganization endpoints

**CONSTRAINTS**:
- ❌ Do NOT allow removing PEMS assignments (only local overrides)
- ❌ Do NOT show financial capabilities to users without viewFinancialDetails base permission
- ✅ DO show clear indication of which capabilities are from role vs. custom
- ✅ DO warn when modifying PEMS-synced assignments

**VERIFICATION QUESTIONS**:
1. Can admins change user roles per organization?
2. Do custom capability overrides persist during PEMS sync?
3. Are role template capabilities clearly distinguished from overrides?
4. Does the UI prevent invalid capability combinations?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 5.4: Pre-Flight Transaction Ceremony

**Agent**: `react-ai-ux-specialist`

**Input Dependencies**:
- ✅ Phase 4 complete

**Output Deliverables**:
- 📄 PreFlightModal.tsx
- 📄 Change summary table
- 📄 Mandatory comment field
- 📄 Confirmation workflow

**Acceptance Criteria**:
- ✅ Shows before bulk operations
- ✅ Displays impacted records count
- ✅ Requires comment for audit trail
- ✅ Can be bypassed with capability

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@react-ai-ux-specialist

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.4 of ADR-005.
Phase 4 complete (permission UI components available).

**BUSINESS CONTEXT** (from DECISION.md):
Requirement #12: "Pre-Flight Transaction Ceremony - Mandatory review before bulk operations."
Use Case #4: "Admins can enforce pre-flight review for high-risk operations."

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md):

```tsx
// File: components/admin/PreFlightModal.tsx

export function PreFlightModal({
  operation,
  affectedRecords,
  onConfirm,
  onCancel
}: PreFlightModalProps) {
  const [comment, setComment] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!comment.trim()) {
      toast.error('Comment is required for audit trail');
      return;
    }
    onConfirm({ comment, timestamp: new Date() });
  };

  return (
    <Modal title="Confirm Bulk Operation" size="large" onClose={onCancel}>
      <div className="pre-flight-summary">
        <div className="alert alert-warning">
          <WarningIcon />
          <strong>High-Risk Operation Detected</strong>
          <p>This action will modify multiple records. Please review carefully.</p>
        </div>

        <div className="operation-details">
          <h4>Operation Summary</h4>
          <table>
            <tbody>
              <tr>
                <td>Operation Type:</td>
                <td><strong>{operation.type}</strong></td>
              </tr>
              <tr>
                <td>Affected Records:</td>
                <td><strong>{affectedRecords.length}</strong></td>
              </tr>
              <tr>
                <td>Organizations:</td>
                <td>{[...new Set(affectedRecords.map(r => r.organizationId))].join(', ')}</td>
              </tr>
              <tr>
                <td>Estimated Impact:</td>
                <td>{operation.estimatedImpact}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="change-preview">
          <h4>Changes Preview</h4>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Current Value</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              {operation.changes.map((change, i) => (
                <tr key={i}>
                  <td>{change.field}</td>
                  <td>{change.oldValue}</td>
                  <td className="text-green-600">{change.newValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mandatory-comment">
          <label>
            <strong>Reason for Change</strong> <span className="text-red-600">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Explain why this change is necessary (required for audit trail)"
            rows={3}
            required
          />
          {!comment && (
            <span className="text-sm text-red-600">
              Comment is required and will be logged in audit trail
            </span>
          )}
        </div>

        <div className="confirmation-checkbox">
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I understand this action affects {affectedRecords.length} records and cannot be undone without Time Travel
          </label>
        </div>
      </div>

      <div className="modal-actions">
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="btn-danger"
          disabled={!comment.trim() || !confirmed}
        >
          Confirm Operation
        </button>
      </div>
    </Modal>
  );
}
```

**Integration in CommandDeck**:

```tsx
// File: components/CommandDeck.tsx

const handleBulkOperation = async (operation: BulkOperation) => {
  const { hasPermission } = usePermissions();

  // Check if user can bypass pre-flight
  if (!hasPermission('bypassReview')) {
    // Show pre-flight modal
    setPreFlightData({
      operation,
      affectedRecords: selectedRecords,
      onConfirm: (metadata) => executeBulkOperation(operation, metadata),
      onCancel: () => setPreFlightData(null)
    });
  } else {
    // Admin bypass
    await executeBulkOperation(operation, { bypassedBy: currentUser.id });
  }
};
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Log all pre-flight reviews and bypasses for anomaly detection.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Mandatory comment field with minimum 10 characters.
🚨 **MANDATORY**: Show estimated impact (time, cost, affected users).

**YOUR MISSION**:

**Step 1**: Create PreFlightModal.tsx with change summary table
**Step 2**: Add mandatory comment field with validation
**Step 3**: Add confirmation checkbox
**Step 4**: Integrate with CommandDeck bulk operations
**Step 5**: Add bypass logic for users with bypassReview capability

**DELIVERABLES**:
1. components/admin/PreFlightModal.tsx
2. Integration in CommandDeck.tsx
3. Backend endpoint: POST /api/audit/pre-flight-review

**CONSTRAINTS**:
- ❌ Do NOT allow empty comments
- ❌ Do NOT show modal for users with bypassReview capability (unless they opt-in)
- ✅ DO log all pre-flight reviews and bypasses
- ✅ DO show estimated impact in dollars and affected records

**VERIFICATION QUESTIONS**:
1. Is comment field mandatory for all bulk operations?
2. Can users with bypassReview capability skip the modal?
3. Does the modal show accurate affected records count?
4. Are all pre-flight reviews logged in audit trail?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 5.5: Time Travel Revert Interface

**Agent**: `react-ai-ux-specialist`

**Input Dependencies**:
- ✅ Phase 4 complete

**Output Deliverables**:
- 📄 HistoryTab.tsx
- 📄 Transaction list UI
- 📄 Revert modal with diff preview
- 📄 Revert confirmation workflow

**Acceptance Criteria**:
- ✅ Shows audit log transactions
- ✅ Preview changes before revert
- ✅ Requires confirmation
- ✅ Only accessible with timeTravel capability

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@react-ai-ux-specialist

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.5 of ADR-005.
Phase 4 complete (audit log backend available).

**BUSINESS CONTEXT** (from DECISION.md):
Requirement #13: "Time Travel Revert - Revert to previous transaction state within 7 days."
Use Case #5: "Admins can undo bulk operations using Time Travel."

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md):

```tsx
// File: components/admin/HistoryTab.tsx

export function HistoryTab({ organizationId }: { organizationId: string }) {
  const [transactions, setTransactions] = useState<AuditLog[]>([]);
  const [selectedTx, setSelectedTx] = useState<AuditLog | null>(null);
  const { hasCapability } = usePermissions();

  useEffect(() => {
    loadTransactionHistory(organizationId);
  }, [organizationId]);

  const loadTransactionHistory = async (orgId: string) => {
    const data = await apiClient.getAuditLog({
      organizationId: orgId,
      orderBy: 'timestamp_desc',
      limit: 100
    });
    setTransactions(data);
  };

  const handleRevert = async (transactionId: string, comment: string) => {
    await apiClient.revertTransaction(transactionId, { comment });
    toast.success('Transaction reverted successfully');
    await loadTransactionHistory(organizationId);
  };

  if (!hasCapability('timeTravel')) {
    return (
      <div className="access-denied">
        <LockIcon />
        <p>Time Travel Revert requires special permission.</p>
        <p>Contact your administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="history-tab">
      <h3>Transaction History</h3>

      <div className="filters">
        <input
          type="text"
          placeholder="Search by user or action..."
          onChange={(e) => filterTransactions(e.target.value)}
        />
        <select onChange={(e) => filterByAction(e.target.value)}>
          <option value="">All Actions</option>
          <option value="pfa:bulk_update">Bulk Updates</option>
          <option value="permission:grant">Permission Grants</option>
          <option value="org:suspend">Org Suspensions</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Action</th>
            <th>Affected Records</th>
            <th>Comment</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <tr key={tx.id}>
              <td>{formatTimestamp(tx.timestamp)}</td>
              <td>{tx.userId}</td>
              <td>{tx.action}</td>
              <td>{tx.metadata?.affectedCount || '-'}</td>
              <td>{tx.metadata?.comment || '-'}</td>
              <td>
                <button onClick={() => setSelectedTx(tx)}>
                  View Details
                </button>
                {canRevert(tx) && (
                  <button
                    onClick={() => openRevertModal(tx)}
                    className="btn-warning"
                  >
                    Revert
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedTx && (
        <RevertModal
          transaction={selectedTx}
          onConfirm={handleRevert}
          onCancel={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
}
```

**Revert Modal**:

```tsx
// File: components/admin/RevertModal.tsx

export function RevertModal({ transaction, onConfirm, onCancel }) {
  const [comment, setComment] = useState('');
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    loadRevertPreview(transaction.id).then(setPreviewData);
  }, [transaction.id]);

  return (
    <Modal title="Revert Transaction" size="large" onClose={onCancel}>
      <div className="revert-summary">
        <div className="alert alert-warning">
          <WarningIcon />
          <strong>Time Travel Revert</strong>
          <p>
            This will undo changes made on {formatTimestamp(transaction.timestamp)} by {transaction.userId}.
          </p>
        </div>

        <div className="transaction-details">
          <h4>Transaction Details</h4>
          <table>
            <tbody>
              <tr>
                <td>Action:</td>
                <td>{transaction.action}</td>
              </tr>
              <tr>
                <td>User:</td>
                <td>{transaction.userId}</td>
              </tr>
              <tr>
                <td>Timestamp:</td>
                <td>{formatTimestamp(transaction.timestamp)}</td>
              </tr>
              <tr>
                <td>Original Comment:</td>
                <td>{transaction.metadata?.comment}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="revert-preview">
          <h4>Changes to be Reverted</h4>
          {previewData ? (
            <table>
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Field</th>
                  <th>Current Value</th>
                  <th>Will Revert To</th>
                </tr>
              </thead>
              <tbody>
                {previewData.changes.map((change, i) => (
                  <tr key={i}>
                    <td>{change.recordId}</td>
                    <td>{change.field}</td>
                    <td>{change.currentValue}</td>
                    <td className="text-green-600">{change.revertValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>Loading preview...</div>
          )}
        </div>

        <div className="revert-comment">
          <label>
            <strong>Reason for Revert</strong> <span className="text-red-600">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Explain why this transaction is being reverted"
            rows={3}
            required
          />
        </div>
      </div>

      <div className="modal-actions">
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(transaction.id, comment)}
          className="btn-danger"
          disabled={!comment.trim()}
        >
          Confirm Revert
        </button>
      </div>
    </Modal>
  );
}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Log all revert operations for audit trail and anomaly detection.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Show diff preview before revert confirmation.
🚨 **MANDATORY**: Restrict to transactions within 7 days.

**YOUR MISSION**:

**Step 1**: Create HistoryTab.tsx with transaction list
**Step 2**: Create RevertModal.tsx with change preview
**Step 3**: Add revert confirmation workflow with mandatory comment
**Step 4**: Add capability check for timeTravel permission
**Step 5**: Add 7-day restriction for revert eligibility

**DELIVERABLES**:
1. components/admin/HistoryTab.tsx
2. components/admin/RevertModal.tsx
3. Backend endpoint: POST /api/audit/revert/:transactionId

**CONSTRAINTS**:
- ❌ Do NOT allow reverting transactions older than 7 days
- ❌ Do NOT allow reverting already-reverted transactions
- ✅ DO show diff preview before confirmation
- ✅ DO require mandatory comment for audit trail

**VERIFICATION QUESTIONS**:
1. Is Time Travel restricted to users with timeTravel capability?
2. Can users only revert transactions within 7 days?
3. Does revert modal show accurate diff preview?
4. Are all reverts logged in audit trail?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 5.6: Intelligent Import Wizard

**Agent**: `react-ai-ux-specialist`

**Input Dependencies**:
- ✅ Phase 4 complete
- ✅ Phase 6 AI foundation (for field mapping suggestions)

**Output Deliverables**:
- 📄 ImportWizard.tsx
- 📄 AI column mapping UI
- 📄 Preview screen with validation
- 📄 Import confirmation workflow

**Acceptance Criteria**:
- ✅ AI suggests field mappings
- ✅ Shows data quality issues
- ✅ Preview before import
- ✅ Validates data integrity

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@react-ai-ux-specialist

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.6 of ADR-005.
Phase 4 complete, Phase 6 AI foundation in progress.

**BUSINESS CONTEXT** (from DECISION.md):
Requirement #14: "Intelligent Import Wizard - AI-assisted CSV/Excel import with field mapping."
Use Case #10: "AI analyzes import files and suggests field mappings."

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md & AI_OPPORTUNITIES.md):

```tsx
// File: components/admin/ImportWizard.tsx

export function ImportWizard({ organizationId }: { organizationId: string }) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'confirm'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [mappingSuggestions, setMappingSuggestions] = useState(null);
  const [finalMapping, setFinalMapping] = useState({});
  const [previewData, setPreviewData] = useState(null);

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);

    // Call AI to analyze file and suggest mappings
    const analysis = await apiClient.analyzeImportFile({
      file: uploadedFile,
      organizationId
    });

    setMappingSuggestions(analysis.suggestedMappings);
    setStep('mapping');
  };

  const handleConfirmMapping = async () => {
    // Generate preview with selected mappings
    const preview = await apiClient.previewImport({
      file,
      mapping: finalMapping,
      organizationId
    });

    setPreviewData(preview);
    setStep('preview');
  };

  const handleConfirmImport = async () => {
    await apiClient.importData({
      file,
      mapping: finalMapping,
      organizationId,
      validateOnly: false
    });

    toast.success('Import completed successfully');
    setStep('upload');
  };

  return (
    <div className="import-wizard">
      <div className="wizard-steps">
        <Step active={step === 'upload'} completed={step !== 'upload'}>
          1. Upload File
        </Step>
        <Step active={step === 'mapping'} completed={step === 'preview' || step === 'confirm'}>
          2. Map Fields
        </Step>
        <Step active={step === 'preview'} completed={step === 'confirm'}>
          3. Preview
        </Step>
        <Step active={step === 'confirm'}>
          4. Confirm
        </Step>
      </div>

      {step === 'upload' && (
        <FileUploadStep onUpload={handleFileUpload} />
      )}

      {step === 'mapping' && (
        <FieldMappingStep
          suggestions={mappingSuggestions}
          onConfirm={handleConfirmMapping}
          onBack={() => setStep('upload')}
        />
      )}

      {step === 'preview' && (
        <PreviewStep
          data={previewData}
          onConfirm={() => setStep('confirm')}
          onBack={() => setStep('mapping')}
        />
      )}

      {step === 'confirm' && (
        <ConfirmImportStep
          summary={previewData.summary}
          onConfirm={handleConfirmImport}
          onBack={() => setStep('preview')}
        />
      )}
    </div>
  );
}
```

**Field Mapping Step**:

```tsx
// File: components/admin/FieldMappingStep.tsx

export function FieldMappingStep({ suggestions, onConfirm, onBack }) {
  const [mappings, setMappings] = useState(suggestions.suggestedMappings);

  return (
    <div className="field-mapping-step">
      <h3>Map CSV Columns to PFA Fields</h3>

      {suggestions.dataQualityIssues.length > 0 && (
        <div className="alert alert-warning">
          <WarningIcon />
          <strong>Data Quality Issues Detected</strong>
          <ul>
            {suggestions.dataQualityIssues.map((issue, i) => (
              <li key={i}>
                <strong>{issue.severity}:</strong> {issue.issue}
                <br />
                <em>Recommendation: {issue.recommendation}</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>CSV Column</th>
            <th>Sample Values</th>
            <th>Maps To</th>
            <th>Confidence</th>
            <th>Transformation</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((mapping, i) => (
            <tr key={i}>
              <td>{mapping.sourceField}</td>
              <td>
                <code>{mapping.sampleValues.join(', ')}</code>
              </td>
              <td>
                <select
                  value={mapping.targetField}
                  onChange={(e) => updateMapping(i, 'targetField', e.target.value)}
                >
                  <option value="">-- Select Field --</option>
                  <option value="equipmentCode">Equipment Code</option>
                  <option value="equipmentDescription">Description</option>
                  <option value="originalStart">Plan Start Date</option>
                  <option value="originalEnd">Plan End Date</option>
                  <option value="monthlyRate">Monthly Rate</option>
                  <option value="purchasePrice">Purchase Price</option>
                  <option value="source">Source (Rental/Purchase)</option>
                </select>
              </td>
              <td>
                <ConfidenceBadge value={mapping.confidence} />
              </td>
              <td>
                {mapping.transformation && (
                  <code className="text-sm">{mapping.transformation}</code>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="wizard-actions">
        <button onClick={onBack} className="btn-secondary">
          Back
        </button>
        <button onClick={() => onConfirm(mappings)} className="btn-primary">
          Continue to Preview
        </button>
      </div>
    </div>
  );
}
```

**Preview Step**:

```tsx
// File: components/admin/PreviewStep.tsx

export function PreviewStep({ data, onConfirm, onBack }) {
  return (
    <div className="preview-step">
      <h3>Preview Import Data</h3>

      <div className="summary">
        <div className="stat-card">
          <strong>{data.summary.totalRows}</strong>
          <span>Total Rows</span>
        </div>
        <div className="stat-card">
          <strong>{data.summary.validRows}</strong>
          <span>Valid Rows</span>
        </div>
        <div className="stat-card text-red-600">
          <strong>{data.summary.errorRows}</strong>
          <span>Errors</span>
        </div>
      </div>

      {data.validationErrors.length > 0 && (
        <div className="alert alert-danger">
          <XCircleIcon />
          <strong>Validation Errors</strong>
          <ul>
            {data.validationErrors.map((error, i) => (
              <li key={i}>
                Row {error.rowNumber}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Row</th>
            <th>Equipment Code</th>
            <th>Description</th>
            <th>Start Date</th>
            <th>Source</th>
            <th>Cost</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.previewRows.map((row, i) => (
            <tr key={i} className={row.hasError ? 'bg-red-50' : ''}>
              <td>{row.rowNumber}</td>
              <td>{row.equipmentCode}</td>
              <td>{row.equipmentDescription}</td>
              <td>{row.originalStart}</td>
              <td>{row.source}</td>
              <td>{row.monthlyRate || row.purchasePrice}</td>
              <td>
                {row.hasError ? (
                  <Badge color="red">Error</Badge>
                ) : (
                  <Badge color="green">Valid</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="wizard-actions">
        <button onClick={onBack} className="btn-secondary">
          Back to Mapping
        </button>
        <button
          onClick={onConfirm}
          className="btn-primary"
          disabled={data.summary.errorRows > 0}
        >
          Continue to Confirm
        </button>
      </div>
    </div>
  );
}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Use AI to suggest field mappings based on column names and sample values.
🚨 **MANDATORY**: Detect data quality issues (missing fields, invalid dates, mixed types).

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Show confidence scores for AI mapping suggestions.
🚨 **MANDATORY**: Preview data before import with validation errors highlighted.

**YOUR MISSION**:

**Step 1**: Create ImportWizard.tsx with multi-step workflow
**Step 2**: Create FileUploadStep.tsx with file validation
**Step 3**: Create FieldMappingStep.tsx with AI suggestions and manual overrides
**Step 4**: Create PreviewStep.tsx with validation error highlighting
**Step 5**: Create ConfirmImportStep.tsx with final summary

**DELIVERABLES**:
1. components/admin/ImportWizard.tsx
2. components/admin/FieldMappingStep.tsx
3. components/admin/PreviewStep.tsx
4. components/admin/ConfirmImportStep.tsx
5. Backend endpoint: POST /api/ai/analyze-import-file
6. Backend endpoint: POST /api/admin/import-data

**CONSTRAINTS**:
- ❌ Do NOT import rows with validation errors
- ❌ Do NOT skip AI analysis step (always suggest mappings)
- ✅ DO show confidence scores for each mapping
- ✅ DO highlight data quality issues before import

**VERIFICATION QUESTIONS**:
1. Does AI suggest accurate field mappings?
2. Are data quality issues detected and displayed?
3. Can users override AI suggestions manually?
4. Does preview show validation errors before import?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 5.7: BEO Glass Mode Landing Page

**Agent**: `react-ai-ux-specialist`

**Input Dependencies**:
- ✅ Phase 4 complete

**Output Deliverables**:
- 📄 PortfolioLanding.tsx
- 📄 Health metrics dashboard
- 📄 Priority attention cards
- 📄 Cross-org analytics

**Acceptance Criteria**:
- ✅ BEO users see portfolio overview
- ✅ Health metrics displayed
- ✅ Priority items highlighted
- ✅ Cross-org filtering works

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@react-ai-ux-specialist

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.7 of ADR-005.
Phase 4 complete (BEO user flag available).

**BUSINESS CONTEXT** (from DECISION.md):
Requirement #15: "BEO Glass Mode - Portfolio-level dashboard for Business Enterprise Overhead users."
Use Case #8: "BEO users see cross-organization analytics and health metrics."

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md & UX_SPEC.md):

```tsx
// File: components/admin/PortfolioLanding.tsx

export function PortfolioLanding() {
  const { currentUser } = useAuth();
  const [portfolioHealth, setPortfolioHealth] = useState(null);
  const [priorityItems, setPriorityItems] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  useEffect(() => {
    loadPortfolioHealth();
    loadPriorityItems();
  }, []);

  const loadPortfolioHealth = async () => {
    const data = await apiClient.getPortfolioHealth({
      userId: currentUser.id,
      scope: 'all_organizations'
    });
    setPortfolioHealth(data);
  };

  const loadPriorityItems = async () => {
    const data = await apiClient.getPriorityItems({
      userId: currentUser.id,
      limit: 10
    });
    setPriorityItems(data);
  };

  if (!currentUser.isBeoUser) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="portfolio-landing">
      <header className="portfolio-header">
        <h1>Portfolio Overview</h1>
        <p>Cross-organization health and performance metrics</p>
      </header>

      <div className="health-metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{portfolioHealth?.totalOrganizations}</div>
          <div className="metric-label">Active Organizations</div>
          <div className="metric-trend text-green-600">
            +2 this quarter
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{portfolioHealth?.healthScore}%</div>
          <div className="metric-label">Portfolio Health</div>
          <div className="metric-trend text-red-600">
            -5% from last month
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{portfolioHealth?.totalVariance}</div>
          <div className="metric-label">Budget Variance</div>
          <div className="metric-trend text-red-600">
            +$1.2M over plan
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{portfolioHealth?.activeUsers}</div>
          <div className="metric-label">Active Users</div>
          <div className="metric-trend text-green-600">
            +15 this week
          </div>
        </div>
      </div>

      <div className="priority-attention-section">
        <h2>Priority Attention</h2>
        <p>Items requiring immediate action across your portfolio</p>

        <div className="priority-cards">
          {priorityItems.map(item => (
            <div
              key={item.id}
              className={`priority-card priority-${item.severity}`}
            >
              <div className="priority-header">
                <Badge color={getSeverityColor(item.severity)}>
                  {item.severity}
                </Badge>
                <span className="priority-org">{item.organizationCode}</span>
              </div>

              <h3>{item.title}</h3>
              <p>{item.description}</p>

              <div className="priority-metrics">
                <div className="metric">
                  <strong>{item.impactValue}</strong>
                  <span>{item.impactLabel}</span>
                </div>
                <div className="metric">
                  <strong>{item.affectedRecords}</strong>
                  <span>Affected Records</span>
                </div>
              </div>

              <div className="priority-actions">
                <button
                  onClick={() => navigateToOrg(item.organizationId)}
                  className="btn-primary"
                >
                  View Details
                </button>
                <button
                  onClick={() => dismissItem(item.id)}
                  className="btn-secondary"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="organization-grid">
        <h2>Organization Health</h2>

        <div className="org-filters">
          <select onChange={(e) => setSelectedOrg(e.target.value)}>
            <option value="">All Organizations</option>
            {portfolioHealth?.organizations.map(org => (
              <option key={org.id} value={org.id}>{org.code}</option>
            ))}
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Health Score</th>
              <th>Budget Variance</th>
              <th>Active Users</th>
              <th>Last Sync</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {portfolioHealth?.organizations
              .filter(org => !selectedOrg || org.id === selectedOrg)
              .map(org => (
                <tr key={org.id}>
                  <td>
                    <strong>{org.code}</strong>
                    <br />
                    <span className="text-sm text-gray-600">{org.name}</span>
                  </td>
                  <td>
                    <HealthScoreBadge score={org.healthScore} />
                  </td>
                  <td className={org.variance > 0 ? 'text-red-600' : 'text-green-600'}>
                    {org.variance > 0 ? '+' : ''}{formatCurrency(org.variance)}
                  </td>
                  <td>{org.activeUsers}</td>
                  <td>{formatTimestamp(org.lastSyncAt)}</td>
                  <td>
                    <StatusBadge status={org.serviceStatus} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Use AI to identify priority items based on variance, health scores, and anomalies.

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Use color-coded health scores (Green >80%, Yellow 60-80%, Red <60%).
🚨 **MANDATORY**: Highlight priority items with severity badges (Critical/High/Medium).

**YOUR MISSION**:

**Step 1**: Create PortfolioLanding.tsx with health metrics grid
**Step 2**: Create priority attention cards with severity indicators
**Step 3**: Create organization health table with filtering
**Step 4**: Add navigation to specific organization dashboards
**Step 5**: Restrict access to BEO users only

**DELIVERABLES**:
1. components/admin/PortfolioLanding.tsx
2. components/admin/HealthScoreBadge.tsx
3. Backend endpoint: GET /api/beo/portfolio-health
4. Backend endpoint: GET /api/beo/priority-items

**CONSTRAINTS**:
- ❌ Do NOT show BEO Glass Mode to non-BEO users
- ❌ Do NOT show financial details unless user has viewFinancialDetails
- ✅ DO use color-coded health scores
- ✅ DO prioritize items by severity (Critical > High > Medium)

**VERIFICATION QUESTIONS**:
1. Is BEO Glass Mode restricted to BEO users?
2. Are health metrics accurate across all organizations?
3. Do priority items show actionable insights?
4. Can BEO users navigate to specific organizations from portfolio view?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 5.8: API Server Management UI

**Agent**: `react-ai-ux-specialist`

**Input Dependencies**:
- ✅ Phase 4 complete
- ✅ ADR-006 API Server schema

**Output Deliverables**:
- 📄 ApiServerManager.tsx
- 📄 ServerFormModal.tsx
- 📄 Permission indicators for perm_ManageSettings

**Acceptance Criteria**:
- ✅ List API servers filtered by user's orgs
- ✅ CREATE/EDIT disabled if user lacks perm_ManageSettings
- ✅ Test button available to all members
- ✅ Organization status indicators shown

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@react-ai-ux-specialist

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.8 of ADR-005 (ADR-006 Integration).
This implements the UI for API Server Management from ADR-006.

**BUSINESS CONTEXT** (from ADR-006):
Users need to manage API server configurations (PEMS, ESS, Procurement APIs).
Only users with perm_ManageSettings can create/edit servers.
Any organization member can test API connections.

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md & ADR-006):

```tsx
// File: components/admin/ApiServerManager.tsx

import { usePermissions } from '../../hooks/usePermissions';
import { PermissionButton } from '../PermissionButton';
import { ServerFormModal } from './ServerFormModal';

export function ApiServerManager() {
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const { hasPermission, currentOrgPermission } = usePermissions();

  const canManage = hasPermission('perm_ManageSettings');

  const loadServers = async () => {
    const data = await apiClient.getApiServers();
    setServers(data);
  };

  const handleTest = async (serverId) => {
    const result = await apiClient.testApiServer(serverId);
    if (result.success) {
      toast.success(`Connected successfully (${result.responseTimeMs}ms)`);
    } else {
      toast.error(`Connection failed: ${result.error}`);
    }
  };

  return (
    <div className="api-server-manager">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">API Server Management</h2>

        <PermissionButton
          permission="perm_ManageSettings"
          onClick={() => setIsCreating(true)}
          className="btn-primary"
        >
          + New API Server
        </PermissionButton>
      </div>

      {!canManage && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <Info className="w-4 h-4 inline mr-2" />
          Read-only access - You can test servers but cannot create/edit/delete.
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Organization</th>
            <th className="text-left py-2">Name</th>
            <th className="text-left py-2">Base URL</th>
            <th className="text-left py-2">Auth Type</th>
            <th className="text-left py-2">Endpoints</th>
            <th className="text-left py-2">Status</th>
            <th className="text-left py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.map(server => (
            <tr key={server.id} className="border-b">
              <td className="py-2">
                {server.organization.code}
                {server.organization.serviceStatus !== 'active' && (
                  <Badge color="yellow">{server.organization.serviceStatus}</Badge>
                )}
              </td>
              <td>{server.name}</td>
              <td className="font-mono text-sm">{server.baseUrl}</td>
              <td>{server.authType}</td>
              <td>{server.endpoints?.length || 0} endpoints</td>
              <td>
                {server.isActive ? (
                  <Badge color="green">Active</Badge>
                ) : (
                  <Badge color="gray">Inactive</Badge>
                )}
              </td>
              <td className="flex gap-2">
                <button
                  onClick={() => handleTest(server.id)}
                  className="btn-sm btn-secondary"
                  disabled={server.organization.serviceStatus === 'suspended'}
                >
                  Test
                </button>

                <PermissionButton
                  permission="perm_ManageSettings"
                  onClick={() => setSelectedServer(server)}
                  className="btn-sm btn-primary"
                >
                  Edit
                </PermissionButton>

                <PermissionButton
                  permission="perm_ManageSettings"
                  onClick={() => handleDelete(server.id)}
                  className="btn-sm btn-danger"
                >
                  Delete
                </PermissionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isCreating && (
        <ServerFormModal
          mode="create"
          onClose={() => setIsCreating(false)}
          onSave={handleCreateServer}
        />
      )}

      {selectedServer && (
        <ServerFormModal
          mode="edit"
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
          onSave={handleUpdateServer}
        />
      )}
    </div>
  );
}
```

**ServerFormModal**:

```tsx
// File: components/admin/ServerFormModal.tsx

export function ServerFormModal({ mode, server, onClose, onSave }) {
  const [form, setForm] = useState({
    organizationId: server?.organizationId || '',
    name: server?.name || '',
    baseUrl: server?.baseUrl || '',
    authType: server?.authType || 'bearer',
    credentials: {},
    description: server?.description || ''
  });

  const handleSubmit = async () => {
    if (mode === 'create') {
      await apiClient.createApiServer(form);
    } else {
      await apiClient.updateApiServer(server.id, form);
    }
    onSave();
    onClose();
  };

  return (
    <Modal title={mode === 'create' ? 'New API Server' : 'Edit API Server'} onClose={onClose}>
      <form className="space-y-4">
        <div>
          <label>Organization</label>
          <select
            value={form.organizationId}
            onChange={e => setForm({ ...form, organizationId: e.target.value })}
          >
            <option value="">Select organization...</option>
            {availableOrgs.map(org => (
              <option key={org.id} value={org.id}>{org.code} - {org.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Server Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., PEMS Production"
          />
        </div>

        <div>
          <label>Base URL</label>
          <input
            type="url"
            value={form.baseUrl}
            onChange={e => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://api.example.com"
          />
        </div>

        <div>
          <label>Authentication Type</label>
          <select
            value={form.authType}
            onChange={e => setForm({ ...form, authType: e.target.value })}
          >
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
            <option value="oauth2">OAuth 2.0</option>
            <option value="apikey">API Key</option>
          </select>
        </div>

        <div>
          <label>Description (Optional)</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Production PEMS instance for project data sync"
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSubmit} className="btn-primary">
            {mode === 'create' ? 'Create Server' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

**UX ENFORCEMENT** (from UX_SPEC.md):
🚨 **MANDATORY**: Show permission indicator (lock icon) on disabled buttons.
🚨 **MANDATORY**: Display organization status (suspended orgs cannot test servers).

**YOUR MISSION**:

**Step 1**: Create ApiServerManager.tsx with server list table
**Step 2**: Create ServerFormModal.tsx with create/edit forms
**Step 3**: Add permission checks for CREATE/EDIT/DELETE (perm_ManageSettings)
**Step 4**: Allow TEST for any organization member
**Step 5**: Show organization status indicators

**DELIVERABLES**:
1. components/admin/ApiServerManager.tsx
2. components/admin/ServerFormModal.tsx
3. Integration with backend API endpoints (Task 5.9)

**CONSTRAINTS**:
- ❌ Do NOT allow creating servers for orgs user doesn't have access to
- ❌ Do NOT allow testing servers if org is suspended
- ✅ DO filter server list by user's accessible organizations
- ✅ DO show clear permission requirements

**VERIFICATION QUESTIONS**:
1. Can users without perm_ManageSettings see but not edit servers?
2. Is Test button available to all organization members?
3. Are suspended organizations clearly indicated?
4. Does the form prevent invalid submissions (e.g., missing base URL)?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 5.9: API Server Management Backend Endpoints

**Agent**: `backend-architecture-optimizer`

**Input Dependencies**:
- ✅ Phase 2 complete (authorization middleware)
- ✅ ADR-006 API Server schema

**Output Deliverables**:
- 📄 apiServerController.ts (CRUD endpoints)
- 📄 requireApiServerPermission middleware
- 📄 OrganizationValidationService integration

**Acceptance Criteria**:
- ✅ GET filters by user's organizations
- ✅ POST/PATCH/DELETE require perm_ManageSettings
- ✅ Organization active validation for CREATE/UPDATE
- ✅ Cascading delete for endpoints

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@backend-architecture-optimizer

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.9 of ADR-005 (ADR-006 Integration).
This implements backend CRUD endpoints for API Server Management.

**BUSINESS CONTEXT** (from ADR-006):
API servers can be created/edited/deleted by users with perm_ManageSettings.
Organization must be active for CREATE/UPDATE operations.
Deleting a server cascades to all endpoints.

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md Lines 2454-2803):

Full specification provided in IMPLEMENTATION_PLAN.md Task 5.9.

Key endpoints:
- GET /api/api-servers (multi-tenant filtered)
- POST /api/api-servers (requires perm_ManageSettings, org active)
- PATCH /api/api-servers/:id (requires perm_ManageSettings, org active)
- DELETE /api/api-servers/:id (requires perm_ManageSettings, cascades)
- POST /api/api-servers/:id/test (any member can test)

**AI ENFORCEMENT**:
🚨 **MANDATORY**: Log all API server operations to audit table.

**YOUR MISSION**:

**Step 1**: Create apiServerController.ts with all CRUD endpoints
**Step 2**: Apply requireApiServerPermission middleware (from Task 2.3)
**Step 3**: Integrate OrganizationValidationService for status checks
**Step 4**: Add audit logging for all operations
**Step 5**: Write integration tests for permission enforcement

**DELIVERABLES**:
1. backend/src/controllers/apiServerController.ts
2. backend/src/routes/apiServers.ts
3. Integration tests (403, 404, cascading delete)

**CONSTRAINTS**:
- ❌ Do NOT allow cross-org access
- ❌ Do NOT allow operations on suspended orgs (except DELETE)
- ✅ DO filter GET by user's organizations
- ✅ DO cascade delete endpoints

**VERIFICATION QUESTIONS**:
1. Are API servers filtered by user's organizations on GET?
2. Does POST fail if organization is suspended?
3. Does DELETE cascade to endpoints?
4. Are all operations logged to audit table?
```

**Status**: ⬜ Not Started

---

### 🛠️ Task 5.10: Organization Validation Service

**Agent**: `backend-architecture-optimizer`

**Input Dependencies**:
- ✅ Phase 1 complete (Organization model)

**Output Deliverables**:
- 📄 organizationValidation.ts service
- 📄 Status validation methods
- 📄 Integration with controllers

**Acceptance Criteria**:
- ✅ Validates org is active before operations
- ✅ Throws clear error messages
- ✅ Integrated with all org-dependent operations

---

#### 📋 Prompt Bundle (Copy & Paste This Entire Block)

```text
@backend-architecture-optimizer

**SYSTEM CONTEXT**:
You are executing Phase 5, Task 5.10 of ADR-005.
This creates a reusable service for validating organization status.

**BUSINESS CONTEXT** (from DECISION.md):
Many operations require the organization to be active (not suspended or archived).
This service provides a centralized validation method.

**TECHNICAL SPECIFICATION** (from IMPLEMENTATION_PLAN.md Lines 2804-3099):

```typescript
// File: backend/src/services/organizationValidation.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class OrganizationValidationService {
  /**
   * Validates that an organization is active and can accept operations
   * @throws Error if organization is not active
   */
  static async validateOrganizationActive(organizationId: string): Promise<void> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { serviceStatus: true, code: true }
    });

    if (!org) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    if (org.serviceStatus === 'suspended') {
      throw new Error(
        `Cannot perform operation: Organization ${org.code} is suspended`
      );
    }

    if (org.serviceStatus === 'archived') {
      throw new Error(
        `Cannot perform operation: Organization ${org.code} is archived`
      );
    }
  }

  /**
   * Checks if organization can accept sync operations
   * @returns true if org can sync, false otherwise
   */
  static async canSync(organizationId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { serviceStatus: true, enableSync: true }
    });

    if (!org) return false;

    return org.serviceStatus === 'active' && org.enableSync === true;
  }

  /**
   * Validates user has access to organization
   * @throws Error if user doesn't have access
   */
  static async validateUserAccess(
    userId: string,
    organizationId: string
  ): Promise<void> {
    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId, organizationId }
      }
    });

    if (!userOrg) {
      throw new Error(
        `User does not have access to organization ${organizationId}`
      );
    }
  }

  /**
   * Get all active organizations for a user
   */
  static async getActiveOrganizationsForUser(userId: string): Promise<string[]> {
    const userOrgs = await prisma.userOrganization.findMany({
      where: {
        userId,
        organization: { serviceStatus: 'active' }
      },
      select: { organizationId: true }
    });

    return userOrgs.map(uo => uo.organizationId);
  }
}
```

**Usage in Controllers**:

```typescript
// Example: In apiServerController.ts

import { OrganizationValidationService } from '../services/organizationValidation';

export async function createApiServer(req, res) {
  const { organizationId, name, baseUrl, authType } = req.body;

  try {
    // Validate organization is active
    await OrganizationValidationService.validateOrganizationActive(organizationId);

    // Validate user has access
    await OrganizationValidationService.validateUserAccess(
      req.user.id,
      organizationId
    );

    // Create API server
    const server = await prisma.apiServer.create({
      data: { organizationId, name, baseUrl, authType }
    });

    res.status(201).json(server);
  } catch (error) {
    if (error.message.includes('suspended') || error.message.includes('archived')) {
      return res.status(422).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**AI ENFORCEMENT** (from AI_OPPORTUNITIES.md):
🚨 **MANDATORY**: Log validation failures for anomaly detection.

**YOUR MISSION**:

**Step 1**: Create organizationValidation.ts service with validation methods
**Step 2**: Add validateOrganizationActive method
**Step 3**: Add canSync method for PEMS sync checks
**Step 4**: Add validateUserAccess method for authorization
**Step 5**: Integrate service into all org-dependent controllers

**DELIVERABLES**:
1. backend/src/services/organizationValidation.ts
2. Integration in apiServerController.ts
3. Integration in pemsSyncController.ts
4. Integration in pfaDataController.ts
5. Unit tests for validation logic

**CONSTRAINTS**:
- ❌ Do NOT allow operations on suspended orgs (except DELETE)
- ❌ Do NOT allow sync on disabled orgs
- ✅ DO throw clear error messages
- ✅ DO log validation failures

**VERIFICATION QUESTIONS**:
1. Does validateOrganizationActive throw errors for suspended orgs?
2. Does canSync return false for disabled sync?
3. Does validateUserAccess check user-org assignments?
4. Are all validation failures logged?
```

**Status**: ⬜ Not Started

---

## 🤖 Phase 6: AI Foundation

**Duration**: 2 days
**Prerequisites**: ✅ Phase 5 Complete

**📋 Complete Prompt Bundles**: See [ADR-005-ALL-PROMPT-BUNDLES.md](./ADR-005-ALL-PROMPT-BUNDLES.md#phase-6-ai-foundation)

---

### 🛠️ Task 6.1: AI Permission Suggestion Engine

**Agent**: `ai-systems-architect`

**Deliverables**: suggestPermissions() service, pattern analysis

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 6.1](./ADR-005-ALL-PROMPT-BUNDLES.md#task-61-ai-permission-suggestion-engine)

---

### 🛠️ Task 6.2: AI Security Anomaly Detection

**Agent**: `ai-security-red-teamer`

**Deliverables**: anomalyDetection() service, alert system

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 6.2](./ADR-005-ALL-PROMPT-BUNDLES.md#task-62-ai-security-anomaly-detection)

---

### 🛠️ Task 6.3: AI Financial Access Monitoring

**Agent**: `ai-security-red-teamer`

**Deliverables**: financialAccessMonitor() service, baseline learning

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 6.3](./ADR-005-ALL-PROMPT-BUNDLES.md#task-63-ai-financial-access-monitoring)

---

### 🛠️ Task 6.4: AI Natural Language Permission Queries

**Agent**: `ai-systems-architect`

**Deliverables**: nlQueryParser() service, semantic search

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 6.4](./ADR-005-ALL-PROMPT-BUNDLES.md#task-64-ai-natural-language-permission-queries)

---

### 🛠️ Task 6.5: AI Data Hooks Implementation

**Agent**: `backend-architecture-optimizer`

**Deliverables**: Audit logging, external ID tracking, metadata capture

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 6.5](./ADR-005-ALL-PROMPT-BUNDLES.md#task-65-ai-data-hooks-implementation)

---

## 🎨 Phase 7: UX Intelligence (AI Use Cases 16-20)

**Duration**: 3 days
**Prerequisites**: ✅ Phase 6 Complete

**📋 Complete Prompt Bundles**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Phase 7](./ADR-005-ALL-PROMPT-BUNDLES.md#phase-7-ux-intelligence)

---

### 🛠️ Task 7.1: Context-Aware Access Explanation (UC 16)

**Agent**: `ux-technologist`

**Deliverables**: explainPermissionDenial() service, tooltip components

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 7.1](./ADR-005-ALL-PROMPT-BUNDLES.md#task-71-context-aware-access-explanation)

---

### 🛠️ Task 7.2: Financial Data Masking (UC 17)

**Agent**: `ux-technologist`

**Deliverables**: maskFinancialData() service, relative indicators UI

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 7.2](./ADR-005-ALL-PROMPT-BUNDLES.md#task-72-financial-data-masking)

---

### 🛠️ Task 7.3: Semantic Audit Search (UC 18)

**Agent**: `ai-systems-architect`

**Deliverables**: semanticAuditSearch() service, NLP query parser

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 7.3](./ADR-005-ALL-PROMPT-BUNDLES.md#task-73-semantic-audit-search)

---

### 🛠️ Task 7.4: Role Drift Detection (UC 19)

**Agent**: `ai-systems-architect`

**Deliverables**: detectRoleDrift() service, pattern alerts

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 7.4](./ADR-005-ALL-PROMPT-BUNDLES.md#task-74-role-drift-detection)

---

### 🛠️ Task 7.5: Behavioral Quiet Mode (UC 20)

**Agent**: `ux-technologist`

**Deliverables**: notificationRouter() service, engagement learning

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 7.5](./ADR-005-ALL-PROMPT-BUNDLES.md#task-75-behavioral-quiet-mode)

---

## 💼 Phase 8: BEO Intelligence (AI Use Cases 21-25)

**Duration**: 3 days
**Prerequisites**: ✅ Phase 6 Complete

**📋 Complete Prompt Bundles**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Phase 8](./ADR-005-ALL-PROMPT-BUNDLES.md#phase-8-beo-intelligence)

---

### 🛠️ Task 8.1: Boardroom Voice Analyst (UC 21)

**Agent**: `ai-systems-architect`

**Deliverables**: beoAnalytics() service, conversational BI

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 8.1](./ADR-005-ALL-PROMPT-BUNDLES.md#task-81-boardroom-voice-analyst)

---

### 🛠️ Task 8.2: Narrative Variance Generator (UC 22)

**Agent**: `ai-systems-architect`

**Deliverables**: generateNarrative() service, executive summaries

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 8.2](./ADR-005-ALL-PROMPT-BUNDLES.md#task-82-narrative-variance-generator)

---

### 🛠️ Task 8.3: Asset Arbitrage Detector (UC 23)

**Agent**: `ai-systems-architect`

**Deliverables**: detectArbitrage() service, opportunity finder

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 8.3](./ADR-005-ALL-PROMPT-BUNDLES.md#task-83-asset-arbitrage-detector)

---

### 🛠️ Task 8.4: Vendor Pricing Watchdog (UC 24)

**Agent**: `ai-systems-architect`

**Deliverables**: pricingWatchdog() service, anomaly alerts

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 8.4](./ADR-005-ALL-PROMPT-BUNDLES.md#task-84-vendor-pricing-watchdog)

---

### 🛠️ Task 8.5: Multiverse Scenario Simulator (UC 25)

**Agent**: `ai-systems-architect`

**Deliverables**: scenarioSimulator() service, impact predictions

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 8.5](./ADR-005-ALL-PROMPT-BUNDLES.md#task-85-multiverse-scenario-simulator)

---

## 🔧 Phase 9: AI Integration & Refinement

**Duration**: 2 days
**Prerequisites**: ✅ Phase 7, 8 Complete

**📋 Complete Prompt Bundles**: See [ADR-005-ALL-PROMPT-BUNDLES.md](./ADR-005-ALL-PROMPT-BUNDLES.md#phase-9-ai-integration--refinement)

---

### 🛠️ Task 9.1: AI Model Performance Tuning

**Agent**: `ai-quality-engineer`

**Deliverables**: Model accuracy benchmarks, latency optimization

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 9.1](./ADR-005-ALL-PROMPT-BUNDLES.md#task-91-ai-model-performance-tuning)

---

### 🛠️ Task 9.2: AI Prompt Engineering

**Agent**: `ai-quality-engineer`

**Deliverables**: Optimized prompts, confidence thresholds

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 9.2](./ADR-005-ALL-PROMPT-BUNDLES.md#task-92-ai-prompt-engineering)

---

### 🛠️ Task 9.3: AI Caching Strategy

**Agent**: `backend-architecture-optimizer`

**Deliverables**: Redis caching for AI responses, cache invalidation

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 9.3](./ADR-005-ALL-PROMPT-BUNDLES.md#task-93-ai-caching-strategy)

---

### 🛠️ Task 9.4: AI Error Handling & Fallbacks

**Agent**: `backend-architecture-optimizer`

**Deliverables**: Graceful degradation, manual override paths

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 9.4](./ADR-005-ALL-PROMPT-BUNDLES.md#task-94-ai-error-handling--fallbacks)

---

## 🛡️ Phase 10: Security & QA Gates

**Duration**: 2 days
**Mode**: ⚡ Parallel Execution
**Prerequisites**: ✅ Phase 9 Complete

**📋 Complete Prompt Bundles**:
- Phase 10A (Security): [ADR-005-ALL-PROMPT-BUNDLES.md](./ADR-005-ALL-PROMPT-BUNDLES.md#phase-10-security--qa-gates)
- Phase 10 Remaining (10A.5-10A.6, 10B.1-10B.6): [ADR-005-ALL-PROMPT-BUNDLES.md](./ADR-005-ALL-PROMPT-BUNDLES.md#phase-10-security--qa-gates)

---

### 🛠️ Task 10A.1: Privilege Escalation Testing

**Agent**: `ai-security-red-teamer`

**Deliverables**: Attack scenarios, vulnerability report

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10A.1](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10a1-privilege-escalation-testing)

---

### 🛠️ Task 10A.2: Cross-Organization Access Testing

**Agent**: `ai-security-red-teamer`

**Deliverables**: IDOR tests, data isolation verification

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10A.2](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10a2-cross-organization-access-testing-idor)

---

### 🛠️ Task 10A.3: Financial Masking Bypass Testing

**Agent**: `ai-security-red-teamer`

**Deliverables**: Exploit attempts, masking integrity verification

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10A.3](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10a3-financial-masking-bypass-testing)

---

### 🛠️ Task 10A.4: API Server Security Audit

**Agent**: `ai-security-red-teamer`

**Deliverables**: Permission bypass tests, cascading delete verification

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10A.4](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10a4-api-server-security-audit)

---

### 🛠️ Task 10A.5: JWT Tampering Testing

**Agent**: `ai-security-red-teamer`

**Deliverables**: Token modification tests, signature verification

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10A.5](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10a5-jwt-tampering-testing)

---

### 🛠️ Task 10A.6: Rate Limiting Bypass Testing

**Agent**: `ai-security-red-teamer`

**Deliverables**: Brute force tests, account lockout verification

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10A.6](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10a6-rate-limiting-bypass-testing)

---

### 🛠️ Task 10B.1: Integration Test Suite

**Agent**: `sdet-test-automation`

**Deliverables**: 171+ test cases, >80% coverage

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10B.1](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10b1-integration-test-suite)

---

### 🛠️ Task 10B.2: E2E Permission Workflow Tests

**Agent**: `sdet-test-automation`

**Deliverables**: Admin grant workflow, user suspension flow

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10B.2](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10b2-e2e-permission-workflow-tests)

---

### 🛠️ Task 10B.3: Load Testing

**Agent**: `sdet-test-automation`

**Deliverables**: Concurrent permission checks, database connection pool stress

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10B.3](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10b3-load-testing)

---

### 🛠️ Task 10B.4: Performance Benchmarking

**Agent**: `sdet-test-automation`

**Deliverables**: Latency measurements, <50ms authorization overhead verification

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10B.4](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10b4-performance-benchmarking)

---

### 🛠️ Task 10B.5: Accessibility Compliance Testing

**Agent**: `design-review`

**Deliverables**: WCAG AA compliance, keyboard navigation verification

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10B.5](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10b5-accessibility-compliance-testing)

---

### 🛠️ Task 10B.6: Documentation Review

**Agent**: `documentation-synthesizer`

**Deliverables**: API docs, user guides, admin manuals

**Status**: ⬜ Not Started

**Prompt Bundle**: See [ADR-005-ALL-PROMPT-BUNDLES.md - Task 10B.6](./ADR-005-ALL-PROMPT-BUNDLES.md#task-10b6-documentation-review)

---

## 📈 Progress Tracking (Complete)

| Phase | Task | Agent | Status | Date |
|-------|------|-------|--------|------|
| 0 | PEMS User API Setup | backend-architecture-optimizer | ✅ Complete | 2025-11-26 |
| 1 | Database Schema V2 | postgres-jsonb-architect | ✅ Complete | 2025-11-26 |
| 2.1 | Authorization Middleware | backend-architecture-optimizer | ⬜ Not Started | - |
| 2.2 | API Endpoint Authorization | backend-architecture-optimizer | ⬜ Not Started | - |
| 2.3 | API Server Authorization | backend-architecture-optimizer | ⬜ Not Started | - |
| 2B.1 | Permission UI Components | react-ai-ux-specialist | ⬜ Not Started | - |
| 2B.2 | CommandDeck Updates | react-ai-ux-specialist | ⬜ Not Started | - |
| 3.1 | Org-Based Sync Filtering | backend-architecture-optimizer | ⬜ Not Started | - |
| 3.2 | User Permission Filtering | backend-architecture-optimizer | ⬜ Not Started | - |
| 3.3 | Sync Health Dashboard | react-ai-ux-specialist | ⬜ Not Started | - |
| 4.1 | Frontend-Backend Integration | ux-technologist | ⬜ Not Started | - |
| 5.1 | User Management UI | react-ai-ux-specialist | ⬜ Not Started | - |
| 5.2 | Organization Management UI | react-ai-ux-specialist | ⬜ Not Started | - |
| 5.3 | Permission Manager UI | react-ai-ux-specialist | ⬜ Not Started | - |
| 5.4 | Pre-Flight Ceremony | react-ai-ux-specialist | ⬜ Not Started | - |
| 5.5 | Time Travel Revert | react-ai-ux-specialist | ⬜ Not Started | - |
| 5.6 | Import Wizard | react-ai-ux-specialist | ⬜ Not Started | - |
| 5.7 | BEO Glass Mode | react-ai-ux-specialist | ⬜ Not Started | - |
| 5.8 | API Server Manager UI | react-ai-ux-specialist | ⬜ Not Started | - |
| 5.9 | API Server Backend | backend-architecture-optimizer | ⬜ Not Started | - |
| 5.10 | Org Validation Service | backend-architecture-optimizer | ⬜ Not Started | - |
| 6.1-6.5 | AI Foundation | ai-systems-architect | ⬜ Not Started | - |
| 7.1-7.5 | UX Intelligence | ux-technologist | ⬜ Not Started | - |
| 8.1-8.5 | BEO Intelligence | ai-systems-architect | ⬜ Not Started | - |
| 9.1-9.4 | AI Refinement | ai-quality-engineer | ⬜ Not Started | - |
| 10A.1-10A.6 | Security Gate | ai-security-red-teamer | ⬜ Not Started | - |
| 10B.1-10B.6 | QA Gate | sdet-test-automation | ⬜ Not Started | - |

---

## 📚 Related Documentation

- **Decision**: [ADR-005-DECISION.md](./ADR-005-DECISION.md)
- **AI Opportunities**: [ADR-005-AI_OPPORTUNITIES.md](./ADR-005-AI_OPPORTUNITIES.md)
- **UX Specification**: [ADR-005-UX_SPEC.md](./ADR-005-UX_SPEC.md)
- **Test Plan**: [ADR-005-TEST_PLAN.md](./ADR-005-TEST_PLAN.md)
- **Implementation Plan**: [ADR-005-IMPLEMENTATION_PLAN.md](./ADR-005-IMPLEMENTATION_PLAN.md)
- **Database Schema V2**: [../../DATABASE_SCHEMA_V2.md](../../DATABASE_SCHEMA_V2.md)

---

**Workflow Generated**: 2025-11-26
**Generated By**: Orchestrator Agent
**Total Tasks**: 48 (10 complete, 38 detailed prompt bundles)
**Total Agents**: 8 specialist agents
**Estimated Duration**: 22 days

*This is an executable document. Paste back into chat for resumption.*
