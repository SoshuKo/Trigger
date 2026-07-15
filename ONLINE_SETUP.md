# TRION ARENA オンライン設定 v26

この版はGitHub Pagesなどの静的ホスティングとSupabaseを使用します。自宅PCの常時起動やポート開放は不要です。

## 1. メール送信なし登録を有効化

今回から、ブラウザの `signUp()` は使用しません。Supabase Edge FunctionがAdmin APIで確認済みユーザーを作成するため、登録メールは送信されず、`email rate limit exceeded`も発生しません。

先に次の手順を実行してください。

1. `supabase-schema.sql`をSQL Editorで全文実行
2. `DEPLOY_EDGE_FUNCTION.ps1`をPowerShellで実行
3. Edge Function `register-account`をデプロイ

詳しい手順は `EDGE_FUNCTION_SETUP.md` にあります。

Supabaseの **Authentication → Providers → Email** はオンにします。Confirm emailはオン／オフどちらでも構いません。オンラインのゲスト参加を使う場合はAnonymousもオンにします。

## 2. データベースを更新

Supabaseの **SQL Editor** で、同梱の `supabase-schema.sql` を**先頭から最後まで再実行**してください。SQLは既存データを残したまま更新できる構成です。

追加される主なデータ：

- ユーザープロフィールのユーザー名
- フレンド追加・解除
- 隊、隊員、隊長、隊名、カラー、隊章
- 個人・チーム・防衛戦ランキング
- アクセスカウンター

## 3. 接続設定

`js/online-config.js` は次の設定済み状態で同梱しています。

```js
window.TRION_ONLINE_CONFIG = {
  enabled: true,
  supabaseUrl: 'https://fcjxzhmjyzbanmhmpdgq.supabase.co',
  supabaseKey: 'sb_publishable_VAmWTiWmnC_0xlOc340i4w_g-K_mXaz',
  snapshotHz: 6,
};
```

ブラウザへ入れてよいのはpublishable keyまたはanon keyだけです。`service_role`、secret key、DBパスワードは入れないでください。

## 4. 公開とキャッシュ

フォルダーの中身をGitHub Pagesへ配置します。ビルドは不要です。現行HTMLの読み込み番号は `v=27` です。

公開後：

```text
https://soshuko.github.io/Trigger/?v=27
```

古い画面が残る場合は `Ctrl + Shift + R`、またはサイトデータ削除を行ってください。

## 5. オンライン出撃の流れ

1. タイトルで **ユーザー** を開き、登録またはログインします。
2. フレンドコードでフレンドを追加できます。
3. 必要に応じてフレンドを選び、隊を結成します。
4. タイトルの **オンライン出撃** を押します。
5. オフラインと同じ出撃設定で、能力、装備、役割、マップ、人数を決めます。
6. **オンラインロビーへ** を押し、ルーム作成または参加を行います。
7. 同じTEAMなら味方、別TEAMなら敵です。空き枠はCPUが補充します。

## 隊機能

- 隊を作ったユーザーが最初の隊長です。
- 隊長は所属隊員から新しい隊長を選べます。
- 隊名、キャラクターカラー、32×32隊章を変更できます。
- 隊章はPNGでダウンロードできます。
- 「出撃設定へ反映」で隊名・色・隊章を現在の設定へコピーできます。
- 現在はフレンドを隊へ直接追加する簡易方式で、招待承認はありません。

## ランキングとアクセス数

- 個人戦、チーム戦、防衛戦のオンライン上位5件を表示します。
- 防衛戦は到達ラウンドを含めたスコアを使用します。
- ランキングはクライアント送信型で、公式競技用途の不正防止はありません。
- アクセスカウンターはページを読み込んだブラウザごとに加算されます。厳密なユニークユーザー数ではありません。

## 制限

- メールを使わないため、パスワードを忘れた場合の自動再設定はありません。
- 2～8人を推奨します。最大16人ですが、人数が増えると同期頻度が下がります。
- 試合計算はルームホストのブラウザが担当します。ホストが閉じると進行中の試合は終了します。


## ユーザー登録の仕組み

- 利用者が入力するのはユーザー名とパスワードだけです。
- 内部認証IDはユーザー名から決定的に生成します。
- Edge Functionが `auth.admin.createUser()` と `email_confirm: true` を使用します。
- 確認メールや登録メールは送信されません。
- IP単位で1時間8回、同一ユーザー名で1時間3回の登録試行制限があります。
- パスワード再設定メールはないため、パスワードを忘れると復旧できません。
## v27 登録回数チェック修正

- `consume_registration_attempt` RPCを引数名ごと作り直します。
- SQL実行後にPostgRESTのスキーマキャッシュを再読込します。
- RPCが一時的に取得できない場合も、Edge Function内の簡易制限へ切り替えて登録を継続します。
- `supabase-registration-hotfix.sql` をSQL Editorで実行後、Edge Functionを再デプロイしてください。

