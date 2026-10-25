// Hash routes, so the browser's back button and reloads keep the doctor on the same page.
//   #/home  #/patients  #/patients/:id?tab=visits  #/patients/:id/visits/:encounterId
//   #/meeting/:appointmentId  #/messages  #/messages/:patientId  #/audit  #/settings?section=availability
import { useEffect, useState } from 'react';
import type { PortalLink } from '../services/doctorApi';

export type Route =
  | { page: 'home' }
  | { page: 'patients' }
  | { page: 'patient'; patientId: string; tab?: string }
  | { page: 'visit'; patientId: string; encounterId: string }
  | { page: 'meeting'; appointmentId: string }
  | { page: 'messages'; patientId?: string }
  | { page: 'audit' }
  | { page: 'settings'; section?: string };

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  const seg = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (seg[0] === 'patients' && seg[1] && seg[2] === 'visits' && seg[3]) {
    return { page: 'visit', patientId: seg[1], encounterId: seg[3] };
  }
  if (seg[0] === 'patients' && seg[1]) return { page: 'patient', patientId: seg[1], tab: params.get('tab') || undefined };
  if (seg[0] === 'patients') return { page: 'patients' };
  if (seg[0] === 'meeting' && seg[1]) return { page: 'meeting', appointmentId: seg[1] };
  if (seg[0] === 'messages') return { page: 'messages', patientId: seg[1] };
  if (seg[0] === 'audit') return { page: 'audit' };
  if (seg[0] === 'settings') return { page: 'settings', section: params.get('section') || undefined };
  return { page: 'home' };
}

export function hrefFor(route: Route): string {
  const e = encodeURIComponent;
  switch (route.page) {
    case 'patients': return '#/patients';
    case 'patient': return `#/patients/${e(route.patientId)}${route.tab ? `?tab=${e(route.tab)}` : ''}`;
    case 'visit': return `#/patients/${e(route.patientId)}/visits/${e(route.encounterId)}`;
    case 'meeting': return `#/meeting/${e(route.appointmentId)}`;
    case 'messages': return `#/messages${route.patientId ? `/${e(route.patientId)}` : ''}`;
    case 'audit': return '#/audit';
    case 'settings': return `#/settings${route.section ? `?section=${e(route.section)}` : ''}`;
    default: return '#/home';
  }
}

export function navigate(route: Route) {
  const href = hrefFor(route);
  if (window.location.hash !== href) window.location.hash = href;
  window.scrollTo({ top: 0 });
}

/** The route a notification / audit row link opens (null when it has nowhere to go). */
export function routeForLink(link: PortalLink | null | undefined): Route | null {
  if (!link?.page) return null;
  if (link.page === 'visit' && link.patient_id && link.encounter_id) {
    return { page: 'visit', patientId: link.patient_id, encounterId: link.encounter_id };
  }
  if (link.page === 'patient' && link.patient_id) return { page: 'patient', patientId: link.patient_id, tab: link.tab };
  if (link.page === 'meeting' && link.appointment_id) return { page: 'meeting', appointmentId: link.appointment_id };
  if (link.page === 'messages') return { page: 'messages', patientId: link.patient_id };
  if (link.page === 'audit') return { page: 'audit' };
  if (link.page === 'home') return { page: 'home' };
  return null;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
