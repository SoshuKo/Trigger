# TRION ARENA 登録関数 v28

ユーザー登録は `register-account-v2` Edge Functionを使用します。

この関数は登録回数確認用のSQL/RPCを一切呼びません。古い `register-account` 関数や `consume_registration_attempt` が壊れていても影響を受けません。

## デプロイ

プロジェクトフォルダーでPowerShellを開き、次を実行します。

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\DEPLOY_EDGE_FUNCTION.ps1
```

手動で実行する場合：

```powershell
npx --yes supabase@latest login
npx --yes supabase@latest functions deploy register-account-v2 `
  --project-ref fcjxzhmjyzbanmhmpdgq `
  --no-verify-jwt
```

## 確認

Supabase Dashboardの Edge Functions に `register-account-v2` が表示されていることを確認します。

公開ページは次の関数を呼びます。

```text
https://fcjxzhmjyzbanmhmpdgq.supabase.co/functions/v1/register-account-v2
```

`js/online-config.js` は次の設定になっています。

```js
registrationFunction: 'register-account-v2'
```

## SQLについて

この修正のためのSQL実行は不要です。以前の登録回数チェックSQLは、他の機能に影響しないため残しても構いません。
