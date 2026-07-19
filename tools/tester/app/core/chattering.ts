export const CHATTER_THRESHOLD_MS = 30

export interface ChatterResult {
  isChattering: boolean
  interval: number
}

export function detectChattering(lastKeyupTime: number, currentTime: number): ChatterResult {
  if (lastKeyupTime === 0) {
    return { isChattering: false, interval: 0 }
  }

  const interval = currentTime - lastKeyupTime

  return {
    isChattering: interval < CHATTER_THRESHOLD_MS,
    interval,
  }
}
