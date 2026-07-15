# メール送信なしユーザー登録の設定

この版は、ブラウザからSupabase Authの `signUp()` を直接呼びません。
`register-account` Edge Functionがサーバー側のAdmin APIでユーザーを作成し、`email_confirm: true` を設定します。そのため、確認メールも登録メールも送信されず、Supabaseのメール送信レート制限を消費しません。

## 1. SQLを更新

Supabase Dashboardの **SQL Editor** で、同梱の `supabase-schema.sql` を先頭から最後まで実行します。

このSQLには以下が含まれます。

- ユーザー名、隊、隊員、アクセス数、防衛戦ランキング
- 登録Edge Function専用の回数制限テーブル
- IP単位・ユーザー名単位の登録試行制限RPC

## 2. Edge Functionをデプロイ

### 最も簡単な方法

プロジェクトフォルダーでPowerShellを開き、同梱のスクリプトを実行します。

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\DEPLOY_EDGE_FUNCTION.ps1
```

ブラウザが開いたらSupabaseへログインして許可してください。

スクリプトが行うコマンドは次のものです。

```powershell
npx --yes supabase@latest login
npx --yes supabase@latest functions deploy register-account `
  --project-ref fcjxzhmjyzbanmhmpdgq `
  --no-verify-jwt
```

関数コードは次の場所にあります。

```text
supabase\functions\register-account\index.ts
```

`supabase/config.toml`でも`verify_jwt = false`を指定しています。登録前のユーザーが呼び出す関数なので、この設定が必要です。代わりに、関数内部でIPとユーザー名ごとの回数制限を行います。

## 3. 認証設定

Supabase Dashboardで以下を確認します。

```text
Authentication → Providers → Email
```

- Email provider：オン
- Confirm email：オン／オフどちらでも可

Edge Functionが作るユーザーはサーバー側で確認済みにするため、Confirm emailの設定には影響されません。

オンラインのゲスト参加も使う場合は、以下もオンにします。

```text
Authentication → Providers → Anonymous
```

## 4. 動作確認

GitHub Pages更新後、ユーザー画面から新しいユーザー名で登録します。

成功後、Consoleでは次が確認できます。

```js
window.trionOnline.connected
```

```text
true
```

登録関数の確認URL：

```text
https://fcjxzhmjyzbanmhmpdgq.supabase.co/functions/v1/register-account
```

ブラウザで直接開くとPOSTではないためエラーになりますが、それで正常です。

## セキュリティ

- `service_role`／secret keyはEdge Functionの環境内だけで使用します。
- GitHub、`online-config.js`、ブラウザへsecret keyを入れないでください。
- Supabaseのホスト環境ではAdmin用のsecretがEdge Functionへ自動提供されます。
- 公開関数にはIP単位で1時間8回、同一ユーザー名で1時間3回の試行制限があります。
## v27 登録回数チェック修正

- `consume_registration_attempt` RPCを引数名ごと作り直します。
- SQL実行後にPostgRESTのスキーマキャッシュを再読込します。
- RPCが一時的に取得できない場合も、Edge Function内の簡易制限へ切り替えて登録を継続します。
- `supabase-registration-hotfix.sql` をSQL Editorで実行後、Edge Functionを再デプロイしてください。

