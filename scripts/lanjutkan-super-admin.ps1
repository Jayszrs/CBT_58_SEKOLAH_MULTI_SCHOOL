$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskTools = Join-Path $env:LOCALAPPDATA 'CBT58-Tools'
$taskNodeDirectory = Join-Path $taskTools 'node-v22.16.0-win-x64'
$taskNode = Join-Path $taskNodeDirectory 'node.exe'
if (-not (Test-Path -LiteralPath $taskNode)) {
  throw 'Runtime Node belum tersedia. Pasang Node.js, lalu jalankan node scripts/provision-central-admin.mjs --execute.'
}
$env:PATH = $taskNodeDirectory + ';' + (Join-Path $env:APPDATA 'npm') + ';' + $env:PATH
Set-Location -LiteralPath $taskRoot
$taskClasp = Join-Path $env:APPDATA 'npm/node_modules/@google/clasp/build/src/index.js'
if (-not (Test-Path -LiteralPath $taskClasp)) { throw 'Google clasp belum terpasang.' }
$taskAccounts = Get-Content -LiteralPath (Join-Path $taskRoot 'config/accounts.json') -Raw | ConvertFrom-Json
$taskEmails = @('dimazunj14@gmail.com') + @($taskAccounts | Where-Object { $_.role -eq 'OPERASIONAL' -and $_.email -ne 'dimazunj14@gmail.com' } | ForEach-Object { $_.email })
foreach ($taskEmail in $taskEmails) {
  & $taskNode (Join-Path $PSScriptRoot 'check-owner-auth.mjs') $taskEmail
  if ($LASTEXITCODE -eq 0) { continue }
  Write-Host "Login akun pemilik: $taskEmail"
  & $taskNode (Join-Path $PSScriptRoot 'login-school-owner.mjs') $taskEmail
  if ($LASTEXITCODE -ne 0) { throw "Login $taskEmail belum berhasil." }
  & $taskNode (Join-Path $PSScriptRoot 'check-owner-auth.mjs') $taskEmail
  if ($LASTEXITCODE -ne 0) { throw "Akun yang dipilih tidak sesuai $taskEmail." }
}
& $taskNode (Join-Path $PSScriptRoot 'provision-central-admin.mjs') --execute
if ($LASTEXITCODE -ne 0) { throw 'Pemasangan belum selesai. Lihat reports/central-admin-provisioning.json.' }
