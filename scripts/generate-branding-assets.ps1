$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$brandingDirectory = Join-Path $projectRoot 'assets\branding'
$appConfigPath = Join-Path $projectRoot 'app.json'
$sourceIconPath = Join-Path $brandingDirectory 'icon.png'
$sourceMarkPath = Join-Path $brandingDirectory 'splash-icon.png'
$legacyOutputPath = Join-Path $brandingDirectory 'icon-padded.png'
$adaptiveOutputPath = Join-Path $brandingDirectory 'adaptive-icon-foreground-padded.png'
$splashOutputPath = Join-Path $brandingDirectory 'splash-brand-lockup.png'
$version = (Get-Content -LiteralPath $appConfigPath -Raw | ConvertFrom-Json).expo.version

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

$brandBackground = [System.Drawing.ColorTranslator]::FromHtml('#006440')
$brandGreen = [System.Drawing.ColorTranslator]::FromHtml('#00F5A0')
$secondaryText = [System.Drawing.ColorTranslator]::FromHtml('#D7F5E8')
$mutedText = [System.Drawing.ColorTranslator]::FromHtml('#A8D8C5')

$sourceIcon = [System.Drawing.Image]::FromFile($sourceIconPath)
$legacyIcon = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$legacyGraphics = [System.Drawing.Graphics]::FromImage($legacyIcon)
Set-HighQualityDrawing $legacyGraphics
$legacyGraphics.Clear($brandBackground)
$legacyGraphics.DrawImage($sourceIcon, 92, 92, 840, 840)
Save-Png $legacyIcon $legacyOutputPath
$legacyGraphics.Dispose()
$legacyIcon.Dispose()
$sourceIcon.Dispose()

$sourceMark = [System.Drawing.Image]::FromFile($sourceMarkPath)
$adaptiveIcon = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$adaptiveGraphics = [System.Drawing.Graphics]::FromImage($adaptiveIcon)
Set-HighQualityDrawing $adaptiveGraphics
$adaptiveGraphics.Clear([System.Drawing.Color]::Transparent)
$adaptiveGraphics.DrawImage($sourceMark, 92, 92, 840, 840)
Save-Png $adaptiveIcon $adaptiveOutputPath
$adaptiveGraphics.Dispose()
$adaptiveIcon.Dispose()

$splash = New-Object System.Drawing.Bitmap 1080, 1920, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$splashGraphics = [System.Drawing.Graphics]::FromImage($splash)
Set-HighQualityDrawing $splashGraphics
$splashGraphics.Clear([System.Drawing.Color]::Transparent)
$splashGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$splashGraphics.DrawImage($sourceMark, 160, 580, 760, 760)

$centeredText = New-Object System.Drawing.StringFormat
$centeredText.Alignment = [System.Drawing.StringAlignment]::Center
$centeredText.LineAlignment = [System.Drawing.StringAlignment]::Center
$sloganFont = New-Object System.Drawing.Font 'Segoe UI', 64, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$domainFont = New-Object System.Drawing.Font 'Segoe UI', 46, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$versionFont = New-Object System.Drawing.Font 'Segoe UI', 34, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$brandBrush = New-Object System.Drawing.SolidBrush $brandGreen
$secondaryBrush = New-Object System.Drawing.SolidBrush $secondaryText
$mutedBrush = New-Object System.Drawing.SolidBrush $mutedText

$slogan = "Askerlik yolunda yan$([char]0x0131)nda"
$splashGraphics.DrawString($slogan, $sloganFont, $brandBrush, (New-Object System.Drawing.RectangleF 0, 1320, 1080, 100), $centeredText)
$splashGraphics.DrawString('devrem.co', $domainFont, $secondaryBrush, (New-Object System.Drawing.RectangleF 0, 1435, 1080, 80), $centeredText)
$splashGraphics.DrawString("v$version", $versionFont, $mutedBrush, (New-Object System.Drawing.RectangleF 0, 1760, 1080, 70), $centeredText)

Save-Png $splash $splashOutputPath

$mutedBrush.Dispose()
$secondaryBrush.Dispose()
$brandBrush.Dispose()
$versionFont.Dispose()
$domainFont.Dispose()
$sloganFont.Dispose()
$centeredText.Dispose()
$splashGraphics.Dispose()
$splash.Dispose()
$sourceMark.Dispose()

Write-Output "Branding assets generated for version $version."
