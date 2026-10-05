# SPカードとテストコース

## コースの公開先

coursesのis_publishedをTRUEにして保存すると正式公開（リリース）です。FALSE・空欄・列なしは未公開で、local-walk-guide（先行・テスト版）だけに表示します。machi-aruki-guide（正式版）はTRUEのコースだけ表示します。公開期間の条件も引き続き適用します。ID変更は不要です。旧test_modeは公開判定に使いません。

エディターの「コース → 基本情報 → 正式公開（リリース）」で切り替えられます。新規コースはOFFから始まります。ONにしただけではまだ公開されず、保存時の公開確認と保存成功でリリースになります。

## カードを出す場所

course_spotsのcard_enabledをTRUEにしたコース内スポットだけにカードを出します。エディターでは「コース → 巡回順 → カード」をONにします。同じスポットでも、別のコースではOFFにできます。既存の説明・音声は維持します。

Configのphoto_repoに設定した写真リポジトリへ、次の名前で画像を置きます。

- スポットIDがmanpukuji → manpukuji_spcard.webp
- スポットIDがspot_02 → spot_02_spcard.webp

画像URL欄は通常空欄のままで構いません。スポットのcard_image_url、またはConfigの共通card_image_urlを設定すると自動命名URLより優先します。スポットのcard_titleは空欄ならスポット名です。

Configのcard_labelを「クラカード」などの名称に、card_messageを任意の獲得メッセージに変更できます。画像未配置のスポットはONにする前にエディターの存在チェックで確認してください。

## 到着から次へ

説明・音声ガイド → カード画像表示 → 「カードを保存して次へ」 → 保存画面 → 「画像を保存」 → 保存を確認して「画像を保存しました」 → 次のスポット／完歩。

ブラウザーはダウンロード開始までしか検知できません。実際に保存できたことは利用者が確認します。通信失敗時は画像を開いて手動保存できます。歩行を妨げないよう「説明に戻る」「今回は保存せずに進む」も用意しています。

獲得一覧には画像URLなどの小さな記録だけを保存します。画像本体は端末へダウンロードし、一覧の画像も必要時に読み込みます。ブラウザーのデータ消去で一覧は消えるため、御朱印帳の「データを保存」からJSONバックアップできます。既存のGoogle Drive同期にもカード記録を含めます。

## 完歩記念画像

Configのcert_image_idへ画像IDを入れると、写真リポジトリの「画像ID_spcard.webp」を修了証と一緒に表示します。空欄なら追加表示しません。cert_image_urlで任意URLを指定することもできます。文字を画像へ重ねる専用レイアウト編集は今回の対象外です。

## シートの追加項目

| シート | 追加項目 |
|---|---|
| courses | is_published |
| course_spots | card_enabled |
| spots | card_image_url, card_title |
| configのキー | card_label, card_message, card_image_url, cert_image_id, cert_image_url |

増田町の既存シートには追加済みです。他地域の既存シートへ導入する際も、ヘッダーとConfigキーを追加してください。今回GASの変更・再デプロイは不要です。

## リリース時の確認

release-channel.jsは先行版でpreview、正式版でproductionに固定します。URLから正式版のテスト表示を有効にする機能はありません。公開シートそのものの閲覧制限とは別の仕組みです。

両版でnode --test tests/*.test.cjsを実行します。実ブラウザー相当の回帰テストはtests/rewards-browser.cjs（PlaywrightとChromiumが必要）です。本番シートへの書き込みは行わず架空データで検証します。

利用集計と年次ログ整理は将来の任意機能で、今回のカード取得では新たなGAS利用ログを送信しません。
