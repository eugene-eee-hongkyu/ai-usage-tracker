import type { Messages } from "./en";
import type { DeepPartial } from "../index";

export const ja: DeepPartial<Messages> = {
  brand: "AI Usage Tracker",
  nav: {
    personal: "個人",
    unified: "統合",
    team: "チーム",
    setup: "セットアップ",
    logout: "ログアウト",
    admin: "管理者",
  },
  about: {
    title: "バージョン情報",
    headerLocal: "同梱",
    headerCloud: "推奨バージョン",
    loading: "読み込み中...",
  },
  dashboard: {
    loading: {
      title: "データ収集中",
      body1: "codeburn と ccusage がバックグラウンドで実行中です。",
      body2: "通常 30 秒 ~ 1 分以内に自動的に表示されます。",
      polling: "5 秒ごとに自動更新中…",
    },
    cards: {
      myCost: "コスト推移",
      unitCost: "日別トークン単価 ($ / 1M)",
      unitCostHint: "グレー線より下 = 自分の平均より良い日 · 黄色より下 = plan の元を取っている · log scale",
      unitCostLegendActual: "自分の単価",
      unitCostLegendPersonalAvg: "自分の平均",
      unitCostLegendApiAvg: "Plan なしの場合",
      apiUnitCost: "API 換算単価 ($ / 1M)",
      apiUnitCostHint: "Anthropic API 直接呼び出し換算 · plan 節約効果",
      planTierMissing: "Plan tier 未入力 — 上の plan-health カードで選択",
      noActivityHint: "アクティビティデータがまだありません。ターミナルで CLI sync が動作しているか確認してください。活動が記録されると plan tier を入力した際に単価が表示されます。",
      planSavings: "Plan 節約",
      planSavingsApiLabel: "Plan なしの場合",
      planSavingsPlanLabel: "Plan 料金",
      planSavingsSavedLabel: "節約",
      planSavingsHint: "この期間の API 換算コスト vs plan 料金 · tier 未入力時は推定",
      planSavingsEstimatedLabel: "推定",
      planSavingsMonthlySuffix: "/月",
    },
    syncNeeded: {
      title: "sync needed",
      body: "ターミナルで以下のコマンドを実行してください。",
      copy: "コピー",
    },
  },
  wizard: {
    title: "AI Usage Tracker — セットアップ",
    step1: {
      heading: "ようこそ",
      lead: "Claude Code の使用量をこの PC で直接収集し、ダッシュボードで表示します。",
      legacyFound: "既存の社内サーバー接続が見つかりました。",
      legacyNotFound: "既存の社内サーバー接続はありません。",
    },
    destinations: {
      heading: "データの保存先は?",
      hint: "後で ~/.usage-tracker/config.json を直接編集して変更できます。",
      localOnly: "この PC のみ — 100% プライベート、外部送信なし",
      localAndCompany: "この PC + 社内サーバー — 両方同時同期 (社内メンバー推奨)",
      companyOnly: "社内サーバーのみ — 従来通り、ローカル DB 不使用",
    },
    actions: {
      continue: "続ける",
      back: "戻る",
      openDashboard: "ダッシュボードを開く",
      retry: "再試行",
    },
    saving: "保存中…",
    saved: "セットアップ完了!",
    error: "問題が発生しました",
  },
  dashboardView: {
    staleSyncTitle: "自動収集が停止",
    staleSyncBody: "最終同期から {n} 時間経過。launchd が停止しているか、ノートPC が長時間オフの可能性があります。",
    staleSyncRepairLabel: "ターミナルで:",
    staleSyncCopy: "コピー",
    staleSyncCopied: "コピー済み",
  },
  onboardTeam: {
    greeting: "ようこそ",
    nameSuffix: (name: string) => `、${name} さん`,
    sub: "あなたはこの会社の管理者です。まず会社名を設定してください。",
    fieldLabel: "会社名",
    placeholder: "例: thenexa",
    helper:
      "チームメンバー招待やランキングなどで表示されます。後で管理者設定から変更できます。",
    submit: "保存して開始",
    submitting: "保存中…",
    errorSlugTaken: (slug: string) =>
      `この名前はすでに使われています (${slug})。別の名前を入力してください。`,
    errorAlreadyNamed: "このチームはすでに名前が設定されています。",
    errorInvalidName: "会社名は1〜80文字で入力してください。",
  },
  dashboardAdminBanner: {
    title: "管理者として設定されています",
    body: "ご自身の Claude Code 利用も追跡したい場合は CLI をインストールしてください。",
    cta: "CLI をインストール",
  },
  teamList: {
    namePending: "(名前未設定)",
  },
};
