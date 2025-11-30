# PostgreSQL SSL/TLS Configuration

## Overview

This directory contains SSL/TLS certificates and configuration for securing PostgreSQL connections.

## Quick Start (Development)

### Generate Self-Signed Certificates

```bash
cd database/ssl
chmod +x generate-ssl-certs.sh
./generate-ssl-certs.sh
```

This creates:
- `server.key` - Server private key (keep secure!)
- `server.crt` - Server certificate
- `ca-cert.pem` - Certificate Authority certificate

### Start PostgreSQL with SSL

```bash
# From project root
docker-compose up -d postgres
```

### Connect with SSL

```bash
# Command line
psql "postgresql://pfa_admin:password@localhost:5432/pfa_vanguard_dev?sslmode=require"

# Connection string in .env
DATABASE_URL=postgresql://pfa_admin:password@localhost:5432/pfa_vanguard_dev?sslmode=require
```

## SSL Modes

PostgreSQL supports different SSL modes for connection security:

| Mode | Description | Client Cert Required | Security Level |
|------|-------------|----------------------|----------------|
| `disable` | No SSL | No | None |
| `allow` | SSL if available | No | Low |
| `prefer` | SSL preferred, falls back to non-SSL | No | Low |
| `require` | SSL required, no certificate verification | No | Medium |
| `verify-ca` | SSL required, verify server certificate | No | High |
| `verify-full` | SSL required, verify server cert + hostname | No | Highest |

### Development: `sslmode=prefer` (Default)

```
DATABASE_URL=postgresql://user:pass@localhost:5432/db?sslmode=prefer
```

- SSL used if server supports it
- Falls back to non-SSL
- Good for local development

### Staging: `sslmode=require`

```
DATABASE_URL=postgresql://user:pass@staging-db:5432/db?sslmode=require
```

- SSL connection mandatory
- No certificate verification (trusts any cert)
- Protects against passive eavesdropping

### Production: `sslmode=verify-full`

```
DATABASE_URL=postgresql://user:pass@prod-db:5432/db?sslmode=verify-full&sslrootcert=/path/to/ca-cert.pem
```

- SSL connection mandatory
- Verifies server certificate is signed by trusted CA
- Verifies hostname matches certificate CN
- Protects against man-in-the-middle attacks

## Production Setup

### Option 1: AWS RDS (Managed Certificates)

AWS RDS provides SSL certificates automatically.

**Download RDS Root Certificate:**
```bash
curl -o rds-ca-2019-root.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

**Connection String:**
```
DATABASE_URL=postgresql://user:pass@instance.region.rds.amazonaws.com:5432/db?sslmode=verify-full&sslrootcert=./rds-ca-2019-root.pem
```

**Environment Variables:**
```bash
# .env.production
RDS_HOSTNAME=pfa-prod.xxxxx.us-east-1.rds.amazonaws.com
RDS_PORT=5432
RDS_DB_NAME=pfa_vanguard_prod
RDS_USERNAME=pfa_admin
RDS_PASSWORD=stored_in_secrets_manager
RDS_SSL_ROOT_CERT=/app/ssl/rds-ca-2019-root.pem

DATABASE_URL=postgresql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_HOSTNAME}:${RDS_PORT}/${RDS_DB_NAME}?sslmode=verify-full&sslrootcert=${RDS_SSL_ROOT_CERT}
```

### Option 2: Let's Encrypt (Self-Hosted)

For self-hosted PostgreSQL with Let's Encrypt certificates.

**Generate Certificates with Certbot:**
```bash
# Install certbot
apt-get install certbot

# Generate certificate
certbot certonly --standalone -d postgres.your-domain.com

# Certificates saved to:
# /etc/letsencrypt/live/postgres.your-domain.com/fullchain.pem
# /etc/letsencrypt/live/postgres.your-domain.com/privkey.pem
```

**Configure PostgreSQL:**
```bash
# postgresql.conf
ssl = on
ssl_cert_file = '/etc/letsencrypt/live/postgres.your-domain.com/fullchain.pem'
ssl_key_file = '/etc/letsencrypt/live/postgres.your-domain.com/privkey.pem'
ssl_ca_file = '/etc/letsencrypt/live/postgres.your-domain.com/chain.pem'
```

**Auto-Renewal:**
```bash
# Add cron job
0 3 * * * certbot renew --quiet --post-hook "pg_ctl reload"
```

### Option 3: Commercial CA (DigiCert, GlobalSign)

**Steps:**
1. Generate CSR on PostgreSQL server
2. Submit CSR to CA
3. Receive signed certificate
4. Install certificate on server

**Generate CSR:**
```bash
openssl req -new -key server.key -out server.csr -subj "/C=US/ST=State/L=City/O=Company/CN=postgres.your-domain.com"
```

**Submit CSR to CA and receive:**
- Server certificate (server.crt)
- Intermediate certificates (intermediate.crt)
- Root certificate (root.crt)

**Install on PostgreSQL:**
```bash
# Combine certificates
cat server.crt intermediate.crt > fullchain.crt

# Configure PostgreSQL
ssl = on
ssl_cert_file = '/path/to/fullchain.crt'
ssl_key_file = '/path/to/server.key'
ssl_ca_file = '/path/to/root.crt'
```

## Client-Side Certificate Authentication (Mutual TLS)

For maximum security, require clients to present certificates.

### Generate Client Certificate

```bash
# Generate client private key
openssl genrsa -out client.key 2048

# Generate client CSR
openssl req -new -key client.key -out client.csr -subj "/CN=pfa_admin"

# Sign with CA
openssl x509 -req -in client.csr -CA ca-cert.pem -CAkey ca-key.pem -out client.crt -days 365
```

### Configure PostgreSQL to Require Client Certs

```bash
# pg_hba.conf
hostssl all all 0.0.0.0/0 cert clientcert=verify-full
```

### Connect with Client Certificate

```bash
psql "postgresql://pfa_admin@localhost:5432/pfa_vanguard_dev?sslmode=verify-full&sslcert=./client.crt&sslkey=./client.key&sslrootcert=./ca-cert.pem"
```

**Connection String:**
```
DATABASE_URL=postgresql://pfa_admin@localhost:5432/db?sslmode=verify-full&sslcert=/path/to/client.crt&sslkey=/path/to/client.key&sslrootcert=/path/to/ca-cert.pem
```

## Troubleshooting

### Connection Refused (SSL Required)

**Error:**
```
FATAL: no pg_hba.conf entry for host "x.x.x.x", user "user", database "db", SSL off
```

**Fix:** Add `?sslmode=require` to connection string

### Certificate Verification Failed

**Error:**
```
FATAL: root certificate file "/path/to/ca-cert.pem" does not exist
```

**Fix:** Provide correct path to CA certificate
```
DATABASE_URL=...&sslrootcert=/correct/path/to/ca-cert.pem
```

### Self-Signed Certificate Not Trusted

**Error:**
```
FATAL: SSL error: certificate verify failed
```

**Fix for Development:**
```
DATABASE_URL=...&sslmode=require  # Don't verify cert
```

**Fix for Production:** Use certificate from trusted CA

### Hostname Verification Failed

**Error:**
```
FATAL: SSL error: certificate common name does not match host name
```

**Fix:** Ensure certificate CN matches database hostname, or use `sslmode=verify-ca` instead of `verify-full`

## Security Best Practices

### Development
- ✅ Use self-signed certificates (acceptable)
- ✅ Use `sslmode=prefer` or `require`
- ✅ Keep private keys in `.gitignore`

### Staging
- ✅ Use certificates from trusted CA
- ✅ Use `sslmode=require` minimum
- ✅ Test certificate renewal process

### Production
- ✅ MUST use certificates from trusted CA
- ✅ MUST use `sslmode=verify-full`
- ✅ Automate certificate renewal
- ✅ Monitor certificate expiration
- ✅ Use certificate pinning for critical connections
- ✅ Consider mutual TLS for admin connections

## Certificate Renewal

### Check Certificate Expiration

```bash
# Check server certificate
openssl x509 -in server.crt -noout -enddate

# Check from client
echo | openssl s_client -connect localhost:5432 -starttls postgres 2>/dev/null | openssl x509 -noout -dates
```

### Renewal Process (Zero Downtime)

```bash
# 1. Generate new certificate (same steps as initial setup)
./generate-ssl-certs.sh

# 2. Backup old certificates
mv server.key server.key.old
mv server.crt server.crt.old

# 3. Install new certificates
cp new-server.key server.key
cp new-server.crt server.crt
chmod 600 server.key

# 4. Reload PostgreSQL (no restart needed!)
psql -c "SELECT pg_reload_conf();"
# Or: pg_ctl reload
```

### Automated Renewal Monitoring

```bash
#!/bin/bash
# check-cert-expiry.sh

CERT_FILE="/path/to/server.crt"
EXPIRY_DATE=$(openssl x509 -in "$CERT_FILE" -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
  echo "WARNING: Certificate expires in $DAYS_UNTIL_EXPIRY days!"
  # Send alert email
  echo "Certificate expiring soon" | mail -s "PostgreSQL Cert Expiry" admin@company.com
fi
```

## Files in This Directory

| File | Description | Commit to Git? |
|------|-------------|----------------|
| `generate-ssl-certs.sh` | Certificate generation script | ✅ Yes |
| `README.md` | This file | ✅ Yes |
| `ca-cert.pem` | CA certificate (public) | ✅ Yes |
| `server.crt` | Server certificate (public) | ✅ Yes |
| `server.key` | Server private key | ❌ NO - in .gitignore |
| `ca-key.pem` | CA private key | ❌ NO - in .gitignore |
| `client.key` | Client private key | ❌ NO - in .gitignore |

## Additional Resources

- [PostgreSQL SSL Documentation](https://www.postgresql.org/docs/current/ssl-tcp.html)
- [AWS RDS SSL/TLS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [OpenSSL Certificate Commands](https://www.openssl.org/docs/man1.1.1/man1/openssl-x509.html)

---

**Last Updated:** 2024-11-25
