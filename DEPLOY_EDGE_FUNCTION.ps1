$ErrorActionPreference = "Stop"
$ProjectRef = "fcjxzhmjyzbanmhmpdgq"

Write-Host "Supabase CLIへログインします。ブラウザが開いたら許可してください。" -ForegroundColor Cyan
npx --yes supabase@latest login

Write-Host "register-account Edge Functionを公開します。" -ForegroundColor Cyan
npx --yes supabase@latest functions deploy register-account --project-ref $ProjectRef --no-verify-jwt

Write-Host "完了しました。次にSupabase SQL Editorで supabase-v26-migration.sql を全文実行してください。" -ForegroundColor Green
