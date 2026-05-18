import type { Messages } from "./en";
import type { DeepPartial } from "../index";

export const ja: DeepPartial<Messages> = {
  brand: "AI Usage Tracker",
  nav: {
    personal: "個人",
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
      unitCostHint: "低いほど plan を有効活用 · アクティビティがない日は線が途切れる · log scale",
      apiUnitCost: "API 換算単価 ($ / 1M)",
      apiUnitCostHint: "Anthropic API 直接呼び出し換算 · plan 節約効果",
      planTierMissing: "Plan tier 未入力 — 上の plan-health カードで選択",
      planSavings: "Plan 節約",
      planSavingsApiLabel: "API 換算",
      planSavingsPlanLabel: "Plan 料金",
      planSavingsSavedLabel: "節約",
      planSavingsHint: "この期間の API 換算コスト vs plan 料金 · tier 未入力時は推定",
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
};
