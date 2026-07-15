# v29「雪山神殿」をGitHubへ反映する手順

対象リポジトリ：`SoshuKo/Trigger`

基準にした `main` コミット：

```text
065fb82dbee7ef4d68aa9552da9edb8494ba8069
```

推奨コミットメッセージ：

```text
Add Snow Mountain Shrine map
```

## 1. ZIPを展開

`world-trigger-arena-github-v29-snow-shrine.zip` をダウンロードフォルダーへ展開します。
Windows標準機能で展開した場合の例：

```text
C:\Users\ユーザー名\Downloads\world-trigger-arena-github-v29-snow-shrine\world-trigger-arena
```

## 2. PowerShellでコピー・コミット・プッシュ

ローカルリポジトリを `$HOME\Documents\Trigger` に置いている場合は、以下をそのまま実行できます。
展開先が違う場合は `$update` だけ修正してください。

```powershell
$repo = "$HOME\Documents\Trigger"
$update = "$HOME\Downloads\world-trigger-arena-github-v29-snow-shrine\world-trigger-arena"

if (-not (Test-Path "$repo\.git")) {
    throw "Gitリポジトリが見つかりません: $repo"
}
if (-not (Test-Path "$update\index.html")) {
    throw "展開した更新ファイルが見つかりません: $update"
}

Set-Location $repo

git status --short
git pull --ff-only origin main

robocopy $update $repo /E /XD .git
if ($LASTEXITCODE -ge 8) {
    throw "robocopyに失敗しました。終了コード: $LASTEXITCODE"
}

git status
git add -A
git commit -m "Add Snow Mountain Shrine map"
git push origin main
```

`git commit`で `nothing to commit` と表示された場合は、同じ内容が既に反映されています。

## 3. 公開確認

GitHub Pagesの反映後、次を開きます。

```text
https://soshuko.github.io/Trigger/?v=29
```

古いファイルが表示される場合は `Ctrl + Shift + R` で強制再読み込みしてください。

## pushが拒否された場合

```powershell
Set-Location "$HOME\Documents\Trigger"
git pull --rebase origin main
git push origin main
```

競合が発生した場合は、競合ファイルを修正してから次を実行します。

```powershell
git add -A
git rebase --continue
git push origin main
```

`git push --force`は使用しないでください。

## 自分のサーバー版

`world-trigger-arena-server-v29-snow-shrine.zip` は、展開した中身をWebサーバーの公開ディレクトリへ上書きする静的ファイル版です。Git管理用文書やSupabaseの管理ファイルは含みません。

## Supabaseについて

v29はマップ追加だけなので、Supabase SQLの再実行やEdge Functionの再デプロイは不要です。
