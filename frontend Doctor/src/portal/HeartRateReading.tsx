// A heart rate the patient measured at home with the phone camera: value, when, how clear, and (for the
// doctor) whether the beat timing was uneven. Always labelled as an estimate.
import { Icon } from '../components/ui/Icon';
import { cx } from '../components/ui/cx';
import type { VitalReading } from '../services/doctorApi';
import { usePortal } from './PortalContext';
import { Pill } from './ui';

export function HeartRateReading({ reading, compact = false }: { reading: VitalReading; compact?: boolean }) {
  const { t, fmt } = usePortal();
  const uneven = (reading.details.irregularity ?? 0) > 0.15;
  return (
    <div className={cx('flex items-start gap-3', compact ? '' : 'rounded-control border border-hairline p-3')}>
      <Icon name="vitals" size={compact ? 20 : 24} tone={reading.out_of_range ? 'danger' : 'primary'} weight="duotone" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          <span className={cx('text-lg font-semibold tabular-nums', reading.out_of_range && 'text-danger-deep')}>{reading.value}</span>{' '}
          <span className="text-ink-muted">{t('bpmShort')}</span>
        </p>
        <p className="text-2xs text-ink-muted">{fmt.dateTime(reading.created_at)} · {reading.method === 'camera_ppg' ? t('cameraEstimate') : t('enteredByPatient')}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {reading.confidence && <Pill tone={reading.confidence === 'good' ? 'success' : 'warning'} label={reading.confidence === 'good' ? t('clearReading') : t('fairReading')} />}
          {reading.out_of_range && <Pill tone="danger" label={t('outsideRestingRange')} />}
          {uneven && <Pill tone="warning" label={t('unevenBeats')} />}
        </div>
      </div>
    </div>
  );
}
