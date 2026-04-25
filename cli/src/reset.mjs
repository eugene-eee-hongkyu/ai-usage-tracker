import { loadApiKey, runInit } from "./init.mjs";

export async function runReset() {
  const existing = await loadApiKey();
  if (!existing) {
    console.log("설치된 API 키가 없습니다. 새로 설치합니다.\n");
  } else {
    console.log("기존 API 키를 삭제하고 재인증합니다.\n");
  }
  await runInit();
}
