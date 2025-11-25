#!/bin/bash
#
# PostgreSQL SSL Certificate Generation Script
#
# This script generates self-signed SSL certificates for PostgreSQL development.
# For production, use certificates from a trusted CA (Let's Encrypt, DigiCert, etc.)
#
# Usage: ./generate-ssl-certs.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}"

echo "==================================================================="
echo "PostgreSQL SSL Certificate Generation"
echo "==================================================================="
echo ""
echo "Target directory: ${CERT_DIR}"
echo ""

# Generate private key for Certificate Authority (CA)
echo "[1/6] Generating CA private key..."
openssl genrsa -out "${CERT_DIR}/ca-key.pem" 4096

# Generate CA certificate
echo "[2/6] Generating CA certificate..."
openssl req -new -x509 -days 3650 -key "${CERT_DIR}/ca-key.pem" -out "${CERT_DIR}/ca-cert.pem" \
  -subj "/C=US/ST=State/L=City/O=PFA Vanguard/OU=Development/CN=PFA Root CA"

# Generate server private key
echo "[3/6] Generating server private key..."
openssl genrsa -out "${CERT_DIR}/server.key" 2048

# Generate server certificate signing request (CSR)
echo "[4/6] Generating server CSR..."
openssl req -new -key "${CERT_DIR}/server.key" -out "${CERT_DIR}/server.csr" \
  -subj "/C=US/ST=State/L=City/O=PFA Vanguard/OU=Development/CN=postgres"

# Sign server certificate with CA
echo "[5/6] Signing server certificate..."
openssl x509 -req -in "${CERT_DIR}/server.csr" -CA "${CERT_DIR}/ca-cert.pem" \
  -CAkey "${CERT_DIR}/ca-key.pem" -CAcreateserial -out "${CERT_DIR}/server.crt" -days 365

# Set appropriate permissions
echo "[6/6] Setting file permissions..."
chmod 600 "${CERT_DIR}/server.key"
chmod 644 "${CERT_DIR}/server.crt"
chmod 644 "${CERT_DIR}/ca-cert.pem"

echo ""
echo "==================================================================="
echo "SSL Certificates Generated Successfully"
echo "==================================================================="
echo ""
echo "Generated files:"
echo "  - ca-cert.pem      (CA Certificate - distribute to clients)"
echo "  - ca-key.pem       (CA Private Key - keep secure!)"
echo "  - server.key       (Server Private Key)"
echo "  - server.crt       (Server Certificate)"
echo "  - server.csr       (Server CSR - can be deleted)"
echo ""
echo "Next steps:"
echo "  1. Copy server.key and server.crt to PostgreSQL data directory"
echo "  2. Update postgresql.conf to enable SSL"
echo "  3. Distribute ca-cert.pem to clients for verification"
echo ""
echo "For Docker: These files will be mounted automatically."
echo ""
echo "SECURITY WARNING:"
echo "  - These are SELF-SIGNED certificates for DEVELOPMENT only"
echo "  - For PRODUCTION, use certificates from a trusted CA"
echo "  - Never commit private keys to version control"
echo ""
echo "==================================================================="

# Clean up CSR (no longer needed)
rm -f "${CERT_DIR}/server.csr"

# Create .gitignore to protect private keys
cat > "${CERT_DIR}/.gitignore" <<EOF
# Private keys - NEVER commit
*.key
*.pem
ca-key.pem

# Only certificate files can be committed (public info)
!ca-cert.pem
!server.crt
EOF

echo "Created .gitignore to protect private keys"
echo ""
