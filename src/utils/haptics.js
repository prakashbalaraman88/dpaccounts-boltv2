// Lightweight haptic feedback helper. Falls back gracefully on web or when
// Expo Haptics is not installed.

let Haptics = null;

try {
  Haptics = require('expo-haptics');
} catch {
  // expo-haptics not installed — ignore
}

function run(method, arg) {
  if (!Haptics?.[method]) return;
  try {
    Haptics[method](arg);
  } catch {
    // ignore haptic errors
  }
}

export function impactLight() {
  run('impactAsync', Haptics?.ImpactFeedbackStyle?.Light);
}

export function impactMedium() {
  run('impactAsync', Haptics?.ImpactFeedbackStyle?.Medium);
}

export function impactHeavy() {
  run('impactAsync', Haptics?.ImpactFeedbackStyle?.Heavy);
}

export function notificationSuccess() {
  run('notificationAsync', Haptics?.NotificationFeedbackType?.Success);
}

export function notificationWarning() {
  run('notificationAsync', Haptics?.NotificationFeedbackType?.Warning);
}

export function notificationError() {
  run('notificationAsync', Haptics?.NotificationFeedbackType?.Error);
}
