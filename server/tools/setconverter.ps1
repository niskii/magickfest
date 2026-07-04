$bitrates = 128, 96, 64

$folder = Get-Location
Write-Output "Searching files in $folder"

$audioFiles = @(Get-ChildItem -Recurse -Path $folder | Where-Object { ($_.Name -like "*.mp3") -or ($_.Name -like "*.flac") -or ($_.Name -like "*.aif") -or ($_.Name -like "*.m4a") -or ($_.Name -like "*.wav") })
$covers = [System.Object[]]::new($audioFiles.Length);
$playlist = [System.Collections.ArrayList]::new()

foreach ($file in $audioFiles) {
    $path = $file.Directory.BaseName
    $index = $audioFiles.IndexOf($file)
    $setfile = (Join-Path -Path "sets" -ChildPath "$($file.BaseName)/set.json")
    if (!$playlist.Contains($setfile)) {
        $playlist.Add($setfile) > $null
        $sub = $file.Directory
        if ($folder.ToString() -ne $sub.ToString()) {
            $cover = Get-ChildItem -Path $sub | Where-Object { ($_.Name -like "*.jpg") -or ($_.Name -like "*.jpeg") -or ($_.Name -like "*.gif") -or ($_.Name -like "*.png") }
            if (![string]::IsNullOrEmpty($cover)) {
                Write-Output "found $($path)/$($file.Name) with cover $($cover.Name)"
                $covers[$index] = $cover
            }
        }
        else {
            Write-Output "found $($path)/$($file.Name)"
        }
    }
}

$confirmation = Read-Host -Prompt "Convert these files? (y/n)"

$jsonPath = Join-Path -Path $folder -ChildPath "playlist.json"
@{Sets = $playlist } | ConvertTo-Json | Out-File $jsonPath

if ($confirmation -ne "y") {
    Write-Output "Exiting"
    exit
}

Write-Output "Converting files to opus"

foreach ($file in $audioFiles) {
    $outputPath = Join-Path -Path $folder -ChildPath "sets\$($file.BaseName)\$($file.BaseName).opus"
    $outputDir = Split-Path -Path $outputPath -Parent
    if (-not (Test-Path -LiteralPath $outputDir)) {
        Write-Output "Creating directory $outputDir"
        New-Item -ItemType Directory -Path $outputDir | Out-Null
    }
}

$origin = @{}
$audioFiles | ForEach-Object {
    $origin.($audioFiles.IndexOf($_)) = @{}
}


$sync = [System.Collections.Hashtable]::Synchronized($origin)

$jobs = $audioFiles | ForEach-Object -ThrottleLimit 6 -AsJob -Parallel {
    $syncCopy = $Using:sync
    $index = ($using:audioFiles).IndexOf($_)
    $process = $syncCopy.$($index)

    $basePath = "sets/$($_.BaseName)"

    $cover = ($using:covers)[$index]
    $coverDimensions = (& mediainfo --Inform="Image;%Width%,%Height%" "$($cover.Fullname)") -split ","

    $inputRatio = $coverDimensions[0] / $coverDimensions[1]
    $outputWidth = $coverDimensions[0]
    $outputHeight = $coverDimensions[1]
    $x = 0
    $y = 0

    if ($inputRatio -ge 1) {
        $outputWidth = $coverDimensions[1]
        $x = ($coverDimensions[0] - $outputWidth) / 2
    }
    else {
        $outputHeight = $coverDimensions[0]
        $y = ($coverDimensions[1] - $outputHeight) / 2
    }

    cwebp -crop $($x) $($y) $($outputWidth) $($outputHeight) -lossless -resize 512 512 "$($cover.FullName)" -o "$($basePath)\$($cover.Basename).webp"

    $bitratesCopy = $using:bitrates

    $process.Id = $index 
    $process.Activity = "Id $($index) starting"
    $process.Status = "Processing"

    $process.Activity = "Id $($index) processing"

    $duration = & mediainfo --Inform="General;%Duration%" "$($_.FullName)"
    $total = $bitratesCopy.Length * $duration / 1000
    $progress = @{}

    $process.PercentComplete = 0

    foreach ($bitrate in $bitratesCopy) {
        $process.Status = "Converting $($_.BaseName) $percent/100"
        $outputPath = Join-Path -Path $using:folder -ChildPath "$($basePath)\$($_.BaseName)_$bitrate.opus"

        if ($_.Name -like "*.mp3" -or $_.Name -like "*.m4a" -or $_.Name -like ".aif" -or $_.Name -like "*.flac" -or $_.Name -like "*.wav") {
            ffmpeg -progress pipe:1 -nostats -y -i "$($_.FullName)" -c:a libopus -b:a "$($bitrate)k" -frame_duration:a 40 "$($outputPath)" | Select-String 'out_time_ms=(\d+)' | ForEach-Object {
                $converted = [int] $_.Matches.Groups[1].Value
                $progress.($bitrate) = $converted / 1000000
                $sum = 0
                $progress.Values | ForEach-Object {
                    $sum += $_
                }
                $process.PercentComplete = $sum / $total * 100
            }
        }
    }

    $jsonPath = Join-Path -Path $using:folder -ChildPath "$($basePath)\set.json"
    @{
        Title      = ""
        Author     = ""
        Seconds    = $duration / 1000
        CoverFile  = "$($output)"
        AudioFiles = @(
            foreach ($bitrate in $($using:bitrates)) {
                @{
                    File    = "./$($_.BaseName)_$bitrate.opus"
                    Bitrate = $bitrate
                }
            }
        )
    } | ConvertTo-Json | Out-File $jsonPath

    $process.Completed = $true  
}

while ($jobs.State -eq 'Running') {
    $sync.Keys | ForEach-Object {
        # If key is not defined, ignore
        if (![string]::IsNullOrEmpty($sync.$_.Keys)) {
            # Create parameter hashtable to splat
            $param = $sync.$_

            # Execute Write-Progress
            Write-Progress @param
        }
    }

    # Sleep a bit to allow the threads to run - adjust as desired.
    Start-Sleep -Seconds 1
}
