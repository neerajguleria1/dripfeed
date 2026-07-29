
# tc-validate-ps.ps1
# Live E2E validation of Tata CLiQ via ScraperAPI using PowerShell (bypasses Node network block)

$KEY = 'aad3e2c9859bcff447455c38413fb0be'
$CDN = 'https://assets.tatacliq.com/medias/sys_master/h_325/images/h_325/'
$QUERIES = @('kurta women', 'sneakers men', 'oversized hoodie', 'saree silk', 'jeans slim fit')

function ParsePrice($raw) {
  $n = [double]$raw
  if ($n -le 0) { return 0 }
  if ($n -gt 10000) { return [int][Math]::Round($n / 100) }
  return [int][Math]::Round($n)
}

$summary = @()

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "  Tata CLiQ Live E2E — ScraperAPI (key: aad3...b0be)" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') UTC" -ForegroundColor Cyan
Write-Host "======================================================`n" -ForegroundColor Cyan

foreach ($query in $QUERIES) {
  Write-Host "▶ Query: `"$query`"" -ForegroundColor Yellow
  
  $target = "https://www.tatacliq.com/search/?searchCategory=all&text=$([Uri]::EscapeDataString($query))"
  $scraperUrl = "https://api.scraperapi.com/?api_key=$KEY&url=$([Uri]::EscapeDataString($target))&country_code=in"
  
  # Try plain tier first
  Write-Host "  Trying plain tier (1 credit)..." -ForegroundColor DarkGray
  $resp = $null
  try {
    $resp = Invoke-WebRequest -Uri $scraperUrl -TimeoutSec 30 -ErrorAction Stop
    $html = $resp.Content
    Write-Host "  HTTP: $($resp.StatusCode) | Length: $([Math]::Round($html.Length/1024,1)) KB" -ForegroundColor DarkGray
  } catch {
    $html = ""
    Write-Host "  Plain tier failed: $_" -ForegroundColor DarkGray
  }
  
  # If plain didn't get __NEXT_DATA__, try render tier
  if (-not $html.Contains('__NEXT_DATA__')) {
    Write-Host "  __NEXT_DATA__ not found on plain — trying render tier (10 credits)..." -ForegroundColor DarkGray
    $renderUrl = "https://api.scraperapi.com/?api_key=$KEY&url=$([Uri]::EscapeDataString($target))&country_code=in&render=true"
    try {
      $resp2 = Invoke-WebRequest -Uri $renderUrl -TimeoutSec 60 -ErrorAction Stop
      $html = $resp2.Content
      Write-Host "  Render HTTP: $($resp2.StatusCode) | Length: $([Math]::Round($html.Length/1024,1)) KB" -ForegroundColor DarkGray
    } catch {
      Write-Host "  Render tier failed: $_" -ForegroundColor Red
      $summary += @{ query=$query; ok=$false; error="Both tiers failed" }
      continue
    }
  }
  
  if (-not $html.Contains('__NEXT_DATA__')) {
    $hasCF = $html.ToLower().Contains('cloudflare')
    Write-Host "  ✗ __NEXT_DATA__ not found (len=$($html.Length), cloudflare=$hasCF)" -ForegroundColor Red
    $snippet = $html.Substring(0,[Math]::Min(300,$html.Length)).Replace("`n"," ")
    Write-Host "  Snippet: $snippet" -ForegroundColor DarkGray
    $summary += @{ query=$query; ok=$false; error="__NEXT_DATA__ not found" }
    continue
  }
  
  # Parse __NEXT_DATA__
  $marker = '<script id="__NEXT_DATA__"'
  $startIdx = $html.IndexOf($marker)
  $jsonStart = $html.IndexOf('>', $startIdx) + 1
  $jsonEnd = $html.IndexOf('</script>', $jsonStart)
  
  try {
    $jsonStr = $html.Substring($jsonStart, $jsonEnd - $jsonStart)
    $nextData = $jsonStr | ConvertFrom-Json
  } catch {
    Write-Host "  ✗ JSON parse failed: $_" -ForegroundColor Red
    $summary += @{ query=$query; ok=$false; error="JSON parse failed" }
    continue
  }
  
  $pp = $nextData.props.pageProps
  $sr = $null
  if ($pp.data.searchresult) { $sr = $pp.data.searchresult }
  elseif ($pp.initialData.data.searchresult) { $sr = $pp.initialData.data.searchresult }
  elseif ($pp.searchresult) { $sr = $pp.searchresult }
  
  if (-not $sr) {
    $ppKeys = ($pp | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name) -join ', '
    Write-Host "  ✗ searchresult not found. pageProps keys: $ppKeys" -ForegroundColor Red
    $summary += @{ query=$query; ok=$false; error="searchresult not in pageProps" }
    continue
  }
  
  $products = $sr.products
  $totalCount = $sr.totalCount
  if (-not $products) { $products = @() }
  $count = @($products).Count
  
  Write-Host "  ✓ $count products (total on site: $totalCount)" -ForegroundColor Green
  
  $queryIssues = 0
  $shown = [Math]::Min($count, 3)
  
  for ($i = 0; $i -lt $shown; $i++) {
    $p = $products[$i]
    
    $price = ParsePrice $p.bestprice
    if ($price -eq 0) { $price = ParsePrice $p.sellingprice }
    $mrp = ParsePrice $p.mrp
    $priceNote = if ([double]$p.bestprice -gt 10000) { "$($p.bestprice) paisa → ₹$price" } else { "₹$price (INR)" }
    
    $titleRaw = "$($p.brandname) $($p.productname)".Trim()
    $title = $titleRaw -replace '<[^>]*>', ''
    
    $imgPath = if ($p.images -and $p.images[0].path) { $p.images[0].path.TrimStart('/') } else { '' }
    $imageUrl = if ($imgPath) { "$CDN$imgPath" } else { '' }
    
    $webURL = ($p.webURL -replace '^https?://www\.tatacliq\.com', '')
    $productUrl = if ($webURL) {
      if ($webURL.StartsWith('/')) { "https://www.tatacliq.com$webURL" } else { "https://www.tatacliq.com/$webURL" }
    } else { "https://www.tatacliq.com/search/?text=$([Uri]::EscapeDataString($query))" }
    
    # Validate
    $issues = @()
    if (-not $title -or $title.Length -lt 5) { $issues += "title too short" }
    if ($price -le 0)                         { $issues += "price=0" }
    if (-not $imageUrl)                       { $issues += "no image" }
    elseif (-not $imageUrl.StartsWith('https://')) { $issues += "image not https" }
    if ($mrp -gt 0 -and $mrp -lt $price)     { $issues += "mrp($mrp)<price($price)" }
    if (-not $productUrl.StartsWith('https://www.tatacliq.com')) { $issues += "bad productUrl" }
    
    $icon = if ($issues.Count -eq 0) { "✓" } else { "⚠" }
    $color = if ($issues.Count -eq 0) { "Green" } else { "Yellow" }
    
    Write-Host "`n  $icon Product $($i+1):" -ForegroundColor $color
    Write-Host "     Title:       $title"
    Write-Host "     Brand:       $(if($p.brandname){$p.brandname}else{'—'})"
    Write-Host "     Price:       $priceNote"
    $discount = if ($p.discount) { "$([Math]::Round([double]$p.discount))%" } else { "—" }
    Write-Host "     Discount:    $discount"
    $imgStatus = if ($imageUrl) { "✓ $($imageUrl.Substring(0,[Math]::Min(72,$imageUrl.Length)))" } else { "✗ MISSING" }
    $imgColor = if ($imageUrl) { "Green" } else { "Red" }
    Write-Host "     Image:       $imgStatus" -ForegroundColor $imgColor
    Write-Host "     ProductURL:  $($productUrl.Substring(0,[Math]::Min(72,$productUrl.Length)))"
    $rating = if ($p.averagerating) { $p.averagerating } else { "—" }
    Write-Host "     Rating:      $rating  |  Color: $(if($p.color){$p.color}else{'—'})"
    Write-Host "     Affiliate:   passthrough (AFFILIATE_CUELINKS_ID not configured in dev)" -ForegroundColor DarkGray
    
    foreach ($iss in $issues) {
      Write-Host "     ⚠  ISSUE: $iss" -ForegroundColor Yellow
      $queryIssues++
    }
  }
  
  $summary += @{ query=$query; ok=$true; count=$count; total=$totalCount; issues=$queryIssues }
}

# Summary
Write-Host "`n`n======================================================" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "======================================================`n" -ForegroundColor Cyan

$totalOk = 0; $totalFail = 0; $totalProducts = 0; $totalIssues = 0
foreach ($s in $summary) {
  if ($s.ok) {
    Write-Host "✓ `"$($s.query)`" → $($s.count) products ($($s.total) total), $($s.issues) field issues" -ForegroundColor Green
    $totalOk++
    $totalProducts += $s.count
    $totalIssues += $s.issues
  } else {
    Write-Host "✗ `"$($s.query)`" → $($s.error)" -ForegroundColor Red
    $totalFail++
  }
}

Write-Host "`n── Totals ──────────────────────────────────────────"
Write-Host "Queries OK:    $totalOk/$($QUERIES.Count)"
Write-Host "Queries FAIL:  $totalFail"
Write-Host "Products:      $totalProducts"
Write-Host "Field issues:  $totalIssues"

if ($totalOk -eq $QUERIES.Count -and $totalIssues -eq 0) {
  Write-Host "`n✓ VALIDATION PASSED — Tata CLiQ is production-ready`n" -ForegroundColor Green
} elseif ($totalOk -gt 0) {
  Write-Host "`n⚠ VALIDATION PARTIAL — review issues above`n" -ForegroundColor Yellow
} else {
  Write-Host "`n✗ VALIDATION FAILED — all queries blocked`n" -ForegroundColor Red
}
