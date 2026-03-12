param(
  [Parameter(Mandatory = $false)]
  [string]$CN = "localhost"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
$sslDir = Join-Path $root "infra\\nginx\\ssl"
New-Item -ItemType Directory -Force -Path $sslDir | Out-Null

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name. Install OpenSSL (or run the .sh script on Linux)."
  }
}

Assert-Command "openssl"

$certPath = Join-Path $sslDir "cert.pem"
$keyPath = Join-Path $sslDir "key.pem"

& openssl req `
  -x509 `
  -newkey rsa:2048 `
  -sha256 `
  -days 365 `
  -nodes `
  -subj "/CN=$CN" `
  -addext "subjectAltName=DNS:$CN,DNS:localhost,IP:127.0.0.1" `
  -keyout $keyPath `
  -out $certPath | Out-Null

Write-Host "Wrote:"
Write-Host "  $certPath"
Write-Host "  $keyPath"

