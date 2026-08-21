$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$brandingDirectory = Join-Path $projectRoot 'assets\branding'
$sourceLogoPath = Join-Path $brandingDirectory 'logo.png'
$legacyOutputPath = Join-Path $brandingDirectory 'icon-padded.png'
$adaptiveOutputPath = Join-Path $brandingDirectory 'adaptive-icon-foreground-padded.png'
$splashOutputPath = Join-Path $brandingDirectory 'splash-brand-lockup.png'

function Set-HighQualityDrawing([System.Drawing.Graphics]$graphics) {
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
}

function Save-Png([System.Drawing.Bitmap]$bitmap, [string]$path) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Draw-SourceRect(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Image]$source,
  [System.Drawing.Rectangle]$destination,
  [System.Drawing.Rectangle]$sourceRectangle
) {
  $graphics.DrawImage(
    $source,
    $destination,
    $sourceRectangle.X,
    $sourceRectangle.Y,
    $sourceRectangle.Width,
    $sourceRectangle.Height,
    [System.Drawing.GraphicsUnit]::Pixel
  )
}

$darkBackground = [System.Drawing.ColorTranslator]::FromHtml('#101613')
$sourceLogo = [System.Drawing.Image]::FromFile($sourceLogoPath)

if ($sourceLogo.Width -ne 3000 -or $sourceLogo.Height -ne 3000) {
  $sourceLogo.Dispose()
  throw 'assets/branding/logo.png must remain the approved 3000x3000 source asset.'
}

# The app icon uses the logo's own star-and-chevron emblem. A full horizontal
# wordmark becomes illegible at launcher-icon sizes.
$emblemSource = New-Object System.Drawing.Rectangle 980, 1080, 600, 720
$emblemDestination = New-Object System.Drawing.Rectangle 242, 188, 540, 648

$legacyIcon = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$legacyGraphics = [System.Drawing.Graphics]::FromImage($legacyIcon)
Set-HighQualityDrawing $legacyGraphics
$legacyGraphics.Clear($darkBackground)
Draw-SourceRect $legacyGraphics $sourceLogo $emblemDestination $emblemSource
Save-Png $legacyIcon $legacyOutputPath
$legacyGraphics.Dispose()
$legacyIcon.Dispose()

$adaptiveIcon = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$adaptiveGraphics = [System.Drawing.Graphics]::FromImage($adaptiveIcon)
Set-HighQualityDrawing $adaptiveGraphics
$adaptiveGraphics.Clear([System.Drawing.Color]::Transparent)
Draw-SourceRect $adaptiveGraphics $sourceLogo $emblemDestination $emblemSource
Save-Png $adaptiveIcon $adaptiveOutputPath
$adaptiveGraphics.Dispose()
$adaptiveIcon.Dispose()

# Native splash screens provide the dark background. This transparent asset is
# only the approved wordmark, tightly cropped with a small safety margin.
$wordmarkSource = New-Object System.Drawing.Rectangle 164, 1130, 2653, 606
$splashLogo = New-Object System.Drawing.Bitmap 2733, 686, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$splashGraphics = [System.Drawing.Graphics]::FromImage($splashLogo)
Set-HighQualityDrawing $splashGraphics
$splashGraphics.Clear([System.Drawing.Color]::Transparent)
$wordmarkDestination = New-Object System.Drawing.Rectangle 40, 40, 2653, 606
Draw-SourceRect $splashGraphics $sourceLogo $wordmarkDestination $wordmarkSource
Save-Png $splashLogo $splashOutputPath
$splashGraphics.Dispose()
$splashLogo.Dispose()
$sourceLogo.Dispose()

Write-Output 'Branding assets generated from assets/branding/logo.png.'
