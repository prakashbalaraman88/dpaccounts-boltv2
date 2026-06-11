# Generates synthetic payment-app screenshots for vision-model direction tests.
# Run: powershell -File scripts/make-test-screenshots.ps1
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot "test-assets"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-PaymentShot {
    param($fileName, $lines)
    $bmp = New-Object System.Drawing.Bitmap(540, 960)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'ClearTypeGridFit'
    $g.Clear([System.Drawing.Color]::White)

    # Top bar like a payment app
    $blue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(66, 133, 244))
    $g.FillRectangle($blue, 0, 0, 540, 90)
    $white = [System.Drawing.Brushes]::White
    $barFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("Google Pay", $barFont, $white, 20, 28)

    # Green success tick circle
    $green = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 168, 83))
    $g.FillEllipse($green, 230, 140, 80, 80)
    $tickFont = New-Object System.Drawing.Font("Segoe UI", 30, [System.Drawing.FontStyle]::Bold)
    $g.DrawString([char]0x2713, $tickFont, $white, 248, 152)

    $y = 270
    $black = [System.Drawing.Brushes]::Black
    $gray = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(95, 99, 104))
    foreach ($line in $lines) {
        $size = $line[0]; $bold = $line[1]; $text = $line[2]; $dim = $line[3]
        $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
        $font = New-Object System.Drawing.Font("Segoe UI", $size, $style)
        $brush = if ($dim) { $gray } else { $black }
        $measured = $g.MeasureString($text, $font)
        $x = (540 - $measured.Width) / 2
        $g.DrawString($text, $font, $brush, $x, $y)
        $y += $measured.Height + 14
    }

    $path = Join-Path $outDir $fileName
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "wrote $path"
}

# Expense: business paid a vendor
New-PaymentShot "gpay-paid.png" @(
    @(34, $true,  ([char]0x20B9 + "4,500"), $false),
    @(16, $false, "Paid to Raju Carpenter", $false),
    @(12, $false, "Payment successful", $true),
    @(11, $false, "11 Jun 2026, 5:32 PM", $true),
    @(10, $false, "UPI transaction ID 416678234511", $true),
    @(11, $false, "From HDFC Bank XXXX6789", $true)
)

# Incoming: client paid the business
New-PaymentShot "gpay-received.png" @(
    @(34, $true,  ([char]0x20B9 + "25,000"), $false),
    @(16, $false, "Received from Mehta Constructions", $false),
    @(12, $false, "Credited to your bank account", $true),
    @(11, $false, "11 Jun 2026, 6:05 PM", $true),
    @(10, $false, "UPI transaction ID 416678234987", $true),
    @(11, $false, "To HDFC Bank XXXX6789", $true)
)
