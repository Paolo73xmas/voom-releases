import type { FreeAppointment } from './followups';
import type { GeoPoint, TourCandidate } from './types';
import { timeToMin } from './types';

/** Nessuna anagrafica fittizia: una tappa libera resta senza customer_id/tabaccheria_id. */
export function freeAppointmentCandidate(appointment: FreeAppointment, place: GeoPoint): TourCandidate {
  const minute = timeToMin(appointment.time);
  return {
    key: `free:appointment:${appointment.id}`, entityType: 'free', customerId: null, tabaccheriaId: null,
    name: appointment.title, address: appointment.address || place.label, city: appointment.city, province: '', lat: place.lat, lng: place.lng,
    lastVisitDate: null, lastOrderDate: null, orderCount: 0, totalRevenue: 0, revenue6m: 0, avgOrderValue: 0, avgReorderDays: null,
    daysSinceOrder: null, daysSinceVisit: null, followUpDate: null, appointmentAt: appointment.appointmentAt, isFollowUp: true,
    notes: appointment.notes, orphanStatus: null, estimatedRevenue: null, score: 100, priorityClass: 'Urgente',
    reason: `Impegno libero in agenda alle ${appointment.time}. ${appointment.notes || ''}`,
    nextSuggestedVisit: null, visitMinutes: appointment.duration, potentialValue: 0,
    preferredSlots: [{ id: `agenda_${appointment.id}`, label: `appuntamento ore ${appointment.time}`, start: minute, end: minute, strict: true }],
  };
}