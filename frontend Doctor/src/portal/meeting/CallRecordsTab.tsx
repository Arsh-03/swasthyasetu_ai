// Patient records tab inside the consultation call side panel.
// Displays ABDM / DPDP health records (lab results, imaging, past visits) directly on the call.
// Refreshes in real-time when the patient grants consent via WebSocket.
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { api, type PatientSummary, type RecordSummary } from '../../services/api';
import { usePortal } from '../PortalContext';
import { Button, Card, Empty, ErrorNote, Facts, Loading, Pill } from '../ui';

interface Props {
  patient: PatientSummary;
  onRequestConsent: () => void;
  onAddToNote?: (text: string) => void;
}

export function CallRecordsTab({ patient, onRequestConsent, onAddToNote }: Props) {
  const { t, version, addToNote, toast } = usePortal();
  const [records, setRecords] = useState<RecordSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manualReload, setManualReload] = useState(0);
  const [loading, setLoading] = useState(true);

  const pid = patient.patient_id;

  useEffect(() => {
    let alive = true;
    setError(false);
    api
      .getPatientRecords(pid)
      .then((data) => {
        if (alive) {
          setRecords(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [pid, version, manualReload]);

  const categories = useMemo(() => {
    if (!records) return [];
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.category) set.add(r.category);
      else if (r.imaging) set.add('imaging');
      else set.add('general');
    });
    return Array.from(set);
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => {
      const cat = r.category || (r.imaging ? 'imaging' : 'general');
      const matchesCat = filterCategory === 'all' || cat === filterCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        (r.facility && r.facility.toLowerCase().includes(q)) ||
        (r.summary_findings && r.summary_findings.toLowerCase().includes(q)) ||
        (r.lab_results && r.lab_results.some((l) => l.test.toLowerCase().includes(q)));
      return matchesCat && matchesQuery;
    });
  }, [records, filterCategory, searchQuery]);

  const handleCopyFindings = (record: RecordSummary) => {
    let text = `[Record: ${record.title} (${record.date_str || 'Date unspecified'})]\n`;
    if (record.summary_findings) {
      text += `Findings: ${record.summary_findings}\n`;
    }
    if (record.lab_results && record.lab_results.length > 0) {
      text += `Lab Results: ` + record.lab_results.map((l) => `${l.test}: ${l.value} ${l.unit} (${l.flag})`).join(', ') + '\n';
    }
    if (record.imaging) {
      text += `Imaging (${record.imaging.modality} - ${record.imaging.organ}): ${record.imaging.findingsSummary}\n`;
    }

    if (onAddToNote) {
      onAddToNote(text);
    } else {
      addToNote({
        id: `rec-${record.record_id}`,
        section: 'investigations',
        heading: 'Health Records / Investigations',
        text,
      });
    }

    setCopiedId(record.record_id);
    toast(t('findingAdded'), 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (error && !records) {
    return (
      <div className="p-4">
        <ErrorNote message={t('loadError')} onRetry={() => setManualReload((n) => n + 1)} retryLabel={t('retry')} />
      </div>
    );
  }

  if (loading && !records) {
    return (
      <div className="p-6">
        <Loading label={t('loading')} />
      </div>
    );
  }

  const allRecords = records || [];
  const totalCount = allRecords.length;
  const lockedCount = allRecords.filter((r) => r.consent_status !== 'approved').length;
  const unlockedCount = totalCount - lockedCount;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Top Header Summary & Request Action */}
      <div className="flex flex-col gap-2 p-3 rounded-control bg-base border border-hairline">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <Icon name="records" size={16} tone="primary" /> {t('recordsOnCall')}
            </h4>
            <p className="text-2xs text-ink-muted">
              {t('recordsSummary', { total: totalCount, locked: lockedCount })}
              {unlockedCount > 0 && <span className="text-success-deep font-semibold"> · {unlockedCount} unlocked</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setManualReload((n) => n + 1)}
            title={t('refreshRecords')}
            className="w-7 h-7 rounded-tight flex items-center justify-center text-ink-muted hover:bg-ink-tint hover:text-ink transition-colors cursor-pointer"
          >
            <Icon name="sync" size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-hairline/60">
          <Button size="sm" variant="primary" icon="lock" onClick={onRequestConsent} className="flex-1 text-xs">
            {t('requestRecords')}
          </Button>
        </div>
      </div>

      {/* Search & Category filter */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Icon name="search" size={14} tone="muted" className="absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchRecords')}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-control bg-base border border-hairline text-ink focus:outline-none focus:border-primary"
          />
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-2xs">
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={cx(
                'px-2.5 py-1 rounded-full font-semibold transition-colors shrink-0 cursor-pointer',
                filterCategory === 'all' ? 'bg-primary text-on-primary' : 'bg-base text-ink-muted hover:text-ink',
              )}
            >
              All ({totalCount})
            </button>
            {categories.map((c) => {
              const count = allRecords.filter((r) => (r.category || (r.imaging ? 'imaging' : 'general')) === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilterCategory(c)}
                  className={cx(
                    'px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider transition-colors shrink-0 cursor-pointer',
                    filterCategory === c ? 'bg-primary text-on-primary' : 'bg-base text-ink-muted hover:text-ink',
                  )}
                >
                  {c} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Record list */}
      {filteredRecords.length === 0 ? (
        <Card className="p-4 text-center">
          <Empty icon="records" title={searchQuery ? t('noPatientsMatch') : t('noRecordsOnCall')} />
          {lockedCount > 0 && (
            <div className="mt-3">
              <Button size="sm" icon="lock" onClick={onRequestConsent}>
                {t('requestRecords')}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredRecords.map((r) => {
            const unlocked = r.consent_status === 'approved';
            const expanded = openRecordId === r.record_id;
            const isCopied = copiedId === r.record_id;

            return (
              <div
                key={r.record_id}
                className={cx(
                  'rounded-control border transition-all overflow-hidden',
                  expanded ? 'border-primary/50 shadow-sm bg-card' : 'border-hairline bg-card hover:bg-base/50',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenRecordId(expanded ? null : r.record_id)}
                  aria-expanded={expanded}
                  className="w-full text-left p-3 flex items-start gap-2.5 cursor-pointer"
                >
                  <span
                    className={cx(
                      'w-8 h-8 rounded-control flex items-center justify-center shrink-0 mt-0.5',
                      unlocked ? 'bg-success-tint text-success-deep' : 'bg-ink-tint text-ink-muted',
                    )}
                  >
                    <Icon name={r.category === 'lab' ? 'vitals' : r.imaging ? 'imaging' : 'records'} size={16} weight="duotone" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-ink truncate">{r.title}</p>
                      <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} tone="muted" className="shrink-0" />
                    </div>
                    <p className="text-3xs text-ink-muted truncate mt-0.5">
                      {[r.date_str, r.facility, r.type_label].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {unlocked ? (
                        <Pill tone="success" icon="unlock" label={t('accessGranted')} />
                      ) : r.consent_status === 'expired' ? (
                        <Pill tone="warning" label={t('accessExpired')} />
                      ) : (
                        <Pill tone="neutral" icon="lock" label={t('consentNeeded')} />
                      )}
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="p-3 pt-1 border-t border-hairline/60 bg-base/40 text-xs flex flex-col gap-2.5">
                    {unlocked ? (
                      <>
                        {r.summary_findings && (
                          <div className="p-2 rounded-tight bg-card border border-hairline text-ink leading-relaxed">
                            <span className="text-3xs font-semibold text-ink-muted uppercase block mb-0.5">Clinical Findings</span>
                            {r.summary_findings}
                          </div>
                        )}

                        {r.imaging && (
                          <div className="p-2 rounded-tight bg-card border border-hairline">
                            <Facts
                              columns={2}
                              items={[
                                { label: t('modality'), value: r.imaging.modality },
                                { label: t('organ'), value: r.imaging.organ },
                                { label: t('findings'), value: r.imaging.findingsSummary },
                                { label: t('measurement'), value: r.imaging.caliperMeasurement },
                              ]}
                            />
                          </div>
                        )}

                        {r.lab_results && r.lab_results.length > 0 && (
                          <div className="rounded-tight overflow-hidden border border-hairline bg-card">
                            <table className="w-full text-2xs">
                              <thead>
                                <tr className="text-left text-ink-muted bg-base/80 border-b border-hairline">
                                  <th className="py-1 px-2 font-semibold">{t('test')}</th>
                                  <th className="py-1 px-2 font-semibold">{t('result')}</th>
                                  <th className="py-1 px-2 font-semibold">{t('range')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.lab_results.map((l) => (
                                  <tr key={l.test} className="border-t border-hairline/60">
                                    <td className="py-1 px-2 font-medium">{l.test}</td>
                                    <td className={cx('py-1 px-2 font-bold', l.flag !== 'normal' && 'text-danger-deep')}>
                                      {l.value} {l.unit}
                                      {l.flag !== 'normal' && ` (${l.flag === 'elevated' ? '↑' : '↓'})`}
                                    </td>
                                    <td className="py-1 px-2 text-ink-muted">{l.range}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleCopyFindings(r)}
                            className={cx(
                              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control text-2xs font-semibold transition-colors cursor-pointer',
                              isCopied
                                ? 'bg-success-tint text-success-deep'
                                : 'bg-primary-tint text-primary hover:bg-primary hover:text-white',
                            )}
                          >
                            <Icon name={isCopied ? 'check' : 'add'} size={12} />
                            {isCopied ? t('findingAdded') : t('addFindingToNote')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-3 rounded-control bg-card border border-hairline text-center flex flex-col items-center gap-2">
                        <Icon name="lock" size={20} tone="muted" />
                        <p className="text-2xs text-ink-muted leading-relaxed">{t('recordLockedHint')}</p>
                        <Button size="sm" variant="primary" icon="key" onClick={onRequestConsent} className="text-2xs">
                          {t('requestRecords')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
