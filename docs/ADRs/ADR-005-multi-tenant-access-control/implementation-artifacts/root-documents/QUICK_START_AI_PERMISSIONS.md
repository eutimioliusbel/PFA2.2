# Quick Start: AI Permission Suggestions

**5-Minute Developer Guide**

---

## For Frontend Developers

### Using the UserPermissionModal

```tsx
import { UserPermissionModal } from './components/admin/UserPermissionModal';

// In your component
const [showModal, setShowModal] = useState(false);

const handleSave = async (permissions, role) => {
  await apiClient.assignUserToOrganization({
    userId: newUser.id,
    organizationId: currentOrg.id,
    role,
    ...permissions,
  });
  setShowModal(false);
};

return (
  <UserPermissionModal
    userId={newUser.id}
    username={newUser.username}
    organizationId={currentOrg.id}
    organizationName={currentOrg.name}
    onSave={handleSave}
    onClose={() => setShowModal(false)}
  />
);
```

**That's it!** The modal handles:
- ✅ AI suggestion fetching
- ✅ Confidence display
- ✅ Security warnings
- ✅ Manual overrides
- ✅ Feedback logging

---

## For Backend Developers

### Calling the Service Directly

```typescript
import permissionSuggestionService from './services/ai/PermissionSuggestionService';

const suggestion = await permissionSuggestionService.suggestPermissions({
  userId: 'user-123',
  organizationId: 'org-456',
  role: 'Project Manager',
  department: 'Construction',
});

console.log(suggestion);
// {
//   suggestedRole: 'editor',
//   suggestedCapabilities: { perm_Read: true, ... },
//   confidence: 0.92,
//   reasoning: 'Based on 150 similar users...',
//   basedOnUsers: 150,
//   securityWarnings: [...]
// }
```

### Recording Feedback

```typescript
await permissionSuggestionService.recordSuggestionOutcome(
  suggestion.id,
  true, // accepted
  suggestion.suggestedCapabilities // or modified permissions
);
```

---

## For Admins

### Using the UI

1. **Add User to Organization**
   - Click "Add User" in Organization Management
   - Enter job role (e.g., "Project Manager")
   - Enter department (e.g., "Construction")
   - **AI suggestion appears automatically**

2. **Review AI Suggestion**
   - Check confidence % (green = good, yellow = review, orange = caution)
   - Read reasoning text
   - Review security warnings (if any)

3. **Apply or Modify**
   - Click "Apply AI Suggestion" to use as-is
   - OR manually adjust permissions below
   - Click "Save Permissions"

4. **Monitor Quality**
   - Go to Admin → AI Settings → Suggestion Stats
   - View acceptance rate and confidence metrics
   - Review suggestions that were modified

---

## API Reference

### POST /api/ai/suggest-permissions

**Request**:
```json
{
  "userId": "user-uuid",
  "organizationId": "org-uuid",
  "role": "Project Manager",
  "department": "Construction"
}
```

**Response**:
```json
{
  "suggestedRole": "editor",
  "suggestedCapabilities": { "perm_Read": true, ... },
  "confidence": 0.92,
  "reasoning": "Based on 150 similar users...",
  "basedOnUsers": 150,
  "securityWarnings": [...]
}
```

### POST /api/ai/accept-suggestion

**Request**:
```json
{
  "suggestionId": "suggestion-uuid",
  "accepted": true,
  "actualPermissions": { ... }
}
```

---

## Testing

### Run Unit Tests

```bash
cd backend
npm run test:unit -- tests/unit/services/ai/PermissionSuggestionService.test.ts
```

### Run Integration Tests

```bash
cd backend
npm run test:integration -- tests/integration/aiPermissionSuggestion.test.ts
```

---

## Troubleshooting

**AI suggestion not appearing**:
- Check browser console for errors
- Verify Gemini API key is set in backend .env
- Ensure user has `perm_ManageUsers` permission

**Low confidence (<70%)**:
- Not enough historical users with similar role
- System will use rule-based fallback
- Add more users to improve future suggestions

**Slow response (>2s)**:
- First request is uncached (database + AI call)
- Second request should be <500ms (cached)
- Check Gemini API status if persistent

---

## Full Documentation

For complete details, see:
- [AI_PERMISSION_SUGGESTIONS.md](./AI_PERMISSION_SUGGESTIONS.md) - Complete guide
- [IMPLEMENTATION_SUMMARY_AI_PERMISSIONS_2025-11-27.md](./IMPLEMENTATION_SUMMARY_AI_PERMISSIONS_2025-11-27.md) - Implementation details
- [ADR-005 Multi-Tenant Access Control](./ADRs/ADR-005-multi-tenant-access-control/) - Architecture decisions
