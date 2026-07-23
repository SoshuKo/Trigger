$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$V103 = 'a535b15de65d4a84e8a70198b30ef11b2ce1f99e'

function Require-File([string]$Path) {
  if (-not (Test-Path $Path)) { throw "必要なファイルがありません: $Path" }
}
function Read-Utf8([string]$Path) {
  return [System.IO.File]::ReadAllText((Resolve-Path $Path), [System.Text.UTF8Encoding]::new($false))
}
function Write-Utf8([string]$Path, [string]$Text) {
  $full = Join-Path $PSScriptRoot $Path
  $parent = Split-Path $full -Parent
  if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  [System.IO.File]::WriteAllText($full, $Text, [System.Text.UTF8Encoding]::new($false))
}
function Replace-Exact([string]$Path, [string]$Old, [string]$New) {
  $text = Read-Utf8 $Path
  if (-not $text.Contains($Old)) { throw "置換対象が見つかりません: $Path :: $Old" }
  Write-Utf8 $Path ($text.Replace($Old, $New))
}
function Restore-FromV103([string]$Path) {
  $text = (& git show "$V103`:$Path") -join "`n"
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($text)) { throw "v103から取得できません: $Path" }
  Write-Utf8 $Path ($text + "`n")
}

Require-File 'index.html'
Require-File 'js/game.js'
Require-File 'js/v77-features.js'
if (-not (Test-Path '.git')) { throw 'world-trigger-arena のGit管理フォルダで実行してください。' }

$index = Read-Utf8 'index.html'
$game = Read-Utf8 'js/game.js'
if ($index -notmatch 'VERSION 104' -or $game -notmatch 'GAME_VERSION\s*=\s*104') {
  throw 'v104最新版を土台にしてください。VERSION 104 / GAME_VERSION 104を確認できません。'
}

Write-Host 'v103の安定機能を取得しています...'
& git fetch origin $V103 --quiet
if ($LASTEXITCODE -ne 0) { throw 'v103コミットを取得できませんでした。' }

# v104でオミットされた既存機能をv103相当に復元
$restore = @(
  'js/community.js',
  'styles.css',
  'supabase-schema.sql',
  'simulation-results/latest.json',
  'simulation-results/latest.js',
  'simulation-results/latest.csv',
  'simulation/matrix.mjs',
  '.github/workflows/battle-simulation.yml',
  '攻略本.md'
)
foreach ($path in $restore) { Restore-FromV103 $path }

# v104と無関係な旧v66自動適用ワークフローを除去
@(
  '.github/workflows/apply-v66-ai-support-balance.yml',
  '.github/workflows/apply-v66-direct-main.yml',
  '.github/workflows/apply-v66-retry-via-pr.yml'
) | ForEach-Object { if (Test-Path $_) { Remove-Item -Force $_ } }

# 文字化けした攻略本を除去
@('#U653b#U7565#U672c.md','謾ｻ逡･譛ｬ.md') | ForEach-Object { if (Test-Path $_) { Remove-Item -Force $_ } }

# v104軽量化は維持しつつ、時間依存処理とグラスホッパー操舵の退行だけ修正
$v77 = Read-Utf8 'js/v77-features.js'
$oldMobility = "if(hasSpecialWires||this.v94MobilityPads?.length)updateMobilityRoutes(this,dt);"
if (-not $v77.Contains($oldMobility)) { throw 'グラスホッパー復元対象が見つかりません。' }
$v77 = $v77.Replace($oldMobility, "updateMobilityRoutes(this,dt);")

$oldStatus = "this.v104FeatureEffectTimer=Math.max(0,(this.v104FeatureEffectTimer||0)-dt);if(this.v104FeatureEffectTimer<=0){updateEngineerTrapEffects(this);updateNamedStatus(this,.16);this.v104FeatureEffectTimer=.16;}"
$newStatus = "this.v104FeatureEffectElapsed=(this.v104FeatureEffectElapsed||0)+dt;this.v104FeatureEffectTimer=Math.max(0,(this.v104FeatureEffectTimer||0)-dt);if(this.v104FeatureEffectTimer<=0){const effectStep=Math.min(.25,this.v104FeatureEffectElapsed||dt);this.v104FeatureEffectElapsed=0;updateEngineerTrapEffects(this);updateNamedStatus(this,effectStep);this.v104FeatureEffectTimer=.16;}"
if (-not $v77.Contains($oldStatus)) { throw '状態時間復元対象が見つかりません。' }
$v77 = $v77.Replace($oldStatus, $newStatus)

$oldKogetsu = "if(isEngineer(p))engineerTactics(this,p,step);updateKogetsuBranch(this,p,step);}"
$newKogetsu = "if(isEngineer(p))engineerTactics(this,p,step);}updateKogetsuBranch(this,p,dt);"
if (-not $v77.Contains($oldKogetsu)) { throw '弧月派生復元対象が見つかりません。' }
$v77 = $v77.Replace($oldKogetsu, $newKogetsu)
Write-Utf8 'js/v77-features.js' $v77

# v105へ統一
$index = Read-Utf8 'index.html'
$index = $index.Replace('VERSION 104','VERSION 105').Replace('?v=104','?v=105')
Write-Utf8 'index.html' $index

Replace-Exact 'js/game.js' 'const GAME_VERSION = 104;' 'const GAME_VERSION = 105;'

$i18n = Read-Utf8 'js/i18n.js'
$i18n = $i18n.Replace('?v=104','?v=105').Replace('VERSION 104','VERSION 105')
Write-Utf8 'js/i18n.js' $i18n

$v77 = Read-Utf8 'js/v77-features.js'
$v77 = $v77.Replace('installSimulationApiV104','installSimulationApiV105')
$v77 = $v77.Replace('v104Wrapped','v105Wrapped')
$v77 = $v77.Replace('featureVersion=104','featureVersion=105')
$v77 = $v77.Replace('api.version=104','api.version=105')
$v77 = $v77.Replace('version:104','version:105')
$v77 = $v77.Replace("'VERSION 104'","'VERSION 105'")
$v77 = $v77.Replace("dataset.gameVersion='104'","dataset.gameVersion='105'")
$v77 = $v77.Replace('[v104 game capture]','[v105 game capture]')
Write-Utf8 'js/v77-features.js' $v77

foreach ($path in @('simulation/common.mjs','simulation/run-batch.mjs','README.md','攻略本.md')) {
  if (Test-Path $path) {
    $text = Read-Utf8 $path
    $text = $text.Replace('gameVersion: 104','gameVersion: 105')
    $text = $text.Replace('Math.max(104','Math.max(105')
    $text = $text.Replace('featureVersion = 104','featureVersion = 105')
    $text = $text.Replace('>= 104','>= 105')
    $text = $text.Replace('VERSION 104','VERSION 105')
    $text = $text.Replace('バージョン104','バージョン105')
    Write-Utf8 $path $text
  }
}

foreach ($path in @('package.json','package-lock.json')) {
  if (Test-Path $path) {
    $text = Read-Utf8 $path
    $text = $text.Replace('"version": "104.0.0"','"version": "105.0.0"')
    Write-Utf8 $path $text
  }
}

if (Test-Path 'simulation-results/v104-calibration-summary.json') {
  $cal = Read-Utf8 'simulation-results/v104-calibration-summary.json'
  $cal = $cal.Replace('"gameVersion": 104','"gameVersion": 105')
  Write-Utf8 'simulation-results/v105-calibration-summary.json' $cal
  Remove-Item -Force 'simulation-results/v104-calibration-summary.json'
}
if (Test-Path 'V104_PERFORMANCE_SNIPER_ATTACKER_NAMED_BALANCE.txt') {
  $note = Read-Utf8 'V104_PERFORMANCE_SNIPER_ATTACKER_NAMED_BALANCE.txt'
  $note = $note.Replace('v104','v105').Replace('VERSION 104','VERSION 105')
  Write-Utf8 'V105_PERFORMANCE_SNIPER_ATTACKER_NAMED_BALANCE.txt' $note
  Remove-Item -Force 'V104_PERFORMANCE_SNIPER_ATTACKER_NAMED_BALANCE.txt'
}

@'
TRION ARENA VERSION 105

v104の軽量化・スナイパーAI・アタッカーAI・ネームド順位調整を維持し、
v103からの退行だけを修復しました。

復元:
- ランキングプロフィール
- お気に入り構成保存
- コメント欄
- アクセスカウンター
- チュートリアル/UI CSS
- 12,596試合の基準シミュレーション結果
- GitHub Actionsの256ジョブ制限とリーグ1分割
- グラスホッパー使用後の操舵
- 弧月ジャスト派生の毎フレーム判定
- 状態効果の実経過時間更新
- 攻略本の正常なファイル名
'@ | Set-Content -Encoding UTF8 'V105_REGRESSION_REPAIR.txt'

# 検証
node --check js/game.js
node --check js/community.js
node --check js/i18n.js
node --check js/v77-features.js
node --check simulation/common.mjs
node --check simulation/matrix.mjs
node --check simulation/merge-results.mjs
node --check simulation/run-batch.mjs

if ((Read-Utf8 'index.html') -notmatch 'VERSION 105') { throw 'VERSION 105確認失敗' }
if ((Read-Utf8 'js/game.js') -notmatch 'GAME_VERSION\s*=\s*105') { throw 'GAME_VERSION 105確認失敗' }
if ((Read-Utf8 'index.html') -match '\?v=104') { throw 'index.htmlに?v=104が残っています。' }
if (-not (Test-Path '攻略本.md')) { throw '攻略本.mdの復元失敗' }
if (-not (Test-Path 'simulation-results/v105-calibration-summary.json')) { throw 'v105調整結果の生成失敗' }

Write-Host 'VERSION 105への更新と退行修復が完了しました。' -ForegroundColor Green
