$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    $known = $true
    $profiles = @()
    $processes = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'")
    foreach ($process in $processes) {
        if ([string]::IsNullOrEmpty($process.CommandLine)) {
            $known = $false
            continue
        }
        # Extract only profile directories. Never return command lines, URLs,
        # credentials or browser arguments to the caller or its terminal.
        if ($process.CommandLine -match '(?:"--user-data-dir=([^"]+)"|--user-data-dir(?:=|\s+)(?:"([^"]+)"|([^\s"]+)))') {
            $value = if ($Matches[1]) { $Matches[1] } elseif ($Matches[2]) { $Matches[2] } else { $Matches[3] }
            $profiles += $value
        }
    }
    [pscustomobject]@{ known = $known; profiles = @($profiles | Sort-Object -Unique) } | ConvertTo-Json -Compress
} catch {
    [pscustomobject]@{ known = $false; profiles = @() } | ConvertTo-Json -Compress
}
