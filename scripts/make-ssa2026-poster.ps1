# SSA 2026 게시용 포스터 — 공식 히어로 배경(visual-bg.jpg) 위에 공식 타이틀 블록을 얹어
# 카드 비율(800x1122) 세로 포스터를 만든다. 텍스트·색은 ssakorea.kr 히어로와 동일하게 맞춘다.
Add-Type -AssemblyName System.Drawing

$dir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = [System.Drawing.Image]::FromFile("$dir\ssa-bg.jpg")
$W = 800; $H = 1122

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# 1) 배경 — 칩 중심(원본 x약1030)을 세로 프레임에 맞춰 크롭. 높이는 전부 쓴다.
$srcH = $src.Height
$srcW = [int]($W / $H * $srcH)          # 770
$srcX = [int](1030 - $srcW / 2)         # 칩 중심 기준
if ($srcX -lt 0) { $srcX = 0 }
if ($srcX + $srcW -gt $src.Width) { $srcX = $src.Width - $srcW }
$dest = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$g.DrawImage($src, $dest, $srcX, 0, $srcW, $srcH, [System.Drawing.GraphicsUnit]::Pixel)

# 2) 스크림 — 글자가 얹히는 중앙대를 눌러 대비 확보. 원본 시안 톤을 유지하려고
#    검정이 아니라 배경의 짙은 청록(#04141A)을 쓴다(급격한 검정 끊김 방지).
$scrimTop = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0,0)), (New-Object System.Drawing.Point(0,$H)),
  [System.Drawing.Color]::FromArgb(150, 4, 20, 26),
  [System.Drawing.Color]::FromArgb(215, 4, 20, 26))
$blend = New-Object System.Drawing.Drawing2D.ColorBlend(4)
$blend.Colors = @(
  [System.Drawing.Color]::FromArgb(120, 4, 20, 26),
  [System.Drawing.Color]::FromArgb(205, 4, 20, 26),
  [System.Drawing.Color]::FromArgb(205, 4, 20, 26),
  [System.Drawing.Color]::FromArgb(150, 4, 20, 26))
$blend.Positions = @(0.0, 0.22, 0.80, 1.0)
$brush.InterpolationColors = $blend
$g.FillRectangle($brush, $scrimTop)

$cyan  = [System.Drawing.Color]::FromArgb(255, 64, 220, 238)
$white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center

# RectangleF 오버로드는 PS 5.1 에서 인자 해석이 깨진다 — (x, y, format) 오버로드를 쓴다.
# StringFormat.Alignment=Center 라 x 는 중심선이다.
function Draw($text, $fontName, $size, $style, $color, $y) {
  $f = New-Object System.Drawing.Font -ArgumentList $fontName, ([single]$size), $style, ([System.Drawing.GraphicsUnit]::Pixel)
  $b = New-Object System.Drawing.SolidBrush -ArgumentList $color
  $script:g.DrawString($text, $f, $b, [single]($script:W / 2), [single]$y, $script:sf)
  $f.Dispose(); $b.Dispose()
}

# 3) '2026 제 7회' 알약
$pillW = 210; $pillH = 52; $pillX = ($W - $pillW) / 2; $pillY = 250
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = $pillH
$path.AddArc($pillX, $pillY, $r, $r, 90, 180)
$path.AddArc($pillX + $pillW - $r, $pillY, $r, $r, 270, 180)
$path.CloseFigure()
$pen = New-Object System.Drawing.Pen($cyan, 2.5)
$g.DrawPath($pen, $path)
Draw "2026 제 7회" "Malgun Gothic" 24 ([System.Drawing.FontStyle]::Bold) $cyan ($pillY + 11)

# 4) 제목 3줄
Draw "Smart"         "Segoe UI" 76 ([System.Drawing.FontStyle]::Bold) $white 336
Draw "Semiconductor" "Segoe UI" 76 ([System.Drawing.FontStyle]::Bold) $white 430
Draw "Academy"       "Segoe UI" 76 ([System.Drawing.FontStyle]::Bold) $white 524

# 5) 부제 · 일정 · 장소
Draw "Advanced Packaging 및 HBM/HBF 기술" "Malgun Gothic" 31 ([System.Drawing.FontStyle]::Bold) $cyan 648
Draw "2026. 8. 24(월) ~ 8. 26(수)"          "Malgun Gothic" 29 ([System.Drawing.FontStyle]::Regular) $white 748
Draw "세종대학교, 대양AI센터 12층 (AI 홀)"   "Malgun Gothic" 27 ([System.Drawing.FontStyle]::Regular) $white 806

# 6) 저장 — JPEG 품질 88
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 88)
$out = "$dir\ssa2026.jpg"
$bmp.Save($out, $codec, $ep)

$g.Dispose(); $bmp.Dispose(); $src.Dispose(); $pen.Dispose(); $brush.Dispose(); $path.Dispose()
Write-Output "저장: $out  ($((Get-Item $out).Length) bytes)  크롭 x=$srcX w=$srcW"
