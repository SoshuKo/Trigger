# TRION LINK コメントオーバーレイ

`world-trigger-arena` の戦闘HUDに合わせた、OBSブラウザソース用の透明コメント欄です。

## OBSへの追加

1. OBSの「ソース」で「ブラウザ」を追加します。
2. 「ローカルファイル」を有効にします。
3. `obs-overlay/obs-comment-overlay.html` を選択します。
4. 幅を `480`、高さを `900`、FPSを `30` にします。
5. 「表示されていないときにソースをシャットダウン」を有効にします。
6. OBS上で右側に配置します。左側に置く場合は、ローカルファイルではなくURL欄へ次を指定します。

```text
file:///C:/Users/chiti/OneDrive/デスクトップ/world-trigger-arena/obs-overlay/obs-comment-overlay.html?side=left
```

## デザイン確認

サンプルコメント付きで確認する場合は、ブラウザで次を開きます。

```text
file:///C:/Users/chiti/OneDrive/デスクトップ/world-trigger-arena/obs-overlay/obs-comment-overlay.html?demo=1
```

URLパラメータ:

- `demo=1`: サンプルコメントを表示
- `side=left`: 左置き用アニメーション
- `max=6`: 最大表示件数（1～10）
- `ttl=45`: コメントを45秒後に消去（0は自動消去なし）
- `title=LIVE%20COMMS`: 見出しを変更

## コメントサービスとの接続

このファイル単体はYouTubeやTwitchへログインしません。コメント取得サービス、配信ツール、またはカスタムウィジェット側から次を呼び出す構成です。

```js
window.addTrionComment("表示名", "コメント本文", "#65e8ff");
```

次の形式の `postMessage` にも対応します。

```js
{
  type: "trion-comment",
  name: "表示名",
  message: "コメント本文",
  accent: "#65e8ff"
}
```

StreamElementsのカスタムウィジェットで使われる `onEventReceived` のメッセージイベントにも対応しています。

## 負荷対策

- 動画、Canvas、外部フォント、外部画像は使っていません。
- トリオンキューブはCSSの3D変形だけで回転します。
- OBSブラウザソースは30 FPSで使用してください。
- コメントが不要なシーンではソースを非表示にしてください。
