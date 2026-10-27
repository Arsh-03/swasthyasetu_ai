import { Platform } from 'react-native';
import confetti from 'canvas-confetti';

/**
 * Fires a full Birthday Party Popper celebration with dual cannons,
 * streamers, stars, and multi-colored flutter confetti.
 */
export function triggerBirthdayPopper(originX?: number, originY?: number) {
  // canvas-confetti draws on an HTML canvas: web only (native apps show their own burst animation).
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const colors = [
    '#EF4444', // Festive Red
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#06B6D4', // Cyan
    '#3B82F6', // Royal Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#FBBF24', // Gold
  ];

  const yPos = originY !== undefined ? originY : 0.65;
  const xPos = originX !== undefined ? originX : 0.5;

  try {
    // 1. Center Popper Burst
    confetti({
      particleCount: 70,
      spread: 70,
      startVelocity: 45,
      origin: { x: xPos, y: yPos },
      colors,
      disableForReducedMotion: true,
    });

    // 2. High-spread floating ribbons
    confetti({
      particleCount: 40,
      spread: 100,
      decay: 0.92,
      scalar: 1.2,
      origin: { x: xPos, y: yPos },
      colors,
      disableForReducedMotion: true,
    });

    // 3. Dual Left and Right Birthday Corner Cannons 🎉
    setTimeout(() => {
      confetti({
        particleCount: 45,
        angle: 60,
        spread: 55,
        startVelocity: 50,
        origin: { x: 0.05, y: 0.8 },
        colors,
        disableForReducedMotion: true,
      });

      confetti({
        particleCount: 45,
        angle: 120,
        spread: 55,
        startVelocity: 50,
        origin: { x: 0.95, y: 0.8 },
        colors,
        disableForReducedMotion: true,
      });
    }, 100);
  } catch {
    // Fallback if canvas is not initialized
  }
}
