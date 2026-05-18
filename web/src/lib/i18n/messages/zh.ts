import type { Messages } from "./en";
import type { DeepPartial } from "../index";

export const zh: DeepPartial<Messages> = {
  brand: "AI Usage Tracker",
  nav: {
    personal: "个人",
    team: "团队",
    setup: "设置",
    logout: "登出",
    admin: "管理员",
  },
  about: {
    title: "版本信息",
    headerLocal: "随附",
    headerCloud: "推荐版本",
    loading: "加载中...",
  },
  dashboard: {
    loading: {
      title: "正在收集数据",
      body1: "codeburn 和 ccusage 正在后台运行。",
      body2: "通常 30 秒到 1 分钟内自动显示。",
      polling: "每 5 秒自动刷新…",
    },
    cards: {
      myCost: "我的成本",
      unitCost: "每日 Token 单价 ($ / 1M)",
      unitCostHint: "越低代表 plan 使用越高效 · 无活动日折线断开 · log scale",
    },
    syncNeeded: {
      title: "sync needed",
      body: "在终端中运行以下命令。",
      copy: "复制",
    },
  },
  wizard: {
    title: "AI Usage Tracker — 设置",
    step1: {
      heading: "欢迎",
      lead: "在此 PC 上直接收集 Claude Code 使用量并显示在仪表板。",
      legacyFound: "检测到此设备上已有公司服务器的连接痕迹。",
      legacyNotFound: "未发现现有公司服务器连接。",
    },
    destinations: {
      heading: "数据保存到哪里?",
      hint: "稍后可直接编辑 ~/.usage-tracker/config.json 修改。",
      localOnly: "仅本机 — 100% 私密,不外传",
      localAndCompany: "本机 + 公司服务器 — 两端同步 (推荐团队成员)",
      companyOnly: "仅公司服务器 — 与之前相同,不使用本地 DB",
    },
    actions: {
      continue: "继续",
      back: "返回",
      openDashboard: "打开仪表板",
      retry: "重试",
    },
    saving: "保存中…",
    saved: "设置完成!",
    error: "发生错误",
  },
  dashboardView: {
    staleSyncTitle: "自动采集已停止",
    staleSyncBody: "上次同步在 {n} 小时前。launchd 可能已停止,或笔记本长时间未开启。",
    staleSyncRepairLabel: "在终端中:",
    staleSyncCopy: "复制",
    staleSyncCopied: "已复制",
  },
};
