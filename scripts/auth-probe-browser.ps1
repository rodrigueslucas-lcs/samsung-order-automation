param([string]$ProfileDirectory, [switch]$SkipListeners)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    $known = $true
    $profiles = @()
    $browsers = @()
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
            if ($ProfileDirectory -and $process.CommandLine -notmatch '--type=' -and
                [IO.Path]::GetFullPath($value).TrimEnd('\') -eq [IO.Path]::GetFullPath($ProfileDirectory).TrimEnd('\')) {
                $ports = @()
                if (-not $SkipListeners) {
                    $ports = @(Get-NetTCPConnection -OwningProcess $process.ProcessId -State Listen -ErrorAction SilentlyContinue |
                        Where-Object LocalAddress -eq '127.0.0.1' | Select-Object -ExpandProperty LocalPort -Unique)
                }
                $browsers += [pscustomobject]@{ pid = $process.ProcessId; createdAt = $process.CreationDate.ToUniversalTime().ToString('o'); ports = $ports }
            }
        }
    }
    [pscustomobject]@{ known = $known; profiles = @($profiles | Sort-Object -Unique); browsers = $browsers } | ConvertTo-Json -Compress -Depth 4
} catch {
    [pscustomobject]@{ known = $false; profiles = @() } | ConvertTo-Json -Compress
}
