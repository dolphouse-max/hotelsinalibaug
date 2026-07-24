param(
  [string]$NarrationDirectory = 'narration',
  [string]$OutputBaseName = 'checkin-product-launch-vertical'
)

$ErrorActionPreference = 'Stop'

$slideshowRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputVideo = Join-Path $slideshowRoot "$OutputBaseName.mp4"
$outputPresentation = Join-Path $slideshowRoot "$OutputBaseName.pptx"
$timingsPath = Join-Path $slideshowRoot "$NarrationDirectory\timings.json"
$slideFiles = Get-ChildItem -LiteralPath $slideshowRoot -Filter '*.png' |
  Sort-Object { [int](($_.BaseName -split '-')[0]) }

if ($slideFiles.Count -ne 12) {
  throw "Expected 12 PNG slides, found $($slideFiles.Count)."
}
if (-not (Test-Path -LiteralPath $timingsPath)) {
  throw 'Run generate-marathi-narration.mjs before exporting the narrated video.'
}
$timings = Get-Content -Raw -LiteralPath $timingsPath | ConvertFrom-Json

Add-Type -AssemblyName System.Drawing
$powerPoint = New-Object -ComObject PowerPoint.Application
$powerPoint.Visible = -1 # msoTrue

try {
  $presentation = $powerPoint.Presentations.Add()
  # 9:16 portrait mobile format: PowerPoint uses points.
  $presentation.PageSetup.SlideWidth = 540
  $presentation.PageSetup.SlideHeight = 960

  foreach ($slideFile in $slideFiles) {
    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12) # ppLayoutBlank
    $slide.FollowMasterBackground = $false
    $slide.Background.Fill.ForeColor.RGB = 0x2B1003 # #03102B in BGR

    $image = [System.Drawing.Image]::FromFile($slideFile.FullName)
    try {
      $imageRatio = $image.Width / $image.Height
      $slideRatio = $presentation.PageSetup.SlideWidth / $presentation.PageSetup.SlideHeight
      # Keep every source slide fully readable, with premium dark margins on a phone screen.
      $availableWidth = $presentation.PageSetup.SlideWidth - 42
      $availableHeight = $presentation.PageSetup.SlideHeight - 210
      if ($imageRatio -gt ($availableWidth / $availableHeight)) {
        $width = $availableWidth
        $height = $width / $imageRatio
      } else {
        $height = $availableHeight
        $width = $height * $imageRatio
      }
      $left = ($presentation.PageSetup.SlideWidth - $width) / 2
      $top = 118 + (($availableHeight - $height) / 2)
      $picture = $slide.Shapes.AddPicture($slideFile.FullName, $false, $true, $left, $top, $width, $height)
      $picture.Line.Visible = $false
      $picture.Shadow.Visible = $true

      $topLabel = $slide.Shapes.AddTextbox(1, 30, 42, 480, 40)
      $topLabel.TextFrame.TextRange.Text = 'CHECKIN  /  HOTEL OPERATING SYSTEM'
      $topLabel.TextFrame.TextRange.Font.Name = 'Aptos Display'
      $topLabel.TextFrame.TextRange.Font.Size = 13
      $topLabel.TextFrame.TextRange.Font.Bold = $true
      $topLabel.TextFrame.TextRange.Font.Color.RGB = 0xF2BB3A
      $topLabel.Line.Visible = $false
      $topLabel.Fill.Visible = $false

      $slideNumber = $slide.Shapes.AddTextbox(1, 30, 884, 480, 30)
      $slideNumber.TextFrame.TextRange.Text = ('{0:00}  /  12' -f $slide.SlideIndex)
      $slideNumber.TextFrame.TextRange.ParagraphFormat.Alignment = 3
      $slideNumber.TextFrame.TextRange.Font.Name = 'Aptos'
      $slideNumber.TextFrame.TextRange.Font.Size = 11
      $slideNumber.TextFrame.TextRange.Font.Color.RGB = 0xD7B27D
      $slideNumber.Line.Visible = $false
      $slideNumber.Fill.Visible = $false

      $audioPath = Join-Path $slideshowRoot ("$NarrationDirectory\slide-{0:00}.mp3" -f $slide.SlideIndex)
      if (-not (Test-Path -LiteralPath $audioPath)) { throw "Narration file is missing: $audioPath" }
      $audio = $slide.Shapes.AddMediaObject2($audioPath, $false, $true, 0, 0, 1, 1)
      $audio.AnimationSettings.PlaySettings.PlayOnEntry = $true
      $audio.AnimationSettings.PlaySettings.HideWhileNotPlaying = $true
    } finally {
      $image.Dispose()
    }

    # Mobile launch-presentation pacing: 5 seconds per slide and a soft fade.
    $slide.SlideShowTransition.EntryEffect = 3849 # ppEffectFadeSmoothly
    $slide.SlideShowTransition.Speed = 2 # ppTransitionSpeedMedium
    $slide.SlideShowTransition.AdvanceOnTime = $true
    $slide.SlideShowTransition.AdvanceTime = [double]$timings[$slide.SlideIndex - 1].seconds + 0.45
  }

  if (Test-Path -LiteralPath $outputPresentation) { Remove-Item -LiteralPath $outputPresentation -Force }
  if (Test-Path -LiteralPath $outputVideo) { Remove-Item -LiteralPath $outputVideo -Force }
  $presentation.SaveAs($outputPresentation)
  $presentation.CreateVideo($outputVideo, $true, 5, 1920, 30, 85)

  $deadline = (Get-Date).AddMinutes(15)
  while ($presentation.CreateVideoStatus -eq 1) { # ppMediaTaskStatusInProgress
    if ((Get-Date) -gt $deadline) { throw 'Video export did not finish within 15 minutes.' }
    Start-Sleep -Seconds 10
  }
  if ($presentation.CreateVideoStatus -ne 3 -or -not (Test-Path -LiteralPath $outputVideo)) {
    throw "PowerPoint video export failed (status $($presentation.CreateVideoStatus))."
  }
} finally {
  if ($presentation) { $presentation.Close() }
  $powerPoint.Quit()
  [Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) | Out-Null
}

Get-Item -LiteralPath $outputVideo | Select-Object FullName, Length, LastWriteTime
