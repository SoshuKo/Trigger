# v32「戦闘・敵視・AIアップデート」反映手順

対象リポジトリ：`SoshuKo/Trigger`

基準にした `main` コミット：

```text
fd010c60800c9e660038a899d25d077f73505028
```

推奨コミットメッセージ：

```text
Add v32 combat and AI update
```

## GitHub版ZIPの上書き先

```text
C:\Users\chiti\OneDrive\デスクトップ\world-trigger-arena
```

`world-trigger-arena-v32-overwrite.zip` をデスクトップへ展開し、既存フォルダーへ上書きします。
`.git` フォルダーはZIPに含まれていないため、そのまま残ります。

PowerShellで展開する場合：

```powershell
Expand-Archive `
  -Path "$HOME\Downloads\world-trigger-arena-v32-overwrite.zip" `
  -DestinationPath "C:\Users\chiti\OneDrive\デスクトップ" `
  -Force
```

## コミット・プッシュ

```powershell
Set-Location "C:\Users\chiti\OneDrive\デスクトップ\world-trigger-arena"

git status --short
git add -A
git diff --cached --stat
git commit -m "Add v32 combat and AI update"
git pull --rebase origin main
git push origin main
git log -1 --oneline
```

最後が次のようになれば成功です。

```text
xxxxxxx Add v32 combat and AI update
```

## 公開確認

```text
https://soshuko.github.io/Trigger/?v=32
```

古いファイルが表示される場合は `Ctrl + Shift + R` で強制再読み込みします。

## 自分のサーバー版

上書き先：

```text
C:\Users\chiti\OneDrive\デスクトップ\world-trigger-arena-direct-host
```

`world-trigger-arena-direct-host-v32-overwrite.zip` をデスクトップへ展開し、既存フォルダーへ上書きします。

## Supabaseについて

v32はゲーム本体、設定UI、AI、オンライン戦闘設定の更新です。データベース構造とEdge Functionは変更していないため、Supabase SQLの再実行やEdge Functionの再デプロイは不要です。
