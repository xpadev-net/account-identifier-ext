# Account Identifier

Firefox Multi-Account Containers 利用時に、コンテナとアカウントの不一致を検知し、正しいコンテナへ自動リダイレクトする拡張機能。

## 機能

- **コンテナ-アカウント マッピング管理**: ポップアップUIからコンテナごとにサービス（GitHub等）とアカウントIDを登録
- **不一致検知・自動リダイレクト**: 別コンテナに紐づくアカウントのページを開いた場合、正しいコンテナで自動的に開き直す
- **ログイン済みアカウントの自動登録**: GitHubにログイン中のユーザーを検知し、現在のコンテナに自動で紐づけ
- **SPA対応**: `webNavigation.onHistoryStateUpdated` と `popstate` によるURL変更の検知

## 対応サービス

- GitHub（初期実装）

プロバイダーパターンにより AWS / Google / GitLab 等への拡張が可能。

## 開発

```bash
pnpm install
pnpm run dev:firefox      # 開発モード（ホットリロード）
pnpm run build:firefox    # プロダクションビルド
pnpm run compile          # TypeScript 型チェック
pnpm run zip:firefox      # 配布用パッケージ作成
```

## 技術スタック

- [WXT](https://wxt.dev/) — WebExtension フレームワーク
- React + TypeScript
- Firefox Multi-Account Containers (`contextualIdentities` API)

## ライセンス

MIT
