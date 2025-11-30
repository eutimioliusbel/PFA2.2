@echo off
REM Batch fix all Prisma relation name mismatches in include statements

echo Fixing Prisma relation names in include/select statements...

REM Define the PowerShell script for replacements
powershell -Command "$files = Get-ChildItem -Path 'src' -Include '*.ts' -Recurse; foreach ($file in $files) { $content = Get-Content $file.FullName -Raw; $content = $content -replace 'apiConfiguration:', 'api_configuration:'; $content = $content -replace 'apiConfigurations:', 'api_configurations:'; $content = $content -replace 'apiServer:', 'api_server:'; $content = $content -replace 'apiServers:', 'api_servers:'; $content = $content -replace 'apiEndpoint:', 'api_endpoint:'; $content = $content -replace 'apiEndpoints:', 'api_endpoints:'; $content = $content -replace 'auditLog:', 'audit_log:'; $content = $content -replace 'auditLogs:', 'audit_logs:'; $content = $content -replace 'userOrganization:', 'user_organization:'; $content = $content -replace 'roleTemplate:', 'role_template:'; $content = $content -replace 'roleTemplates:', 'role_templates:'; $content = $content -replace 'fieldConfiguration:', 'field_configuration:'; $content = $content -replace 'fieldConfigurations:', 'field_configurations:'; $content = $content -replace 'organizationAiConfig:', 'organization_ai_config:'; $content = $content -replace 'organizationAiConfigs:', 'organization_ai_configs:'; $content = $content -replace 'organizationApiCredentials:', 'organization_api_credentials:'; $content = $content -replace 'pfaMirror:', 'pfa_mirror:'; $content = $content -replace 'pfaMirrors:', 'pfa_mirrors:'; $content = $content -replace 'pfaModification:', 'pfa_modification:'; $content = $content -replace 'pfaModifications:', 'pfa_modifications:'; Set-Content -Path $file.FullName -Value $content -NoNewline; Write-Host \"Fixed: $($file.Name)\"; }"

echo.
echo Fixing complete!
echo.
echo Press any key to exit...
pause >nul
