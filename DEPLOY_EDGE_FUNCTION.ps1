$ErrorActionPreference = "Stop"
$ProjectRef = "fcjxzhmjyzbanmhmpdgq"

Write-Host "Supabase CLIへログインします。ブラウザが開いたら許可してください。" -ForegroundColor Cyan
npx --yes supabase@latest login

Write-Host "新しい register-account-v2 Edge Functionを公開します。SQL更新は不要です。" -ForegroundColor Cyan
npx --yes supabase@latest functions deploy register-account-v2 `
  --project-ref $ProjectRef `
  --no-verify-jwt

Write-Host "公開確認を行います。" -ForegroundColor Cyan
$Url = "https://$ProjectRef.supabase.co/functions/v1/register-account-v2"
try {
  $Response = Invoke-WebRequest -Uri $Url -Method Options -UseBasicParsing
  Write-Host "register-account-v2 が応答しました。HTTP $($Response.StatusCode)" -ForegroundColor Green
} catch {
  Write-Warning "関数の確認に失敗しました。Supabase DashboardのEdge Functionsでregister-account-v2を確認してください。"
}

Write-Host "完了しました。GitHubへ反映後、公開ページを Ctrl+Shift+R で再読み込みしてください。" -ForegroundColor Green
