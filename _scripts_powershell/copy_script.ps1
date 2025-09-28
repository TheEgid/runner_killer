$start = Get-Date

$scriptPath = $MyInvocation.MyCommand.Path
$grandParentDir = (Get-Item $scriptPath).Directory.Parent.FullName
$folderName = (Get-Item $grandParentDir).Name
$dst = Join-Path ([Environment]::GetFolderPath("Desktop")) $folderName

$excludeDirs = @(
    "main-applic\node_modules",
    ".git",
    ".vscode",
    "main-applic\.next",
    "main-applic\build",
    "main-applic\public\temporary",
    "main-applic\test-results",
    "main-applic\.swc",
    "python-applic\.venv",
    "python-applic\__pycache__"
) | ForEach-Object { Join-Path $grandParentDir $_ }

$robocopyArgs = @(
    $grandParentDir,
    $dst,
    "/MT:12",
    "/MIR",
    "/XA:SH",
    "/XJD",
    "/NFL",
    "/NDL",
    ($excludeDirs | ForEach-Object { "/XD"; $_ })
)

robocopy @robocopyArgs

# Удаляем файл schema.prisma из папки назначения
$schemaFile = Join-Path $dst "main-applic\prisma\schema.prisma"

if (Test-Path $schemaFile) {
    Remove-Item $schemaFile -Force
    Write-Output "Remove $schemaFile"
} else {
    Write-Output "Not finded $schemaFile"
}

$elapsed = (Get-Date) - $start
Write-Output "Copy completed at: $dst"
Write-Output ("Elapsed time: {0} seconds" -f $elapsed.TotalSeconds.ToString('N2'))
