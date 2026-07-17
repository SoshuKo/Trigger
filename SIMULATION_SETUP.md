# TRION ARENA 戦闘シミュレーション導入・運用手順

この仕組みは、GitHub Actions上のChromiumでTRION ARENA本体を描画なしで高速実行し、複数条件を並列比較します。自前サーバーは不要です。

## 1. 追加されるもの

- `simulation/scenarios.json`：比較条件
- `simulation/run-batch.mjs`：1条件の一部分を実行
- `simulation/merge-results.mjs`：部分結果をJSON・CSVへ統合
- `.github/workflows/battle-simulation.yml`：GitHub Actions
- `simulation-results/latest.json`：サイト表示用の最新集計
- `simulation-results/latest.csv`：表計算ソフト向け
- `simulation-results/latest.js`：ローカルで`index.html`を直接開いた場合の表示用
- タイトル画面の「シミュレーション結果」画面

## 2. 初回のGitHub設定

### Actionsの書き込み権限

1. GitHubで対象リポジトリを開きます。
2. `Settings` → `Actions` → `General`を開きます。
3. `Workflow permissions`で`Read and write permissions`を選びます。
4. `Save`を押します。

この権限は、集計結果を`simulation-results`へ自動コミットするために必要です。

### GitHub Pages

1. `Settings` → `Pages`を開きます。
2. `Build and deployment`のSourceを`GitHub Actions`へ変更します。
3. 保存します。

既に別ワークフローでPagesを公開している場合は、`battle-simulation.yml`の`publish_pages`をfalseで実行し、既存デプロイに`simulation-results`を含めてください。

## 3. シミュレーションの実行

1. GitHubのリポジトリで`Actions`を開きます。
2. 左側から`Battle Simulation`を選択します。
3. `Run workflow`を押します。
4. 次を入力します。

| 入力 | 推奨初期値 | 意味 |
|---|---:|---|
| `matches` | 100 | 各条件の合計試合数 |
| `shards` | 4 | 各条件を何分割するか |
| `publish_pages` | true | 集計後にサイトを再公開するか |

5. 緑色の`Run workflow`を押します。

`matches=100`、`shards=4`なら、各条件を25試合ずつ4ジョブへ分割します。

## 4. 結果の確認

### ゲームサイト

タイトル画面の`シミュレーション結果`を押します。

表示項目：

- 条件ごとの試合数
- A側・B側の勝率
- 引き分け率
- 平均試合時間
- クリティカル率
- ジャストガード率
- 参加者ごとの平均与ダメージ、被ダメージ、終了熟練度

### GitHub Actions

実行したワークフローの最下部にある`Artifacts`から`battle-simulation-results`をダウンロードできます。

### リポジトリ

- `simulation-results/latest.json`
- `simulation-results/latest.csv`
- `simulation-results/history/<日時>.json`

へ自動保存されます。

## 5. 条件の追加

`simulation/scenarios.json`を編集します。

### 個人戦

```json
{
  "id": "solo-example",
  "label": "個人戦テスト",
  "mode": "solo",
  "map": "city",
  "difficulty": "strong",
  "matchLength": 120,
  "fighters": [
    {
      "name": "A",
      "archetype": "攻撃手",
      "stats": { "trion": 5, "technique": 6, "combat": 7 },
      "main": ["kogetsu", "senku", "shield", "grasshopper"],
      "sub": ["scorpion", "bagworm", "shield", "empty"]
    },
    {
      "name": "B",
      "archetype": "射手",
      "stats": { "trion": 8, "technique": 7, "combat": 3 },
      "main": ["shooter_asteroid", "shooter_hound", "shield", "shooter_meteor"],
      "sub": ["shooter_viper", "bagworm", "shield", "grasshopper"]
    }
  ]
}
```

最初の`fighters`がA側です。

### チーム戦

```json
{
  "id": "team-example",
  "label": "2対2テスト",
  "mode": "team",
  "map": "underground",
  "teams": [
    {
      "label": "BLUE",
      "members": [
        { "name": "BLUE-1", "archetype": "攻撃手" },
        { "name": "BLUE-2", "archetype": "射手" }
      ]
    },
    {
      "label": "ORANGE",
      "members": [
        { "name": "ORANGE-1", "archetype": "重装手" },
        { "name": "ORANGE-2", "archetype": "狙撃手" }
      ]
    }
  ]
}
```

全チームの人数は同じにしてください。最初のチームがA側です。

### 防衛戦

```json
{
  "id": "defense-example",
  "label": "防衛戦テスト",
  "mode": "defense",
  "map": "city",
  "defenseScenario": "hyakki",
  "fixedEnemy": "orochi",
  "maxSeconds": 420,
  "defenders": [
    { "name": "DEF-1", "archetype": "万能手" },
    { "name": "DEF-2", "archetype": "射手" },
    { "name": "DEF-3", "extraType": "whitefox" }
  ]
}
```

防衛戦のA側勝利は、防衛成功として集計されます。

## 6. 特殊形態

参加者へ`extraType`を指定します。

```json
{ "name": "FUJIN", "extraType": "fujin" }
```

使用可能値：

- `agent`
- `marmod`
- `ilgar`
- `rabbit`
- `fujin`
- `seals`
- `alektor`
- `borboros`
- `organon`
- `skeletonAttacker`
- `skeletonShooter`
- `skeletonSniper`
- `yamagu`
- `yagarasu`
- `whitefox`
- `nekomata`
- `orochi`

## 7. 乱数と再現

各試合のシードは次の形式です。

```text
<scenario-id>:<match-index>
```

例：

```text
solo-attacker-vs-shooter:37
```

失敗した試合の`seed`を部分結果JSONで確認すれば、同じ条件を再実行できます。

## 8. ローカル実行

Node.js 22以上を用意します。

```powershell
Set-Location "C:\Users\chiti\OneDrive\デスクトップ\world-trigger-arena"
npm install
npx playwright install chromium
npm run simulate:local -- --matches 10
```

完了後：

```text
simulation-results/latest.json
simulation-results/latest.csv
simulation-results/latest.js
```

が更新されます。

## 9. 負荷の目安

最初は次の設定を推奨します。

```text
matches: 20～100
shards: 2～4
```

結果が安定しない条件だけ500～1,000試合へ増やしてください。全試合の全フレームは保存せず、試合単位の集計だけを保存するため、容量増加を抑えています。

## 10. よくあるエラー

### `Resource not accessible by integration`

Actionsの`Workflow permissions`が読み取り専用です。`Read and write permissions`へ変更します。

### Pagesのデプロイで失敗する

`Settings` → `Pages`のSourceを`GitHub Actions`に変更します。

### Chromiumが見つからない

ローカルでは次を実行します。

```powershell
npx playwright install chromium
```

### 条件ファイルのエラー

- 能力値の合計は18
- MAINとSUBは各4枠
- チーム戦は全チーム同人数
- `id`は重複不可

を確認してください。

## 11. 直接ホスト版へ結果を反映する

GitHub Pagesではなく、別のレンタルサーバーへ`world-trigger-arena-direct-host`を置いている場合、Actions終了後に次の3ファイルをサーバー側の同名フォルダへ上書きします。

```text
simulation-results/latest.json
simulation-results/latest.csv
simulation-results/latest.js
```

ワークフローの`battle-simulation-results`成果物にも同じファイルが入ります。ゲーム本体を毎回アップロードし直す必要はありません。
