import * as Haptics from 'expo-haptics';

// Haptics can reject (web without vibration, iOS low-power mode); feedback is best-effort.
const ignore = () => {};

export const haptic = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore),
  selection: () => Haptics.selectionAsync().catch(ignore),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore),
};
