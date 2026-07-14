# TRION ARENA オンライン設定

オンライン機能は、ゲーム本体を静的ホスティングへ配置し、Supabaseを通信・ルーム・フレンド・ランキング用バックエンドとして使用します。自宅PCのポート開放や常時起動は不要です。

## 1. Supabaseプロジェクトを作成

1. Supabaseで無料プロジェクトを作成します。
2. SQL Editorを開きます。
3. 同梱の `supabase-schema.sql` 全体を貼り付けて実行します。
4. Authentication → ProvidersでAnonymous Sign-Insを有効にします。
5. Project Settings → APIから次を控えます。
   - Project URL
   - Publishable keyまたはanon key

## 2. ゲームへ接続情報を記入

`js/online-config.js` を開きます。

```js
window.TRION_ONLINE_CONFIG = {
  enabled: true,
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseKey: 'YOUR_PUBLISHABLE_KEY',
  snapshotHz: 6,
};
```

`service_role` キーは絶対にブラウザへ記入しないでください。使用するのはpublishable keyまたはanon keyです。

## 3. 静的ホスティングへ配置

以下のいずれかへ、フォルダー内のファイルをそのまま配置します。

- Cloudflare Pages
- GitHub Pages
- その他のHTTPS対応静的ホスティング

ビルドコマンドは不要です。公開ディレクトリには `index.html` があるフォルダーを指定します。

## 4. 動作確認

1. 公開URLを2台のブラウザまたはシークレットウィンドウで開きます。
2. タイトル画面の「オンライン」を開きます。
3. 一方でルームを作成します。
4. もう一方で6文字のルームコードを入力します。
5. TEAMと役割を選び、準備完了にします。
6. ホストが試合を開始します。

## フレンド

- プロフィール欄の8文字コードを相手へ共有します。
- 相手のコードを入力すると相互フレンドになります。
- フレンドがロビーまたは試合に参加している場合、フレンド一覧に参加／観戦ボタンが表示されます。

## 同じチーム／別チーム

- 同じTEAM番号を選ぶと同じ隊として出撃します。
- 異なるTEAM番号を選ぶと敵対チームになります。
- 観戦またはオペレーターは戦闘員数に含まれません。
- 人数が足りないチームにはNPCが補充されます。

## 仕組みと制限

- 通信はSupabase RealtimeのBroadcastとPresenceを使用します。
- 戦闘シミュレーションはルームホストのブラウザが担当しますが、通信サーバーとして外部公開されることはありません。
- ホストがページを閉じると、進行中の試合は継続できません。
- 途中参加の観戦者には、ホストから現在のマップと戦闘状態を再送します。
- 2～8人を推奨します。最大16人まで設定できますが、人数増加時は無料枠に合わせて同期頻度が自動的に低下します。
- ランキングはクライアント送信型のベータ版であり、厳密なチート防止機能はありません。

## セキュリティ

- `supabase-schema.sql` はすべての公開テーブルでRow Level Securityを有効にします。
- service roleキーを公開しないでください。
- 公開後はSupabaseのRealtime使用量とAuthユーザー数を定期的に確認してください。
- 匿名アカウントの大量作成対策が必要になった場合は、Supabase AuthへTurnstileなどのCAPTCHAを設定してください。
