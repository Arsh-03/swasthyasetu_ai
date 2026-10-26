import React from 'react';
import { t, type SupportedLanguage } from '../utils/translations';
import { Icon, type IconName } from './ui';

interface DoctorSidebarProps {
  activeTab: 'patient-queue' | 'patient-chart' | 'active-consultation' | 'clinical-records' | 'audit-trail';
  setActiveTab: (tab: 'patient-queue' | 'patient-chart' | 'active-consultation' | 'clinical-records' | 'audit-trail') => void;
  selectedLanguage: SupportedLanguage;
}

interface NavItem {
  id: 'patient-queue' | 'clinical-records' | 'audit-trail';
  labelKey: string;
  icon: IconName;
  isActive: (current: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'patient-queue',
    labelKey: 'patientQueue',
    icon: 'inbox',
    // The chart view keeps "Patient Queue" highlighted
    isActive: (curr) => curr === 'patient-queue' || curr === 'patient-chart',
  },
  {
    id: 'clinical-records',
    labelKey: 'clinicalRecords',
    icon: 'records',
    isActive: (curr) => curr === 'clinical-records',
  },
  {
    id: 'audit-trail',
    labelKey: 'auditTrail',
    icon: 'shieldCheck',
    isActive: (curr) => curr === 'audit-trail',
  },
];

export const DoctorSidebar: React.FC<DoctorSidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedLanguage,
}) => {
  return (
    <aside
      aria-label="Clinician Navigation"
      className="w-16 xl:w-[232px] shrink-0 bg-card border-r border-card-border flex flex-col justify-between py-3 px-2 xl:px-3 select-none transition-all duration-200 overflow-y-auto"
    >
      <nav className="flex flex-col gap-1.5 w-full">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(activeTab);
          const label = t(selectedLanguage, item.labelKey);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={active ? 'page' : undefined}
              title={label}
              className={`w-full flex items-center justify-center xl:justify-start gap-3 px-2.5 xl:px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                active
                  ? 'bg-ice text-primary font-semibold border-l-[3px] border-l-primary shadow-2xs'
                  : 'text-ink-muted hover:text-ink hover:bg-base border-l-[3px] border-l-transparent font-medium'
              }`}
            >
              <Icon
                name={item.icon}
                size={19}
                tone={active ? 'primary' : 'muted'}
                weight={active ? 'duotone' : 'regular'}
                className="shrink-0"
              />
              <span className="hidden xl:inline truncate tracking-tight">
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
