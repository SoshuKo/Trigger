# GitHubへ反映するPowerShell手順

公開用のGitHub Pages版を、既存リポジトリ `https://github.com/SoshuKo/Trigger` の `main` ブランチへ反映する手順です。

ゲームの展開先：

```text
C:\Users\chiti\OneDrive\デスクトップ\world-trigger-arena
```

ローカルGitリポジトリ：

```text
C:\Users\chiti\Documents\Trigger
```

## 更新手順

PowerShellで実行します。

```powershell
cd "$HOME\Documents\Trigger"

git pull --rebase origin main

robocopy "C:\Users\chiti\OneDrive\デスクトップ\world-trigger-arena" "$HOME\Documents\Trigger" /E /XD .git

# robocopyは終了コード0～7なら通常成功です。
if ($LASTEXITCODE -ge 8) {
    throw "robocopyに失敗しました。終了コード: $LASTEXITCODE"
}

git status
git add .
git commit -m "Add user accounts, squads, defense ranking, and access counter"
git push origin main
```

変更がない場合、`git commit`では `nothing to commit` と表示されます。その場合はコミットせず終了して構いません。

## pushがfetch firstで拒否された場合

```powershell
cd "$HOME\Documents\Trigger"
git pull --rebase origin main
git push origin main
```

競合が起きた場合は、競合ファイルを直してから次を実行します。

```powershell
git add .
git rebase --continue
git push origin main
```

`git push --force`は使用しないでください。

## 公開確認

GitHub Pages反映後、次を開きます。

```text
https://soshuko.github.io/Trigger/?v=24
```

古いファイルが表示される場合は `Ctrl + Shift + R` で強制再読み込みします。

## 直接ホスト版について

直接ホスト版はNode.jsサーバーを含むため、GitHub Pagesの公開ルートへ上書きしないでください。ローカルで展開して `START_PUBLIC_HOST.bat` から起動します。ソースをGitHubへ保管する場合は、別リポジトリまたは別ブランチを推奨します。


## Supabase更新

今回の版は `supabase-schema.sql` の再実行が必要です。GitHubへのpush後、Supabase SQL Editorでファイル全文を実行してください。Authentication → Providers → EmailでEmail認証を有効、Confirm emailをオフにします。
