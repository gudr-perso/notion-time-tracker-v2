// src/core/storage.js — accès typé à chrome.storage.local (seul module UI qui l'utilise directement).
const local = () => chrome.storage.local;

export async function getConfig() {
  const { config } = await local().get('config');
  return config || null;
}
export async function saveConfig(config) {
  await local().set({ config });
}

export async function getCurrentSession() {
  const { currentSession } = await local().get('currentSession');
  return currentSession || null;
}
export async function setCurrentSession(currentSession) {
  await local().set({ currentSession });
}
export async function clearCurrentSession() {
  await local().remove('currentSession');
}

export async function getTaskHistory() {
  const { taskHistory } = await local().get('taskHistory');
  return taskHistory || [];
}
export async function pushTaskHistory(taskId) {
  const current = await getTaskHistory();
  const next = [taskId, ...current.filter((id) => id !== taskId)].slice(0, 20);
  await local().set({ taskHistory: next });
  return next;
}
