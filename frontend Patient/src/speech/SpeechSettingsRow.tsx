import React from 'react';
import { setDoubleTapEnabled } from '../i18n/SpeechContext';
import { ListRow } from '../components/ui/ListRow';
import { NeuToggle } from '../components/ui/Neu';
import { useScripts } from './scripts';
import { useSpeechSelector } from './store';

/**
 * Settings: "Double tap to hear" on / off. Off = no speech on double tap and no wait on single
 * taps. The row stays readable when off (the toggle explains itself on a double tap when on).
 */
export const SpeechSettingsRow: React.FC = () => {
  const scripts = useScripts();
  const enabled = useSpeechSelector((s) => s.enabled);
  return (
    <ListRow
      icon="listen"
      title={scripts.settings.row}
      subtitle={scripts.settings.rowHint}
      speech={() => scripts.settings.toggle(enabled)}
      trailing={
        <NeuToggle
          value={enabled}
          onValueChange={setDoubleTapEnabled}
          accessibilityLabel={scripts.settings.row}
          speech={() => scripts.settings.toggle(enabled)}
        />
      }
    />
  );
};
