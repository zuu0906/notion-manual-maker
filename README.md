# Chrome Manual Maker — Desktop版

Chrome拡張と同じUI・Notion保存機能を持つElectronデスクトップアプリ。
**あらゆるウィンドウ（Excel, 業務システム, デスクトップアプリ）**をスクリーンショットしてマニュアルを作成できる。

## 機能

- **Ctrl+Shift+M** グローバルホットキーでスクリーンショット撮影
- クリックで撮影ポイントを指定 → 赤丸+番号バッジを自動描画
- Notion連携・保存（既存の拡張機能と共通のSupabaseバックエンド）
- AI説明文自動生成（Standard/Proプラン）
- システムトレイ常駐

---

## セットアップ

### 1. 依存パッケージをインストール

```bash
cd desktop
npm install
```

### 2. Google OAuth2 クライアントの設定（必須）

**Google Cloud Console** で「デスクトップアプリ」用のOAuth2クライアントを作成する。

1. https://console.cloud.google.com → APIとサービス → 認証情報
2. 「認証情報を作成」→「OAuth クライアント ID」
3. アプリケーションの種類：**デスクトップ アプリ**
4. 作成後に表示される **クライアントID** と **クライアントシークレット** を控える

環境変数として設定：

```bash
# Windows (PowerShell)
$env:GOOGLE_DESKTOP_CLIENT_ID="your-client-id.apps.googleusercontent.com"
$env:GOOGLE_DESKTOP_CLIENT_SECRET="your-client-secret"
```

または `desktop/` 直下に `.env.local` ファイルを作成（gitignore済み）：
```
GOOGLE_DESKTOP_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_DESKTOP_CLIENT_SECRET=your-client-secret
```

### 3. Notion インテグレーションのリダイレクトURI設定（必須）

Notionインテグレーションの設定ページで、以下のリダイレクトURIを追加：

```
http://localhost:3721/callback
```

### 4. トレイアイコン（任意）

`desktop/assets/tray.png` に16×16のPNG画像を配置するとシステムトレイにアイコンが表示される。
配置しなくてもエラーにはならない（アイコンなし）。

---

## 起動

```bash
cd desktop
npm start
```

---

## ビルド（配布用）

```bash
# Windows .exe
npm run build:win

# Mac .dmg
npm run build:mac
```

ビルド成果物は `dist/` に出力される。

---

## Chrome拡張との違い

| 機能 | Chrome拡張 | デスクトップ版 |
|---|---|---|
| 撮影対象 | Chromeタブのみ | **あらゆるウィンドウ** |
| 起動方法 | ツールバーアイコン | システムトレイ + Ctrl+Shift+M |
| 自動クリック検出 | あり（content.js） | なし（手動でホットキー） |
| PDF出力 | ○ (Standard+) | MVP外（後回し） |
| PII自動検出 | ○ (DOM走査) | MVP外（後回し） |
