#!/bin/bash
# Setup AWS Secrets Manager for PEMS Credentials
# ADR-008 - P0-2 Security Fix Implementation
#
# This script creates AWS Secrets Manager secrets for each organization's PEMS credentials
# Requires: AWS CLI configured with appropriate IAM permissions

set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
SECRET_PREFIX="pfa-vanguard/pems"

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== PFA Vanguard - AWS Secrets Manager Setup ===${NC}\n"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI not found. Please install AWS CLI first.${NC}"
    exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}ERROR: AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓${NC} AWS Account: ${AWS_ACCOUNT_ID}"
echo -e "${GREEN}✓${NC} Region: ${AWS_REGION}\n"

# Function to create secret
create_secret() {
    local org_id=$1
    local org_name=$2
    local pems_url=$3

    local secret_name="${SECRET_PREFIX}/${org_id}"

    echo -e "${YELLOW}Setting up secret for ${org_name}...${NC}"

    # Prompt for credentials
    echo "Enter PEMS API URL [${pems_url}]:"
    read -r api_url
    api_url=${api_url:-$pems_url}

    echo "Enter PEMS API Key (leave blank to skip):"
    read -rs api_key
    echo

    echo "Enter PEMS Username:"
    read -r username

    echo "Enter PEMS Password:"
    read -rs password
    echo

    # Create secret JSON
    secret_value=$(cat <<EOF
{
  "apiUrl": "${api_url}",
  "apiKey": "${api_key}",
  "username": "${username}",
  "password": "${password}"
}
EOF
)

    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "${secret_name}" --region "${AWS_REGION}" &> /dev/null; then
        echo -e "${YELLOW}Secret already exists. Updating...${NC}"
        aws secretsmanager put-secret-value \
            --secret-id "${secret_name}" \
            --secret-string "${secret_value}" \
            --region "${AWS_REGION}" \
            > /dev/null
        echo -e "${GREEN}✓${NC} Updated: ${secret_name}\n"
    else
        echo -e "${YELLOW}Creating new secret...${NC}"
        aws secretsmanager create-secret \
            --name "${secret_name}" \
            --description "PEMS API credentials for ${org_name}" \
            --secret-string "${secret_value}" \
            --region "${AWS_REGION}" \
            > /dev/null
        echo -e "${GREEN}✓${NC} Created: ${secret_name}\n"
    fi
}

# Setup secrets for each organization
echo -e "${GREEN}=== Organization: RIO (Rio Tinto) ===${NC}"
create_secret "org-rio" "Rio Tinto" "https://us1.eam.hxgnsmartcloud.com:443/axis/restservices"

echo -e "${GREEN}=== Organization: PORTARTHUR (Port Arthur) ===${NC}"
create_secret "org-portarthur" "Port Arthur" "https://us1.eam.hxgnsmartcloud.com:443/axis/restservices"

# Create IAM policy template
echo -e "${YELLOW}Creating IAM policy template...${NC}"

cat > /tmp/pfa-secrets-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowGetPemsSecrets",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${SECRET_PREFIX}/*"
    }
  ]
}
EOF

echo -e "${GREEN}✓${NC} IAM policy template saved to: /tmp/pfa-secrets-policy.json\n"

# Summary
echo -e "${GREEN}=== Setup Complete ===${NC}\n"
echo "Secrets created:"
echo "  - ${SECRET_PREFIX}/org-rio"
echo "  - ${SECRET_PREFIX}/org-portarthur"
echo ""
echo "Next steps:"
echo "  1. Attach IAM policy to EC2/ECS role (template at /tmp/pfa-secrets-policy.json)"
echo "  2. Update backend services to use SecretsService"
echo "  3. Remove PEMS credentials from .env file"
echo "  4. Test in staging environment"
echo ""
echo -e "${YELLOW}WARNING: Do NOT commit PEMS credentials to git${NC}"
echo -e "${YELLOW}WARNING: Rotate secrets regularly (recommended: 90 days)${NC}"
