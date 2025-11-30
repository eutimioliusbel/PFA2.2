@echo off
REM Batch fix all Prisma table name mismatches from camelCase to snake_case

echo Fixing Prisma table names in all TypeScript files...

REM Define the PowerShell script for replacements
powershell -Command "$files = Get-ChildItem -Path 'src' -Include '*.ts' -Recurse; foreach ($file in $files) { $content = Get-Content $file.FullName -Raw; $content = $content -replace 'prisma\.apiConfiguration', 'prisma.api_configurations'; $content = $content -replace 'prisma\.apiServer', 'prisma.api_servers'; $content = $content -replace 'prisma\.apiEndpoint', 'prisma.api_endpoints'; $content = $content -replace 'prisma\.auditLog', 'prisma.audit_logs'; $content = $content -replace 'prisma\.userOrganization', 'prisma.user_organizations'; $content = $content -replace 'prisma\.roleTemplate', 'prisma.role_templates'; $content = $content -replace 'prisma\.fieldConfiguration', 'prisma.field_configurations'; $content = $content -replace 'prisma\.organizationAiConfig', 'prisma.organization_ai_configs'; $content = $content -replace 'prisma\.organizationApiCredentials', 'prisma.organization_api_credentials'; Set-Content -Path $file.FullName -Value $content -NoNewline; Write-Host \"Fixed: $($file.Name)\"; }"

echo.
echo Fixing complete!
echo.
echo Press any key to exit...
pause >nul
