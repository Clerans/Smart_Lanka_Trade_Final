$sourceDir = "c:\Users\micha\OneDrive\Desktop\Personal project\Finall\Smart_Lanka_Trade_Final\backend"
$zipFile = "c:\Users\micha\OneDrive\Desktop\Personal project\Finall\smartlanka-backend.zip"

Write-Host "Packaging SmartLanka Trade Backend..."

if (Test-Path $zipFile) {
    Remove-Item $zipFile -Force
}

$staging = "$env:TEMP\smartlanka-deploy-stage"
if (Test-Path $staging) {
    Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null

robocopy "$sourceDir" "$staging" /E /XD node_modules .git scratch uploads /XF *.log | Out-Null

Compress-Archive -Path "$staging\*" -DestinationPath "$zipFile" -Force
Remove-Item $staging -Recurse -Force

Write-Host "Deployment package created successfully: $zipFile"
