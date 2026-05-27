# Advanced Notebook — установка на Windows
# Запуск: правой кнопкой → "Run with PowerShell"

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "   Advanced Notebook — Установка (Windows)        " -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host ""

# Проверка Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js не найден!" -ForegroundColor Red
    Write-Host "  Скачай: https://nodejs.org (кнопка LTS)" -ForegroundColor Yellow
    Write-Host "  После установки запусти этот скрипт снова." -ForegroundColor Yellow
    Read-Host "Нажми Enter для выхода"
    exit 1
}

# Проверка Rust
try {
    $cargoVersion = cargo --version
    Write-Host "✓ Rust $cargoVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠ Rust не найден. Устанавливаю..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "$env:TEMP\rustup-init.exe"
    Start-Process -FilePath "$env:TEMP\rustup-init.exe" -ArgumentList "-y" -Wait
    $env:Path += ";$env:USERPROFILE\.cargo\bin"
    Write-Host "✓ Rust установлен" -ForegroundColor Green
}

# Проверка Visual C++ Build Tools
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasBuildTools = $false
if (Test-Path $vsWhere) {
    $installations = & $vsWhere -products * -requires Microsoft.VisualCpp.Tools.HostX64.TargetX64 2>$null
    if ($installations) { $hasBuildTools = $true }
}

if (-not $hasBuildTools) {
    Write-Host ""
    Write-Host "⚠ Не найдены Visual C++ Build Tools" -ForegroundColor Yellow
    Write-Host "  Они нужны для сборки приложения." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Открой: https://aka.ms/vs/17/release/vs_BuildTools.exe" -ForegroundColor Cyan
    Write-Host "  2. Поставь галочку 'Desktop development with C++'" -ForegroundColor Cyan
    Write-Host "  3. Нажми Install (~5 ГБ, 15-20 минут)" -ForegroundColor Cyan
    Write-Host "  4. Перезагрузи компьютер" -ForegroundColor Cyan
    Write-Host "  5. Запусти этот скрипт снова" -ForegroundColor Cyan
    Write-Host ""
    Start-Process "https://aka.ms/vs/17/release/vs_BuildTools.exe"
    Read-Host "Нажми Enter для выхода"
    exit 1
}
Write-Host "✓ Visual C++ Build Tools найдены" -ForegroundColor Green

# npm install
Write-Host ""
Write-Host "Устанавливаю npm зависимости..." -ForegroundColor Blue
npm install

# Сборка MSI
Write-Host ""
Write-Host "Собираю установщик .msi..." -ForegroundColor Blue
Write-Host "Первая сборка займёт 10-20 минут..." -ForegroundColor Yellow
Write-Host ""

$env:CARGO_NET_RETRY = "10"
$env:CARGO_HTTP_CHECK_REVOKE = "false"

npm run tauri build -- --target x86_64-pc-windows-msvc --bundles msi

# Найти готовый файл
$bundleDir = "src-tauri\target\x86_64-pc-windows-msvc\release\bundle\msi"
$msiFile = Get-ChildItem -Path $bundleDir -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
if ($msiFile) {
    Write-Host "✓ Установщик готов:" -ForegroundColor Green
    Write-Host "  $($msiFile.FullName)" -ForegroundColor Cyan
    Write-Host ""
    $install = Read-Host "Установить сейчас? (y/n)"
    if ($install -eq "y" -or $install -eq "Y") {
        Start-Process -FilePath $msiFile.FullName -Wait
    }
} else {
    # Если MSI не создался — найти .exe
    $exeFile = "src-tauri\target\x86_64-pc-windows-msvc\release\advanced-notebook.exe"
    if (Test-Path $exeFile) {
        Write-Host "✓ Приложение собрано (portable версия):" -ForegroundColor Green
        Write-Host "  $exeFile" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Скопируй .exe куда удобно и запускай напрямую." -ForegroundColor Yellow
    }
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Read-Host "Нажми Enter для выхода"
