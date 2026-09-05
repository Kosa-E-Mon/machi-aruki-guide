# 🏮 local-walk-guide

**GPS連動型まち歩きガイドアプリ**  
スマートフォンのGPSを使い、スポットに近づくと自動で音声ガイドが流れる、まち歩き体験アプリです。  
Googleスプレッドシートでコンテンツを管理し、GitHub Pagesで無料公開できます。

> **リポジトリ構成について**  
> 本リポジトリ（local-walk-guide）は**先行開発版**です。テストを重ねて安定を確認した内容は、正式版リポジトリ **[machi-aruki-guide](https://github.com/Kosa-E-Mon/machi-aruki-guide)**（ブランド名：**MACHI-ARUKI-GUIDE**）に反映しています。  
> 他地域・他団体での導入には正式版のURL（`https://kosa-e-mon.github.io/machi-aruki-guide/`）のご利用を推奨します。

---

> **English Summary**  
> A GPS-triggered walking guide app for local tourism, developed in Masuda Town, Yokote City, Akita, Japan.  
> Audio guides play automatically when visitors approach registered spots.  
> Content is managed via Google Spreadsheets and deployed on GitHub Pages at zero cost.  
> This repository is the development (preview) edition; the stable brand edition is [machi-aruki-guide](https://github.com/Kosa-E-Mon/machi-aruki-guide) (MACHI-ARUKI-GUIDE).  
> Free to fork and adapt with attribution required. Community support available for tourism organizations — visit Masuda first.  
> See [License](#ライセンス) and [Community](#コミュニティサポート) sections for details.

---

## アプリの全体構成

本リポジトリには、来訪者向けの本体アプリと、運営者向けの3つのツールが同梱されています。

| ファイル | アプリ | 対象者 | 用途 |
|----------|--------|--------|------|
| `index.html` | 🏮 まち歩きガイド | 来訪者 | GPS連動でスポットを巡る本体アプリ |
| `editor.html` | 🗺️ データエディタ | 運営担当者 | シートの全データを編集・プレビュー（PC・タブレット用） |
| `survey.html` | 📋 現地調査 | 調査担当者 | 現地を歩きながらスポット・施設を登録（モバイル用） |
| `media-uploader.html` | 🎙️ メディア変換・GitHub登録 | 運営担当者 | 音声・画像の変換とGitHubへのアップロード |

> 各地域・団体は「まち歩きガイド」をURLパラメータ（`?sid=`）で共用し、  
> 編集・調査ツールはPC・スマートフォンで使い分ける運用を想定しています。  
> 詳しい設計思想・アーキテクチャは [local-walk-guide_overview.md](local-walk-guide_overview.md) を、  
> **導入・運用の実践的な手引き（現地調査のコツ・音声制作・ツールの使い方）は [GUIDE.md](GUIDE.md)** を参照してください。

---

## 目次

1. [特徴](#特徴)
2. [デモ](#デモ)
3. [クイックスタート](#クイックスタート)
4. [運営ツール](#運営ツール)
5. [スプレッドシート構成](#スプレッドシート構成)
6. [config設定一覧](#config設定一覧)
7. [音声ガイドについて](#音声ガイドについて)
8. [Google Analytics 4 の設定](#google-analytics-4-の設定)
9. [コミュニティ・サポート](#コミュニティサポート)
10. [クレジット表記について（重要）](#クレジット表記について重要)
11. [ライセンス](#ライセンス)

---

## 特徴

### 来訪者向け（本体アプリ）

- 📍 **GPS自動到着検知** ── スポットに近づくと自動で音声ガイドを再生（接近予告アナウンス付き）
- 🔊 **音声ガイド** ── Google DriveのMP3ファイル、またはブラウザTTS（読み上げ）に対応
- 🗺️ **地図表示** ── Leaflet.js（OpenStreetMap）による現在地・目的地マップ
- 🧭 **方位コンパス** ── 端末の向きに連動して目的地の方角を表示
- ⛩️ **御朱印帳** ── コース完走でデジタル御朱印を授与。複数地区の御朱印を1冊に集約でき、地区フィルターで整理可能
- 🏅 **完歩証（修了証）** ── 称号・発行者・印影までスプレッドシートでデザインできるデジタル賞状
- 🌤️ **天気・熱中症（WBGT）表示** ── ホーム画面に現地の天気予報と熱中症警戒レベルを表示。環境省の公式WBGT値（GAS中継）に対応し、未設定時は気温・湿度から推定
- 🚸 **注意喚起アナウンス** ── コース種別（市街地・公園・混在）に応じた安全上の注意を開始時に音声案内
- 📏 **歩行距離カウンター** ── 歩いた距離を累積記録して表示
- ☁️ **Googleクラウドバックアップ** ── 進捗・御朱印をGoogle Drive（アプリ専用領域）に保存。機種変更後も復元可能
- 👀 **アクセシビリティ配慮** ── ピンチズーム対応・文字サイズ引き上げなど、幅広い年代が読みやすい画面設計

### 運営者向け

- ⚙️ **スプレッドシートで完結** ── HTMLの知識不要でコンテンツ編集・追加が可能
- 🖥️ **専用エディタ・調査・変換ツールを同梱** ── データ編集から現地調査、音声・画像の登録まで運営者自身で完結（[運営ツール](#運営ツール)参照）
- 🍂 **期間限定コース** ── コースごとに公開期間を設定でき、季節・イベント対応が可能
- 🌏 **多言語UI基盤** ── configの `lang` でUI言語を宣言する仕組みを実装済み（英語辞書は整備中）
- 📊 **Google Analytics 4対応** ── 来訪者の動線・スポット到着データを計測可能
- 🆓 **無料で公開可能** ── GitHub Pages + Googleスプレッドシートのみで運用できる

---

## デモ

**増田まち歩きガイド（秋田県横手市増田町）**  
https://kosa-e-mon.github.io/local-walk-guide/

> 重要伝統的建造物群保存地区「増田の内蔵」を巡るモデルコースです。  
> まずはこのデモを実際に現地で体験してみてください。

---

## クイックスタート

### 🚀 最速スタート（フォーク不要）

**各地域・各団体は、GitHubのフォークやデプロイ作業は不要です。**  
スプレッドシートを準備するだけで、すぐに自分たちのまち歩きアプリが使えます。

### ① スプレッドシートをコピーする

[テンプレートスプレッドシート（増田サンプル）](https://docs.google.com/spreadsheets/d/1fugAECsnEQIHXgQh1qyPOaLJL-6wMuW0B4dA6Ac6k24)を開き、  
「ファイル」→「コピーを作成」でご自身のGoogleアカウントにコピーします。

> **重要：** スプレッドシートにはAPI連携の設定が組み込まれています。  
> コピー後はスプレッドシート内の各設定を貴団体の情報に書き換えてください。  
> シート名・列の順序は変更しないでください。

### ② スプレッドシートを公開設定にする

スプレッドシートの「共有」→「リンクを知っている全員が閲覧可」に設定します。

### ③ スプレッドシートIDを確認する

```
https://docs.google.com/spreadsheets/d/【ここがシートID】/edit
```

### ④ アプリのURLにシートIDを付けて完成

安定版（推奨）：

```
https://kosa-e-mon.github.io/machi-aruki-guide/?sid=【あなたのシートID】
```

先行開発版（新機能のテスト用）：

```
https://kosa-e-mon.github.io/local-walk-guide/?sid=【あなたのシートID】
```

このURLをQRコード化して観光パンフレットに掲載するだけで運用開始できます。

---

### フォークして独自デプロイする場合

Google Analytics・Google OAuth を独自設定したい場合など、高度なカスタマイズが必要な場合はフォークしてください。

1. GitHubの「Fork」ボタンでリポジトリをコピー
2. `index.html` をテキストエディタで開き、各種APIキーを設定
3. GitHub Pages で公開（「Settings」→「Pages」→「Branch: main / root」）

> **フォーク時もクレジット表記の維持が必須です。**  
> 詳細は[クレジット表記について](#クレジット表記について重要)を参照してください。

---

## 運営ツール

### 🗺️ データエディタ（`editor.html`）

スプレッドシートの全シートを読み込み、ブラウザ上で編集できる運営者向けツールです。

- フォーム形式／表形式の切り替え編集、ドラッグ操作での並び替え
- 配色・文字サイズ・ライト／ダークの**実機風プレビュー**（修了証のプレビュー含む）
- 編集結果はCSV一括保存、またはGoogle Apps Script連携でシートへ直接保存
- アプリURLの生成・QRコード表示・シート接続テスト

### 📋 フィールド調査（`survey.html`）

現地を歩きながらスポット候補を記録するモバイル向けツールです。

- GPSでその場の座標を取得してスポット・施設（トイレ・駐車場など）を登録
- 到着判定距離・接近通知距離を、実際に現地に立ちながら調整・検証
- 記録したデータはCSV保存してスプレッドシートへ反映

> 「観光客をどこに立たせるか」「どの範囲で到着とするか」を、  
> 地域を知る担当者が現地で体感しながら決められることが本アプリの要です。

### 🎙️ メディア変換・GitHub登録（`media-uploader.html`）

音声・画像をアプリ用の形式に変換し、GitHubリポジトリへ直接アップロードするツールです。

- 音声：WAV → MP3 変換（到着・接近・解説・次へ・スタート・ゴールの種別に対応）
- 画像：JPEG/PNG → WebP 変換
- GitHub API経由でリポジトリへ直接登録（要アクセストークン）

---

## スプレッドシート構成

| シート名 | 内容 |
|----------|------|
| `config` | アプリ全体の設定（タイトル・カラー・天気・修了証など） |
| `courses` | コース一覧（コース名・距離・所要時間・公開期間など） |
| `spots` | スポット情報（場所・説明・音声・写真） |
| `course_spots` | コースとスポットの対応関係 |
| `facilities` | 施設情報（トイレ・駐車場など周辺アナウンス） |

### spots シートの主要列

| 列名 | 内容 | 必須 |
|------|------|------|
| `spot_id` | スポットID（英数字） | ✅ |
| `spot_name` | スポット名 | ✅ |
| `lat` / `lng` | 緯度・経度 | ✅ |
| `description` | 説明文（TTSのテキストにも使用） | ✅ |
| `arrive_dist` | 到着判定距離（m）デフォルト15 | |
| `approach_dist` | 接近通知距離（m）デフォルト50 | |
| `audio_approach_url` | 接近予告MP3のGoogle Drive URL | |
| `audio_arrive_url` | 到着時MP3のGoogle Drive URL | |
| `audio_explain_url` | 解説MP3のGoogle Drive URL | |
| `audio_next_url` | 次スポット誘導MP3のGoogle Drive URL | |
| `audio_start_url` | スタートスポットの開始音声MP3 URL | |
| `audio_goal_url` | 最終スポットへの誘導MP3 URL | |
| `photo_url` | 写真のGoogle Drive URL | |
| `keywords` | キーワード（カンマ区切り） | |

### courses シートの主要列（抜粋）

| 列名 | 内容 |
|------|------|
| `course_id` / `course_name` | コースID・コース名 |
| `course_description` / `course_notes` | コース説明・補足 |
| `course_type` | コース種別（`市街地` / `公園` / `混在`）── 注意喚起アナウンスに使用 |
| `distance_m` / `duration_min` | 距離（m）・所要時間（分） |
| `recommended` / `display_order` | おすすめ表示・並び順 |
| `start_date` / `end_date` | 公開期間（期間限定コース） |
| `audio_theme_url` / `theme_text` | コース開始時のテーマ音声・文言 |
| `audio_finish_url` | 完走時の音声 |
| `course_thumbnail_url` | サムネイル画像URL |

---

## config設定一覧

`config` シートは `key` / `value` の縦並び形式です。主な項目をカテゴリ別に示します。

### 基本設定

| key | デフォルト | 説明 |
|-----|-----------|------|
| `app_title` | まち歩き | アプリのタイトル |
| `app_subtitle` | コースを選んでください | サブタイトル |
| `area_display` | custom | エリア表示モード（`custom` / `pref+city` / `pref+city+town` など） |
| `area_name` | （空） | エリア名（area_display=custom時。御朱印・完歩証にも使用） |
| `area_pref` / `area_city` / `area_town` | （空） | 都道府県・市区町村・町名 |
| `prefecture` / `city` | （空） | 都道府県・市区町村（御朱印の授与記録用） |
| `lang` | ja | UI言語（多言語辞書は整備中。未設定時は日本語） |

### 外観設定

| key | デフォルト | 説明 |
|-----|-----------|------|
| `color_primary` | #B83232 | メインカラー（ボタン・アクセント） |
| `color_bg` / `color_paper` | #F4EFE4 / #FAF7F1 | 背景色・カード背景色 |
| `color_ink` / `color_muted` | #1C1A16 /（既定値） | 文字色・補助文字色 |
| `color_gold` / `color_border` | #9A7A3A /（既定値） | ゴールドカラー・枠線色 |
| `font_title` / `font_body` | （既定値） | 見出し・本文のフォントファミリー |
| `font_size_base` / `font_size_heading` / `font_size_explain` | 14px / 20px / 14px | 基本・見出し・解説の文字サイズ |
| `app_title_color` / `app_title_font` / `app_title_font_size` | （空） | タイトルの色・フォント・サイズ個別指定 |
| `app_subtitle_color` / `app_subtitle_font` / `app_subtitle_font_size` | （空） | サブタイトルの個別指定 |
| `header_type` | （空） | `image` にすると画像ヘッダーを使用 |
| `header_image_url` | （空） | ヘッダー画像URL |
| `header_style` | A | ヘッダースタイル（`A` / `B` / `C`） |
| `home_badge_*` | （空） | ホーム画面バッジ（`text` / `font_size` / `color` / `border` 系 / `top`・`bottom`・`left`・`right` で文言・装飾・位置を指定） |

### 天気・熱中症（WBGT）設定

| key | デフォルト | 説明 |
|-----|-----------|------|
| `weather_lat` / `weather_lng` | （空） | 天気予報の基準座標。未設定時は最初のスポット座標を使用 |
| `wbgt_enabled` | （空） | `TRUE` で熱中症指数（WBGT）表示を有効化 |
| `wbgt_point_code` | （空） | 環境省WBGTの地点コード（例：横手 = 32596） |
| `wbgt_proxy_url` | （空） | 公式WBGT値を中継するGoogle Apps ScriptのURL。未設定時は気温・湿度からの推定値を表示 |

### 動作設定

| key | デフォルト | 説明 |
|-----|-----------|------|
| `next_lock_sec` | （空） | 到着後「次へ」ボタンをロックする最大秒数。音声完了で自動解除。保険として **45** を推奨 |
| `max_nearby_courses` | 3 | ホーム「近くから始められるコース」の最大表示数 |
| `walk_accuracy_max_m` | 50 | 歩行距離計測に使うGPS精度の上限（m） |
| `walk_segment_max_m` | 50 | 1回の計測で加算する距離の上限（m） |
| `walk_speed_limit_kmh` / `walk_resume_kmh` | 7 / 5.5 | 歩行とみなす速度の上限・再開閾値（km/h） |
| `walk_speed_hits` | 2 | 速度超過を確定するまでの連続検知回数 |

> 歩行計測系（`walk_*`）は通常変更不要です。

### 期間限定イベント設定

| key | 説明 |
|-----|------|
| `special_enabled` | `TRUE` で特別イベント演出を有効化 |
| `special_start_date` / `special_end_date` | イベント期間（開始日・終了日） |
| `audio_special_start_url` / `audio_special_goal_url` | イベント時のコース開始・完走の特別音声MP3 URL |

### 注意喚起アナウンス設定

| key | 説明 |
|-----|------|
| `caution_shigaichi` / `caution_koen` / `caution_konzai` | コース種別（市街地・公園・混在）ごとの注意文言（TTS読み上げ。既定文あり） |
| `caution_shigaichi_url` / `caution_koen_url` / `caution_konzai_url` | 注意アナウンスのMP3 URL（設定時はTTSより優先） |

### 完歩証（修了証）設定

| key | デフォルト | 説明 |
|-----|-----------|------|
| `cert_award_title` | 修了証 | 賞状のタイトル（「完歩証」など） |
| `cert_issuer` | area_nameの値 | 発行者名（学校利用時などに変更） |
| `cert_body_text` | （空） | 本文の追加文言 |
| `cert_seal_text` | （空） | 印影（ハンコ）の文字 |
| `cert_title_*` | （既定値） | タイトルの書式（`font_family` / `font_size` / `letter_spacing`） |
| `cert_seal_*` | （既定値） | 印影の書式（`size` / `bg` / `border_color` / `border_width` / `font_family` / `text_size` / `text_color` / `line_height`） |

### 上級設定（Google連携）

| key | 説明 |
|-----|------|
| `ga_measurement_id` | Google Analytics 4のMeasurement ID（`G-XXXXXXXXXX`形式）※index.htmlに直接記載 |

---

## 音声ガイドについて

### MP3ファイルの準備

1. Google Driveに音声ファイルをアップロード
2. ファイルを「リンクを知っている全員が閲覧可」に共有設定
3. 共有リンクをスプレッドシートのURL列に貼り付け

> 音声の変換（WAV→MP3）とアップロードは、同梱の `media-uploader.html` でも行えます。

### 音声の優先順位

```
接近時：audio_approach_url（MP3）→ なければTTS「まもなく○○です」
到着時：audio_arrive_url（MP3）→ なければTTS読み上げ
解説　：audio_explain_url（MP3）→ なければTTS読み上げ（到着がTTSの場合のみ）
次誘導：audio_next_url（MP3）→ なければTTS読み上げ
　　　　（最終スポットへの誘導は audio_goal_url を使用）
```

> ⚠️ **到着音声にMP3を使用した場合、解説のTTS読み上げは自動的に抑制されます。**

このほか、コース開始時のテーマ音声（`audio_theme_url`）、完走時の音声（`audio_finish_url`）、  
期間限定イベント音声（`audio_special_start_url` / `audio_special_goal_url`）を設定できます。

### 音声ガイドのガイドライン

まち歩きの屋外環境を考慮し、以下を制作の目安としてください。

- **目標：20〜30秒**（原稿150〜200文字程度）
- 専門用語より「へぇ！」と感じるエピソードを優先
- 長くても1スポット45秒以内を推奨

---

## Google Analytics 4 の設定

1. [Google Analytics](https://analytics.google.com/) でプロパティを作成
2. Measurement ID（`G-XXXXXXXXXX`形式）を取得
3. `index.html` 内の該当箇所を書き換え

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### 計測されるイベント

| イベント名 | 計測タイミング |
|-----------|---------------|
| `spot_arrive` | スポット到着時（auto：GPS自動 / manual：手動） |
| `course_start` | コース開始時 |
| `course_complete` | コース完走時 |

---

## コミュニティ・サポート

### 基本的な考え方

本プロジェクトはオープンソースですが、コミュニティへの参加と導入サポートは  
**地域の観光・まちづくりに本気で取り組む団体・担当者を対象**としています。

ツールとして自由に使っていただくことは歓迎しますが、  
将人さんと一緒に取り組む関係を築くには、**まず増田に来てください。**

増田の内蔵を実際に歩き、アプリを体験し、このプロジェクトが何を目指しているかを  
感じてもらうことが、すべての出発点です。

---

### サポートの二層構造

**① フォーク・自由利用（サポートなし）**

- GitHubからフォークして自由に使えます
- クレジット表記の維持のみ必須
- 個別サポートはありません

**② コミュニティ参加（サポートあり）**

- 増田まち歩きの現地体験が前提
- 観光協会・自治体観光部署・まちづくり団体に所属していること
- 参加申請時に所属団体と活用目的を明記

---

### 参加対象

以下に該当する方を対象としています。

- 観光協会・観光ガイド団体に所属している
- 自治体の観光・まちづくり関連部署に所属している
- 地域の魅力発信を目的とした任意団体・NPOに属している
- 上記に準ずる活動をしており、増田への現地訪問が可能な方

> 一般企業・個人・観光と無関係の団体からの参加はご遠慮いただいています。  
> 熱量のある方が集まる場として運営しています。

---

### コミュニティの場（整備中）

| 用途 | ツール | 状況 |
|------|--------|------|
| 個別相談・不具合報告 | メール | 運用中 |
| バージョンアップ情報・事例共有 | Googleグループ | 準備中 |
| 定期オンライン情報交換会 | Google Meet | 導入団体が集まり次第開催予定 |
| バグ報告・機能要望 | GitHub Issues | 運用中 |

**メール：** masato.kosaka@gmail.com

---

## クレジット表記について（重要）

### アプリ内クレジット（削除・改変禁止）

アプリのホーム画面下部に表示されている以下の表記は、  
**削除・非表示化・改変をしないでください。**

```
企画・ディレクション：小坂将人
増田町観光協会理事 ／ 増田町観光ガイドの会理事
```

他地域向けにカスタマイズして公開する場合は、上記に加えてご自身の情報を**追記**する形で対応してください。

### READMEへの記載

フォークしたリポジトリのREADMEに、以下を記載してください。

```
このアプリは local-walk-guide（https://github.com/Kosa-E-Mon/local-walk-guide）を
ベースに構築されています。
Original: 小坂将人（増田町観光ガイドの会）
```

---

## ライセンス

本ソフトウェアはMITライセンスに準拠しますが、**クレジット表記の維持を追加条件とします。**

```
MIT License with Attribution Requirement

Copyright (c) 2024 小坂将人（Masato Kosaka）
増田町観光ガイドの会 / 増田町観光協会
Masuda Town Tourism Guide Association, Yokote City, Akita, Japan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, subject to the following conditions:

1. The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

2. The credit text displayed in the application's home screen footer
   ("企画・ディレクション：小坂将人 / 増田町観光協会理事 ／ 増田町観光ガイドの会理事")
   must not be removed or obscured. Additional attribution may be added,
   but the original credit must remain visible.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

---

*本アプリは増田町の地域活性化を目的に開発されました。*  
*同じ思いを持つ全国の地域・観光協会の皆さんにご活用いただけることを願っています。*  
*— 小坂将人（増田町観光ガイドの会）*
