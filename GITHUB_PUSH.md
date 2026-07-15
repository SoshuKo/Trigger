# v31「雪山神殿 16-bitデザイン改修」反映手順

対象リポジトリ：`SoshuKo/Trigger`

基準にした `main` コミット：

```text
d7d572155ca6cd1b968012aea6bf6dee296839ab
```

推奨コミットメッセージ：

```text
Refine Snow Mountain Shrine pixel art
```

## GitHub版ZIPの上書き先

```text
C:\Users\chiti\OneDrive\デスクトップ\world-trigger-arena
```

`world-trigger-arena-v31-overwrite.zip` をデスクトップへ展開し、既存フォルダーへ上書きします。
`.git` フォルダーはZIPに含まれていないため、そのまま残ります。

PowerShellで展開する場合：

```powershell
Expand-Archive `
  -Path "$HOME\Downloads\world-trigger-arena-v31-overwrite.zip" `
  -DestinationPath "C:\Users\chiti\OneDrive\デスクトップ" `
  -Force
```

## コミット・プッシュ

```powershell
Set-Location "C:\Users\chiti\OneDrive\デスクトップ\world-trigger-arena"

git status --short
git add -A
git diff --cached --stat
git commit -m "Refine Snow Mountain Shrine pixel art"
git pull --rebase origin main
git push origin main
git log -1 --oneline
```

最後が次のようになれば成功です。

```text
xxxxxxx Refine Snow Mountain Shrine pixel art
```

## 公開確認

```text
https://soshuko.github.io/Trigger/?v=31
```

古いファイルが表示される場合は `Ctrl + Shift + R` で強制再読み込みします。

## 自分のサーバー版

上書き先：

```text
C:\Users\chiti\OneDrive\デスクトップ\world-trigger-arena-direct-host
```

`world-trigger-arena-direct-host-v31-overwrite.zip` をデスクトップへ展開し、既存フォルダーへ上書きします。

## Supabaseについて

v31は描画と景観物の改修だけなので、Supabase SQLの再実行やEdge Functionの再デプロイは不要です。
