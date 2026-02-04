# Account Identifier - 要件定義書

## 1. 概要

### 1.1 目的

Firefox Multi-Account Containers利用時に、別のコンテナに紐づけられたアカウントのリソースに対して誤った操作（PRの作成、コメントの投稿など）を行うことを防止するFirefox拡張機能。

### 1.2 想定ユースケース

| シナリオ | 状態 | 期待動作 |
|---------|------|---------|
| コンテナAでアカウントAのリポジトリを閲覧 | 正常 | 何もしない |
| コンテナAでアカウントBのリポジトリを閲覧 | **不一致** | 正しいコンテナのタブで自動的に開き直す（現在のタブは閉じる） |
| コンテナAで未登録アカウントのリポジトリを閲覧 | 未知 | 何もしない |
| コンテナAでアカウントAのorgリポジトリを閲覧 | 正常（orgも登録済みの場合） | 何もしない |

### 1.3 技術スタック

- **フレームワーク**: WXT (WebExtension Toolbox)
- **UI**: React
- **対象ブラウザ**: Firefox（Multi-Account Containers対応）
- **言語**: TypeScript

---

## 2. 機能要件

### 2.1 コンテナ - アカウントマッピング管理

#### 2.1.1 マッピング登録

- ユーザーがポップアップUIからコンテナごとにサービスとアカウントIDを手動で登録できる
- 1つのコンテナに対して複数のサービス・複数のアカウントIDを登録可能
  - 例: コンテナAに `github: ["user-a", "org-x"]` と `aws: ["123456789012"]` を登録
- コンテナの一覧はFirefoxの `contextualIdentities` APIから取得する

#### 2.1.2 マッピング編集・削除

- 登録済みのマッピングを編集・削除できる
- コンテナが削除された場合、対応するマッピングも削除される（または無効化される）

#### 2.1.3 データモデル

```typescript
type ServiceId = string; // e.g., "github", "aws", "google"

interface ContainerMapping {
  cookieStoreId: string;       // FirefoxコンテナのcookieStoreId
  services: ServiceMapping[];
}

interface ServiceMapping {
  serviceId: ServiceId;
  accountIds: string[];        // そのコンテナで使うアカウントID群
}
```

#### 2.1.4 データ永続化

- `browser.storage.local` を使用して保存
- データ構造:

```typescript
interface StorageSchema {
  containerMappings: ContainerMapping[];
}
```

---

### 2.2 サービスプロバイダー（拡張可能な設計）

各サービスの固有ロジックをプロバイダーパターンで抽象化する。

#### 2.2.1 プロバイダーインターフェース

```typescript
interface ServiceProvider {
  /** サービスID（一意） */
  id: ServiceId;

  /** 表示名 */
  displayName: string;

  /** このサービスに対応するURLパターン（content_scripts matches用） */
  urlPatterns: string[];

  /**
   * URLからアカウントID（オーナー名）を抽出する
   * マッチしない場合はnullを返す
   */
  extractOwnerFromUrl(url: URL): string | null;

}
```

#### 2.2.2 GitHub プロバイダー（初期実装）

```typescript
const githubProvider: ServiceProvider = {
  id: "github",
  displayName: "GitHub",
  urlPatterns: ["*://github.com/*"],
  extractOwnerFromUrl(url: URL): string | null {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    // /orgs/{org}/... や /users/{user}/... の場合は第2セグメントがオーナー
    const ownerPrefixes = ["orgs", "users"];
    if (ownerPrefixes.includes(segments[0])) {
      return segments[1] ?? null;
    }

    const owner = segments[0];
    // 除外パス（settings, notifications, etc.）
    const excludedPaths = [
      "settings", "notifications", "new", "login",
      "signup", "explore", "topics", "trending",
      "collections", "events", "sponsors", "features",
      "marketplace", "pulls", "issues", "codespaces",
      "organizations"
    ];
    if (excludedPaths.includes(owner)) return null;
    return owner;
  },
};
```

### 2.3 コンテナ自動切り替え

不一致検出時、ユーザー操作を介さずに正しいコンテナで自動的に開き直す。

#### 2.3.1 自動リダイレクトフロー

1. Content Scriptが不一致を検出する
2. Background Scriptへ `openInContainer` メッセージを送信する（正しいcookieStoreIdと現在のURLを含む）
3. Background Scriptが正しいcookieStoreIdを指定して同じURLのタブを新規作成する（`browser.tabs.create({ url, cookieStoreId })`）
4. 現在のタブを閉じる（`browser.tabs.remove()`）

---

### 2.4 判定ロジック

#### 2.4.1 判定フロー

```
1. タブのcookieStoreIdを取得（= 現在のコンテナを特定）
2. 現在のURLに対してServiceProviderのマッチングを行う
3. マッチしたServiceProviderのextractOwnerFromUrlでオーナーを抽出
4. 抽出したオーナーが登録済みかチェック:
   a. 現在のコンテナに紐づいている → 正常（何もしない）
   b. 別のコンテナに紐づいている → 正しいコンテナで開き直す
   c. どのコンテナにも紐づいていない → 何もしない
```

#### 2.4.2 判定タイミング

- ページ読み込み時（content script実行時）
- URL変更時（SPA対応）:
  - Background Scriptで `browser.webNavigation.onHistoryStateUpdated` を監視し、Content Scriptへ再判定を通知する
  - `popstate` イベントも補助的に監視する（ブラウザの戻る/進む操作への対応）

---

## 3. 画面設計

### 3.1 ポップアップUI

```
┌─────────────────────────────────┐
│  Account Identifier             │
├─────────────────────────────────┤
│                                 │
│  コンテナ: [Personal ▼]        │
│                                 │
│  ── GitHub ──────────────────── │
│  ┌─────────────────────────┐   │
│  │ user-a              [×] │   │
│  │ org-x               [×] │   │
│  │ [+ アカウント追加]       │   │
│  └─────────────────────────┘   │
│                                 │
│  [+ サービス追加]               │
│                                 │
├─────────────────────────────────┤
│  コンテナ: [Work ▼]            │
│  ...                            │
└─────────────────────────────────┘
```

---

## 4. アーキテクチャ

### 4.1 コンポーネント構成

```
entrypoints/
├── background.ts          # バックグラウンドスクリプト
│                           # - マッピングデータの管理
│                           # - タブ情報の提供
│                           # - コンテナ間でタブを開く処理
│                           # - webNavigation.onHistoryStateUpdatedの監視
├── content.ts             # コンテンツスクリプト
│                           # - ページURLからオーナー抽出
│                           # - コンテナ不一致時のリダイレクト要求
│                           # - SPA対応: backgroundからの再判定通知受信
├── popup/                 # ポップアップUI
│   ├── App.tsx            # マッピング管理画面
│   └── ...
└── ...

lib/
├── providers/             # サービスプロバイダー
│   ├── index.ts           # プロバイダーレジストリ
│   ├── github.ts          # GitHubプロバイダー
│   └── ...                # 将来の追加サービス
├── storage.ts             # storage.local のラッパー
├── types.ts               # 共通型定義
└── messaging.ts           # background ↔ content 間のメッセージング
```

### 4.2 コンポーネント間通信

```
[Content Script] ──(message)──→ [Background Script]
     │                                │
     │  "getContainerInfo"            │ tabs.get() → cookieStoreId
     │  "getMappings"                 │ storage.local.get()
     │  "openInContainer"             │ tabs.create() with cookieStoreId
     │                                │
     ↓                                ↓
[リダイレクト要求]            [マッピングデータ管理]
                              [Popup UI] ──(storage)──→ [storage.local]
```

---

## 5. 必要なブラウザAPI・パーミッション

| API | 用途 |
|-----|------|
| `contextualIdentities` | コンテナ一覧の取得 |
| `cookies` | cookieStoreIdの操作（コンテナでタブを開く際） |
| `tabs` | タブのcookieStoreId取得、コンテナ指定でタブを開く |
| `storage` | マッピングデータの永続化 |
| `webNavigation` | SPA対応: `onHistoryStateUpdated` によるURL変更検知 |
| `notifications`（オプション） | 将来の通知機能拡張用 |

### manifest.json permissions

```json
{
  "permissions": [
    "contextualIdentities",
    "cookies",
    "tabs",
    "storage",
    "webNavigation"
  ],
  "host_permissions": [
    "*://github.com/*"
  ]
}
```

> **注**: `host_permissions` にはサービスプロバイダーの `urlPatterns` と同じドメインを列挙する。プロバイダー追加時にここも更新する必要がある。Content Scriptの `matches` と `webNavigation.onHistoryStateUpdated` のフィルタリングの両方にホストパーミッションが必要。

---

## 6. 将来の拡張

### 6.1 サービスプロバイダーの追加

新しいサービスを追加する際は `ServiceProvider` インターフェースを実装するだけでよい:

- **AWS**: `aws.amazon.com` のアカウントIDを判定
- **Google**: Googleアカウント切り替え検出
- **GitLab**: GitHub同様のURL構造ベースの判定

### 6.2 機能拡張候補

- ブラウザ通知との併用
- アカウントの自動検出（ページ内DOM解析）
- インポート/エクスポート機能

---

## 7. 制約・注意事項

- Firefox専用（Multi-Account Containersが必要）
