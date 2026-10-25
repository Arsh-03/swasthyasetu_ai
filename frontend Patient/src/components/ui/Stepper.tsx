import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme/tokens';
import { AppText } from './AppText';
import { type IconName } from './Icon';
import { IconDisc } from './IconDisc';
import { Groove } from './Neu';

export interface Step {
  icon: IconName;
  label: string;
}

interface StepperProps {
  steps: Step[];
  /** Index of the current step; earlier steps show as done. */
  current: number;
  accessibilityLabel: string;
}

/**
 * Show-don't-tell progress: done = inset disc with a success check, current = raised disc
 * with a duotone primary glyph + bold label, upcoming = inset disc with a regular glyph.
 * Steps are joined by grooves. Informational only (not tappable).
 */
export const Stepper: React.FC<StepperProps> = ({ steps, current, accessibilityLabel }) => (
  <View
    style={styles.row}
    accessible
    accessibilityRole="progressbar"
    accessibilityLabel={accessibilityLabel}
    accessibilityValue={{ min: 1, max: steps.length, now: current + 1, text: steps[current]?.label }}
  >
    {steps.map((step, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <React.Fragment key={step.label}>
          {i > 0 && (
            <View style={styles.connector}>
              <Groove />
            </View>
          )}
          <View style={styles.step}>
            <IconDisc
              icon={done ? 'check' : step.icon}
              tone={done ? 'success' : active ? 'primary' : 'neutral'}
              variant={active ? 'raised' : 'inset'}
              active={done || active}
              size={40}
            />
            <AppText variant="caption" weight={active ? 700 : 500} color={active ? 'ink' : 'inkMuted'} compact numberOfLines={2} align="center">
              {step.label}
            </AppText>
          </View>
        </React.Fragment>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 64,
  },
  connector: {
    flex: 1,
    paddingTop: 19,
    paddingHorizontal: spacing.xs,
  },
});
