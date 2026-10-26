<#
.SYNOPSIS
  Stop the CareBridge backend (8000), Doctor portal (5173) and Patient web app (8081) started by start.ps1.
  Only stops python/node processes listening on those ports.
#>
$stopped = 0
foreach ($port in @(8000, 5173, 8081)) {
    $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
              Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($id in $owners) {
        # uvicorn's worker inherits the listening socket; if the watcher has already exited, the port is
        # still reported under the watcher's (dead) PID, so also stop workers started by that PID.
        Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.ParentProcessId -eq $id -or $_.CommandLine -like "*parent_pid=$id*" } |
            ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host "Stopped server worker on port $port (PID $($_.ProcessId))"
                $stopped++
            }
        $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -in @('python', 'pythonw', 'node')) {
            # uvicorn --reload runs a watcher plus a worker; stop the whole process tree.
            & taskkill /PID $id /T /F | Out-Null
            Write-Host "Stopped $($proc.ProcessName) on port $port (PID $id)"
            $stopped++
        } elseif ($proc) {
            Write-Host "Port $port is used by $($proc.ProcessName) (PID $id); not a CareBridge server, left running." -ForegroundColor Yellow
        }
    }
}
if ($stopped -eq 0) { Write-Host "No CareBridge servers were running." }
