# User Documentation

**Last Updated:** 2025-11-25
**Status:** Current

> **Purpose**: End-user and administrator guides for using PFA Vanguard. Written for non-technical users managing construction equipment forecasts.

---

## 📖 Available Documentation

| Document | Purpose | Audience | Status |
|----------|---------|----------|--------|
| **[USER_GUIDE.md](./USER_GUIDE.md)** | End-user instructions for daily operations | Project Managers, Analysts | 📋 Planned |
| **[TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)** | Common issues and solutions | All Users | 📋 Planned |
| **ADMIN_GUIDE.md** | Administrator manual for system management | System Admins | 📋 Planned |

---

## 🎯 Documentation By Role

### Project Manager (PM)

**Primary Tasks**:
- View and filter equipment forecasts
- Adjust forecast dates via drag-and-drop
- Run bulk operations (shift dates, change DOR)
- Analyze variance (Plan vs. Forecast vs. Actual)
- Export data to Excel

**Relevant Sections**:
- USER_GUIDE.md: Timeline View, Matrix View, KPI Board
- TROUBLESHOOTING_GUIDE.md: Common PM issues

---

### Financial Analyst

**Primary Tasks**:
- Review cost variance (over/under budget)
- Analyze monthly cost breakdown
- Identify funds transferable equipment
- Generate financial reports

**Relevant Sections**:
- USER_GUIDE.md: KPI Board, Matrix View, Export
- TROUBLESHOOTING_GUIDE.md: Cost calculation issues

---

### System Administrator

**Primary Tasks**:
- Manage users and organizations
- Configure PEMS API connections
- Monitor sync operations
- Manage data source mappings
- Handle system configuration

**Relevant Sections**:
- ADMIN_GUIDE.md: All sections
- ../backend/SECRETS_MANAGEMENT.md: Credential management
- TROUBLESHOOTING_GUIDE.md: Admin troubleshooting

---

## 📚 Planned Documentation Structure

### USER_GUIDE.md (Planned)

**Contents**:
1. **Getting Started**
   - Login and authentication
   - Organization switching
   - Interface overview

2. **Viewing Equipment Data**
   - Timeline Lab (Gantt chart)
   - Matrix View (month breakdown)
   - Grid Lab (tabular view)
   - KPI Board (variance dashboard)

3. **Filtering Data**
   - Category, class, and DOR filters
   - Date range filters
   - Status filters (Forecast, Actuals, Discontinued)
   - Focus mode

4. **Editing Forecasts**
   - Drag-and-drop timeline bars
   - Inline editing in Grid Lab
   - Sandbox mode (experiment without saving)
   - Undo/redo changes

5. **Bulk Operations**
   - Shift dates (weather delays, schedule changes)
   - Adjust duration (extend/shorten rentals)
   - Change DOR (budget code reassignment)
   - Reset to Plan (revert changes)

6. **Analyzing Variance**
   - Understanding Plan vs. Forecast vs. Actual
   - KPI Board metrics
   - Over/under budget indicators
   - Funds transferable equipment

7. **Exporting Data**
   - Excel export configuration
   - Field selection and ordering
   - Export filtered vs. all data

8. **AI Assistant**
   - Natural language queries
   - Voice mode (speech-to-text)
   - Confirmation for mutations

---

### TROUBLESHOOTING_GUIDE.md (Planned)

**Contents**:
1. **Login & Authentication Issues**
   - Forgot password
   - Account locked
   - Session expired

2. **Data Not Appearing**
   - Filters hiding data
   - Organization context
   - Sync issues

3. **Performance Issues**
   - Slow timeline rendering
   - Large dataset filtering
   - Browser compatibility

4. **Drag-and-Drop Issues**
   - Can't drag timeline bars
   - Changes not saving
   - Undo/redo not working

5. **Export Issues**
   - Excel export failing
   - Missing columns
   - Incorrect data

6. **Cost Calculation Issues**
   - Incorrect totals
   - Rental vs. Purchase confusion
   - DOR classification

7. **Common Error Messages**
   - "Invalid credentials"
   - "Session expired"
   - "Sync failed"
   - "Network error"

---

### ADMIN_GUIDE.md (Planned)

**Contents**:
1. **User Management**
   - Creating users
   - Assigning roles (admin, user, viewer)
   - Managing permissions
   - Organization assignments

2. **Organization Management**
   - Creating organizations
   - Organization settings
   - AI rules configuration

3. **API Configuration**
   - PEMS API setup
   - AI provider configuration
   - Data source mappings
   - Priority and fallback settings

4. **PEMS Sync Operations**
   - Manual sync triggers
   - Sync progress monitoring
   - Sync error handling
   - Sync statistics

5. **System Configuration**
   - Global settings
   - AI global rules
   - Field mappings
   - Export configurations

6. **Database Management**
   - Backup and restore
   - Data cleanup utilities
   - Performance monitoring

7. **Security & Secrets**
   - Managing API keys
   - Credential rotation
   - Access logs
   - Audit trails

---

## 🔍 Quick Help Topics

### Common Questions

**Q: How do I filter equipment by category?**
A: See USER_GUIDE.md Section 3 - Filtering Data

**Q: Can I drag multiple timeline bars at once?**
A: Yes! Select multiple rows in Grid Lab, then drag any bar. See USER_GUIDE.md Section 4 - Editing Forecasts

**Q: What's the difference between Plan, Forecast, and Actual?**
A: See USER_GUIDE.md Section 6 - Analyzing Variance

**Q: How do I export data to Excel?**
A: See USER_GUIDE.md Section 7 - Exporting Data

**Q: Why can't I sync with PEMS?**
A: See TROUBLESHOOTING_GUIDE.md Section 2 - Data Not Appearing, or ADMIN_GUIDE.md Section 4 - PEMS Sync Operations

---

## 🎓 Training Materials

### Quick Start (5 minutes)

1. **Login**: Use your credentials at the login screen
2. **Select Organization**: Choose your project from the dropdown
3. **View Timeline**: See all equipment on the Gantt chart
4. **Filter Data**: Use Filter Panel to reduce to relevant equipment
5. **Adjust Forecast**: Drag timeline bars to new dates
6. **Save Changes**: Click "Submit Changes" to commit

### Video Tutorials (Planned)

- [ ] Introduction to PFA Vanguard (10 min)
- [ ] Timeline View Walkthrough (5 min)
- [ ] Bulk Operations Tutorial (8 min)
- [ ] Variance Analysis Guide (7 min)
- [ ] Admin Console Overview (12 min)

---

## 🔗 Related Documentation

**For End Users**:
- **[../../README.md](../../README.md)** - Project overview and quick start
- **[../../CLAUDE.md](../../CLAUDE.md)** - Domain concepts (PFA, DOR, etc.)

**For Administrators**:
- **[../backend/SECRETS_MANAGEMENT.md](../backend/SECRETS_MANAGEMENT.md)** - Credential management
- **[../backend/API_REFERENCE.md](../backend/API_REFERENCE.md)** - API documentation
- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** - System architecture

**For Support Teams**:
- **[../DEVELOPMENT_LOG.md](../DEVELOPMENT_LOG.md)** - Known issues and technical debt
- **[../ARCHITECTURE.md Section 13](../ARCHITECTURE.md#13-known-issues--technical-debt)** - Known bugs

---

## 📝 Contributing

When creating user documentation:

1. **Write for Non-Technical Users**: Avoid jargon, explain domain terms
2. **Use Screenshots**: Visual guides help users understand
3. **Step-by-Step Instructions**: Number each step clearly
4. **Include Examples**: Show realistic use cases
5. **Test with Users**: Have actual users review before publishing

**Tone Guidelines**:
- ✅ Clear, concise, friendly
- ✅ Active voice ("Click the button" not "The button should be clicked")
- ✅ Explain why, not just how
- ❌ Technical jargon without explanation
- ❌ Assuming prior knowledge

---

## 🐛 Reporting Issues

**For Users**: Email support@pfavanguard.com or contact your system administrator

**For Administrators**: See [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) or create a GitHub issue

---

**Questions?** See [DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md) or [docs/README.md](../README.md)
