# Secrets Management Strategy

## Table of Contents
1. [Overview](#overview)
2. [Development Environment](#development-environment)
3. [Production Environment](#production-environment)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Secret Rotation](#secret-rotation)
6. [Emergency Procedures](#emergency-procedures)

---

## Overview

**Critical Security Principle**: Secrets NEVER belong in code, configuration files, or version control.

### What Are Secrets?

- Database passwords
- JWT signing keys
- AI provider API keys (Gemini, OpenAI, Anthropic)
- PEMS integration credentials
- Encryption keys
- Third-party service API keys
- SSL/TLS certificates and private keys

### Security Tiers

| Tier | Environment | Storage Method | Access Control |
|------|-------------|----------------|----------------|
| **Development** | Local machine | `.env` file (git-ignored) | File system permissions |
| **Staging** | Cloud staging | AWS Secrets Manager / Azure Key Vault | IAM roles, limited access |
| **Production** | Cloud production | AWS Secrets Manager / Azure Key Vault | IAM roles, audit logging |
| **CI/CD** | GitHub Actions / GitLab CI | Encrypted secrets, OIDC federation | Repository secrets, scoped access |

---

## Development Environment

### Setup Process

1. **Initialize Environment File**
   ```bash
   # Copy template
   cp .env.example .env

   # Generate secure passwords
   openssl rand -base64 32  # Database password
   openssl rand -base64 64  # JWT secret
   ```

2. **Configure `.env` File**
   ```bash
   # Edit with your favorite editor
   nano .env

   # Set file permissions (Unix/Linux/Mac)
   chmod 600 .env
   ```

3. **Verify Git Ignore**
   ```bash
   # Check .gitignore contains:
   .env
   .env.local
   .env.*.local
   ```

### Development Best Practices

**DO:**
- Use strong random passwords (minimum 32 characters)
- Keep `.env` file permissions restrictive (`600` on Unix)
- Generate separate secrets for each developer
- Document required environment variables in `.env.example`

**DON'T:**
- Commit `.env` files to Git
- Share `.env` files via email/Slack
- Use production secrets in development
- Hardcode secrets in code or test files

### Local Secrets Storage

**Option 1: `.env` File (Current)**
```bash
# Pros: Simple, widely supported
# Cons: File-based, can be accidentally committed

DATABASE_URL=postgresql://user:password@localhost:5432/pfa_dev
JWT_SECRET=generated_secret_here
```

**Option 2: Direnv (Recommended for Teams)**
```bash
# Install direnv
brew install direnv  # Mac
apt install direnv   # Ubuntu

# Add to ~/.bashrc or ~/.zshrc
eval "$(direnv hook bash)"

# Create .envrc (automatically loaded on cd)
echo 'export DATABASE_URL=postgresql://...' > .envrc
direnv allow .
```

**Option 3: 1Password CLI / Bitwarden CLI**
```bash
# Store secrets in password manager
op read "op://Private/PFA-Dev-DB/password"

# Inject into environment
export DATABASE_URL=$(op read "op://Private/PFA-Dev-DB/url")
```

### Preventing Accidental Commits

**Install Git Secrets (Recommended)**
```bash
# Install
brew install git-secrets  # Mac
# Or from: https://github.com/awslabs/git-secrets

# Configure for repository
cd /path/to/PFA2.2
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'POSTGRES_PASSWORD=.*'
git secrets --add 'JWT_SECRET=.*'
git secrets --add '[A-Za-z0-9+/]{32,}={0,2}'  # Base64 secrets
git secrets --add 'sk-[A-Za-z0-9]{32,}'        # OpenAI keys
```

**Pre-Commit Hooks**
```bash
# Create .git/hooks/pre-commit
#!/bin/bash
if git diff --cached --name-only | grep -E '\.env$'; then
  echo "ERROR: Attempting to commit .env file!"
  echo "Please remove from staging: git reset HEAD .env"
  exit 1
fi

# Check for hardcoded secrets
if git diff --cached | grep -E 'password|secret|api_key' | grep -v '.env.example'; then
  echo "WARNING: Potential secret detected in commit"
  echo "Review carefully before proceeding"
fi
```

---

## Production Environment

### AWS Secrets Manager (Recommended)

**Architecture:**
```
Application (ECS/EC2/Lambda)
    ↓ (IAM Role with GetSecretValue permission)
AWS Secrets Manager
    ├─ pfa-vanguard/production/database/master_password
    ├─ pfa-vanguard/production/auth/jwt_secret
    ├─ pfa-vanguard/production/integrations/gemini_api_key
    ├─ pfa-vanguard/production/integrations/pems_client_secret
    └─ pfa-vanguard/production/encryption/data_key
```

**Setup Steps:**

1. **Create Secrets in AWS Console**
   ```bash
   # Using AWS CLI
   aws secretsmanager create-secret \
     --name pfa-vanguard/production/database/master_password \
     --description "PostgreSQL master password for PFA Vanguard production" \
     --secret-string "$(openssl rand -base64 32)" \
     --tags Key=Environment,Value=production Key=Application,Value=pfa-vanguard
   ```

2. **Grant IAM Permissions**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "secretsmanager:GetSecretValue",
           "secretsmanager:DescribeSecret"
         ],
         "Resource": [
           "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:pfa-vanguard/production/*"
         ]
       }
     ]
   }
   ```

3. **Load Secrets in Application**
   ```typescript
   // backend/src/config/secrets.ts
   import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

   const client = new SecretsManagerClient({ region: 'us-east-1' });

   export async function getSecret(secretName: string): Promise<string> {
     const command = new GetSecretValueCommand({ SecretId: secretName });
     const response = await client.send(command);

     if (!response.SecretString) {
       throw new Error(`Secret ${secretName} has no value`);
     }

     return response.SecretString;
   }

   // Cache secrets to reduce API calls
   const secretCache = new Map<string, { value: string; expires: number }>();
   const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

   export async function getCachedSecret(secretName: string): Promise<string> {
     const cached = secretCache.get(secretName);

     if (cached && cached.expires > Date.now()) {
       return cached.value;
     }

     const value = await getSecret(secretName);
     secretCache.set(secretName, { value, expires: Date.now() + CACHE_TTL });

     return value;
   }
   ```

4. **Initialize Database Connection**
   ```typescript
   // backend/src/config/database.ts
   import { getCachedSecret } from './secrets';

   export async function getDatabaseUrl(): Promise<string> {
     const password = await getCachedSecret('pfa-vanguard/production/database/master_password');
     const host = process.env.RDS_HOSTNAME;
     const port = process.env.RDS_PORT;
     const database = process.env.RDS_DB_NAME;
     const user = process.env.RDS_USERNAME;

     return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public&sslmode=require`;
   }
   ```

**Cost Optimization:**
- Secrets Manager: $0.40/secret/month + $0.05/10,000 API calls
- Cache secrets in application memory (5-minute TTL)
- Use Parameter Store for non-sensitive config (cheaper)

### Azure Key Vault (Alternative)

**Setup:**
```bash
# Create Key Vault
az keyvault create \
  --name pfa-vanguard-vault \
  --resource-group pfa-production \
  --location eastus

# Add secrets
az keyvault secret set \
  --vault-name pfa-vanguard-vault \
  --name database-master-password \
  --value "$(openssl rand -base64 32)"

# Grant access to managed identity
az keyvault set-policy \
  --name pfa-vanguard-vault \
  --object-id <managed-identity-id> \
  --secret-permissions get list
```

**Application Code:**
```typescript
// backend/src/config/azure-secrets.ts
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const credential = new DefaultAzureCredential();
const vaultName = process.env.AZURE_KEYVAULT_NAME;
const vaultUrl = `https://${vaultName}.vault.azure.net`;

const client = new SecretClient(vaultUrl, credential);

export async function getAzureSecret(secretName: string): Promise<string> {
  const secret = await client.getSecret(secretName);
  return secret.value || '';
}
```

### HashiCorp Vault (Self-Hosted Alternative)

**Use Cases:**
- Multi-cloud deployments
- Need for dynamic secrets
- On-premises infrastructure
- Advanced secret rotation policies

**Setup:**
```bash
# Enable KV secrets engine
vault secrets enable -path=pfa-vanguard kv-v2

# Write secrets
vault kv put pfa-vanguard/production/database \
  master_password="$(openssl rand -base64 32)"

# Create policy
vault policy write pfa-production - <<EOF
path "pfa-vanguard/production/*" {
  capabilities = ["read", "list"]
}
EOF

# Assign policy to application role
vault write auth/kubernetes/role/pfa-backend \
  bound_service_account_names=pfa-backend \
  bound_service_account_namespaces=production \
  policies=pfa-production \
  ttl=1h
```

---

## CI/CD Pipeline

### GitHub Actions

**Setup Repository Secrets:**
```bash
# Navigate to: Settings → Secrets and variables → Actions

# Add secrets:
DATABASE_URL_STAGING
DATABASE_URL_PRODUCTION
AWS_ACCESS_KEY_ID (for deployments)
AWS_SECRET_ACCESS_KEY
GEMINI_API_KEY_STAGING
GEMINI_API_KEY_PRODUCTION
```

**Use in Workflow:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires approval

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/github-actions-deploy
          aws-region: us-east-1
          # Uses OIDC federation - no long-lived credentials!

      - name: Run Database Migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PRODUCTION }}
        run: |
          npx prisma migrate deploy

      - name: Deploy Application
        run: |
          # Secrets injected via AWS Secrets Manager
          # No secrets in environment variables!
          aws ecs update-service \
            --cluster pfa-production \
            --service pfa-backend \
            --force-new-deployment
```

**OIDC Federation (Recommended - No Long-Lived Credentials):**
```yaml
# GitHub Actions connects to AWS without access keys
permissions:
  id-token: write
  contents: read

- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::ACCOUNT_ID:role/github-actions-deploy
    aws-region: us-east-1
    # Temporary credentials issued via OIDC trust
```

### GitLab CI

```yaml
# .gitlab-ci.yml
variables:
  AWS_DEFAULT_REGION: us-east-1

deploy-production:
  stage: deploy
  image: amazon/aws-cli:latest
  environment:
    name: production
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com

  before_script:
    # Assume role using OIDC token
    - >
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s"
      $(aws sts assume-role-with-web-identity
      --role-arn ${AWS_ROLE_ARN}
      --role-session-name "gitlab-${CI_PROJECT_ID}-${CI_PIPELINE_ID}"
      --web-identity-token ${GITLAB_OIDC_TOKEN}
      --duration-seconds 3600
      --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]'
      --output text))

  script:
    - aws ecs update-service --cluster pfa-production --service pfa-backend --force-new-deployment
```

### Secret Scanning in CI

**Integrate Trufflehog:**
```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on: [push, pull_request]

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for scanning

      - name: TruffleHog Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --debug --only-verified
```

---

## Secret Rotation

### Automated Rotation Strategy

| Secret Type | Rotation Frequency | Automation | Downtime Required |
|-------------|-------------------|------------|-------------------|
| **Database Password** | 90 days | AWS Secrets Manager auto-rotation | Zero (dual-password support) |
| **JWT Signing Key** | 180 days | Manual with staged rollout | Zero (validate both old and new) |
| **AI API Keys** | As needed (on breach) | Manual | Zero (update and restart) |
| **SSL/TLS Certificates** | 60 days | Let's Encrypt + certbot | Zero (hot reload) |
| **PEMS OAuth Tokens** | 24 hours | Automatic refresh | Zero (token refresh flow) |

### Database Password Rotation

**AWS RDS with Secrets Manager:**
```bash
# Enable automatic rotation
aws secretsmanager rotate-secret \
  --secret-id pfa-vanguard/production/database/master_password \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:ACCOUNT_ID:function:PostgreSQLRotation \
  --rotation-rules AutomaticallyAfterDays=90
```

**Manual Rotation (Zero Downtime):**
```sql
-- Step 1: Create new password
-- Generate: openssl rand -base64 32

-- Step 2: Update database user with new password
ALTER USER pfa_admin WITH PASSWORD 'NEW_PASSWORD_HERE';

-- Step 3: Update secret in Secrets Manager
aws secretsmanager update-secret \
  --secret-id pfa-vanguard/production/database/master_password \
  --secret-string 'NEW_PASSWORD_HERE'

-- Step 4: Restart application (rolling restart - zero downtime)
aws ecs update-service \
  --cluster pfa-production \
  --service pfa-backend \
  --force-new-deployment
```

### JWT Secret Rotation

**Staged Rollout (Zero Downtime):**
```typescript
// backend/src/config/jwt.ts

// Stage 1: Add new secret, validate both old and new
const JWT_SECRETS = [
  process.env.JWT_SECRET_NEW!,  // New secret
  process.env.JWT_SECRET!       // Old secret (fallback)
];

export function verifyToken(token: string): JwtPayload {
  let lastError: Error | null = null;

  // Try each secret in order
  for (const secret of JWT_SECRETS) {
    try {
      return jwt.verify(token, secret) as JwtPayload;
    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }

  throw lastError || new Error('Invalid token');
}

// Stage 2: Issue new tokens with new secret only
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRETS[0], { expiresIn: '7d' });
}

// Stage 3 (after 7 days): Remove old secret from array
// Stage 4: Remove JWT_SECRET from environment variables
```

### API Key Rotation

**Gemini / OpenAI / Anthropic:**
```bash
# Step 1: Generate new API key from provider dashboard

# Step 2: Update secret in Secrets Manager
aws secretsmanager update-secret \
  --secret-id pfa-vanguard/production/integrations/gemini_api_key \
  --secret-string 'NEW_API_KEY'

# Step 3: Restart application (cached secrets expire in 5 minutes)
# Or force cache clear:
curl -X POST https://api.pfa-vanguard.com/admin/clear-secret-cache \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Step 4: Verify new key works
curl -X POST https://api.pfa-vanguard.com/api/ai/chat \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{"message":"Test"}'

# Step 5: Revoke old key from provider dashboard
```

### Rotation Checklist

**Before Rotation:**
- [ ] Schedule maintenance window (or verify zero-downtime strategy)
- [ ] Notify team of rotation
- [ ] Backup current secrets
- [ ] Test rotation in staging environment
- [ ] Prepare rollback procedure

**During Rotation:**
- [ ] Generate new secret
- [ ] Update Secrets Manager / Key Vault
- [ ] Restart application (rolling restart)
- [ ] Verify application health
- [ ] Monitor error rates

**After Rotation:**
- [ ] Confirm old credentials no longer work
- [ ] Update documentation
- [ ] Update runbooks
- [ ] Log rotation in audit trail
- [ ] Schedule next rotation

---

## Emergency Procedures

### Scenario 1: Secret Accidentally Committed to Git

**IMMEDIATE ACTIONS:**
```bash
# 1. Revoke the compromised secret IMMEDIATELY
# - Rotate database password
# - Regenerate API keys
# - Invalidate JWT tokens

# 2. Remove from Git history (if recently committed)
git reset HEAD~1  # If not pushed yet
# OR
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/.env" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Force push (if already pushed - coordinate with team!)
git push origin --force --all
git push origin --force --tags

# 4. Use BFG Repo Cleaner (more robust)
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# 5. Contact GitHub support to purge from cache
# https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
```

**FOLLOW-UP:**
- Audit access logs for unauthorized access
- Invalidate all active sessions
- Force re-authentication for all users
- Document incident in security log
- Review Git practices with team

### Scenario 2: Secrets Manager Outage

**Fallback Strategy:**
```typescript
// backend/src/config/secrets-resilient.ts

// Cached secrets survive Secrets Manager outage
const PERSISTENT_CACHE_PATH = '/tmp/secrets-cache.enc';

export async function getSecretWithFallback(secretName: string): Promise<string> {
  try {
    // Try Secrets Manager first
    const value = await getSecret(secretName);
    await saveToPersistentCache(secretName, value);
    return value;
  } catch (error) {
    console.error('Secrets Manager unavailable, using cached secret');

    // Fall back to encrypted cache
    const cached = await loadFromPersistentCache(secretName);
    if (cached) {
      return cached;
    }

    throw new Error(`Secret ${secretName} not available and no cache exists`);
  }
}

async function saveToPersistentCache(key: string, value: string): Promise<void> {
  // Encrypt with KMS or local encryption key
  const encrypted = await encrypt(value);
  await fs.writeFile(`${PERSISTENT_CACHE_PATH}/${key}`, encrypted);
}
```

### Scenario 3: Database Credentials Compromised

**Response Plan:**
```bash
# 1. IMMEDIATE: Revoke compromised credentials
psql -h RDS_ENDPOINT -U postgres -c "REVOKE ALL ON DATABASE pfa_vanguard_prod FROM pfa_admin;"

# 2. Create new database user
psql -h RDS_ENDPOINT -U postgres <<EOF
CREATE USER pfa_admin_new WITH PASSWORD 'NEW_SECURE_PASSWORD';
GRANT ALL ON DATABASE pfa_vanguard_prod TO pfa_admin_new;
GRANT ALL ON SCHEMA public TO pfa_admin_new;
EOF

# 3. Update Secrets Manager
aws secretsmanager update-secret \
  --secret-id pfa-vanguard/production/database/master_password \
  --secret-string 'NEW_SECURE_PASSWORD'

# 4. Update RDS_USERNAME in application environment
# 5. Rolling restart of application

# 6. Audit database logs
aws rds download-db-log-file-portion \
  --db-instance-identifier pfa-production \
  --log-file-name error/postgresql.log.2024-11-25-00 \
  --output text | grep "FATAL\|ERROR"

# 7. Drop old user after confirming new user works
psql -h RDS_ENDPOINT -U postgres -c "DROP USER pfa_admin;"
```

### Scenario 4: Mass Secret Exposure (Worst Case)

**Nuclear Option - Complete Reset:**
```bash
# 1. Take application offline
aws ecs update-service --cluster pfa-production --service pfa-backend --desired-count 0

# 2. Rotate ALL secrets
./scripts/emergency-rotate-all-secrets.sh

# 3. Invalidate all JWT tokens (bump JWT_VERSION)
# 4. Force logout all users
# 5. Audit all database activity in past 24 hours
# 6. Notify security team and stakeholders
# 7. Bring application back online after verification
# 8. Conduct post-incident review
```

---

## Compliance and Audit

### Audit Logging

**Enable CloudTrail for Secrets Manager:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": "secretsmanager:*",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "ACCOUNT_ID"
        }
      }
    }
  ]
}
```

**Query Secret Access:**
```bash
# Who accessed which secrets?
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::SecretsManager::Secret \
  --start-time 2024-11-01 \
  --end-time 2024-11-30

# Export to JSON for analysis
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetSecretValue \
  --max-results 50 \
  --output json > secret-access-audit.json
```

### Compliance Requirements

**SOC 2 Type II:**
- [ ] Secrets stored in approved secrets management system
- [ ] Access logs retained for 1 year
- [ ] Secrets rotated every 90 days
- [ ] Least privilege access enforced

**GDPR:**
- [ ] Encryption at rest and in transit
- [ ] Access controls documented
- [ ] Data breach notification plan

**HIPAA (if handling health data):**
- [ ] Secrets encrypted with FIPS 140-2 validated encryption
- [ ] Access audit logs
- [ ] Automatic logoff after 15 minutes

---

## Tooling and Automation

### Recommended Tools

**Secret Detection:**
- [git-secrets](https://github.com/awslabs/git-secrets) - Pre-commit hooks
- [trufflehog](https://github.com/trufflesecurity/trufflehog) - Deep scanning
- [detect-secrets](https://github.com/Yelp/detect-secrets) - Baseline tracking

**Secret Management:**
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [Azure Key Vault](https://azure.microsoft.com/en-us/services/key-vault/)
- [HashiCorp Vault](https://www.vaultproject.io/)
- [Doppler](https://www.doppler.com/) - Developer-friendly secrets sync

**CI/CD Integration:**
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [GitLab CI with Vault](https://docs.gitlab.com/ee/ci/secrets/)

### Automation Scripts

**Daily Secret Health Check:**
```bash
#!/bin/bash
# scripts/check-secret-health.sh

echo "Checking secret health..."

# Check for secrets older than 90 days
aws secretsmanager list-secrets --query "SecretList[?LastRotatedDate < \`$(date -d '90 days ago' -Iseconds)\`]"

# Check for unused secrets
aws secretsmanager list-secrets --query "SecretList[?LastAccessedDate < \`$(date -d '30 days ago' -Iseconds)\`]"

# Verify all required secrets exist
REQUIRED_SECRETS=(
  "pfa-vanguard/production/database/master_password"
  "pfa-vanguard/production/auth/jwt_secret"
  "pfa-vanguard/production/integrations/gemini_api_key"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
  aws secretsmanager describe-secret --secret-id "$secret" || echo "MISSING: $secret"
done
```

---

## Quick Reference

### Development
```bash
# Generate secure password
openssl rand -base64 32

# Check for committed secrets
git secrets --scan

# Load environment variables
source .env
```

### Production
```bash
# Get secret from AWS
aws secretsmanager get-secret-value --secret-id NAME --query SecretString --output text

# Rotate secret
aws secretsmanager rotate-secret --secret-id NAME

# Update secret
aws secretsmanager update-secret --secret-id NAME --secret-string VALUE
```

### Emergency
```bash
# Revoke compromised database password
psql -c "ALTER USER username WITH PASSWORD 'new_password';"

# Invalidate all JWT tokens
# Bump JWT_VERSION environment variable and restart

# Force user logout
# Clear Redis session store or set invalidation flag
```

---

## Additional Resources

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [12-Factor App: Config](https://12factor.net/config)
- [CIS Benchmark for Secrets Management](https://www.cisecurity.org/benchmark/)

---

**Document Version**: 1.0
**Last Updated**: 2024-11-25
**Owner**: DevSecOps Team
