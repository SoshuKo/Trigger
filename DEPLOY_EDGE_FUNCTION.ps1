$ErrorActionPreference = "Stop"
$ProjectRef = "fcjxzhmjyzbanmhmpdgq"

Write-Host "最初にSupabase SQL Editorで supabase-registration-hotfix.sql を全文実行してください。" -ForegroundColor Yellow
Read-Host "SQL実行後、Enterキーを押してください"

Write-Host "Supabase CLIへログインします。ブラウザが開いたら許可してください。" -ForegroundColor Cyan
npx --yes supabase@latest login

Write-Host "register-account Edge Functionを公開します。" -ForegroundColor Cyan
npx --yes supabase@latest functions deploy register-account --project-ref $ProjectRef --no-verify-jwt

Write-Host "完了しました。公開ページを Ctrl+Shift+R で再読み込みしてください。" -ForegroundColor Green
