import type { DashboardPreview } from './dashboard-types';

const today = new Date();
function at(dayOffset: number, hour: number, minute = 0) {
  const value = new Date(today);
  value.setDate(value.getDate() + dayOffset);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

export const dashboardPreview: DashboardPreview = {
  clinic: { id: 'preview-clinic', name: 'Bright Smile Dental', slug: 'bright-smile-dental', role: 'CLINIC_OWNER' },
  overview: {
    metrics: { todayScheduled: 12, completed: 3, inProgress: 2, newPatientsThisMonth: 28 },
    todayAppointments: [
      { id: 'preview-1', startsAt: at(0, 9), endsAt: at(0, 9, 30), status: 'CONFIRMED', patientDisplayName: 'Emily Johnson', serviceName: 'Dental Cleaning' },
      { id: 'preview-2', startsAt: at(0, 10), endsAt: at(0, 11), status: 'IN_PROGRESS', patientDisplayName: 'Michael Chen', serviceName: 'Tooth Extraction' },
      { id: 'preview-3', startsAt: at(0, 11, 30), endsAt: at(0, 12), status: 'CONFIRMED', patientDisplayName: 'Sophia Martinez', serviceName: 'Dental Filling' },
      { id: 'preview-4', startsAt: at(0, 13), endsAt: at(0, 13, 30), status: 'CONFIRMED', patientDisplayName: 'James Wilson', serviceName: 'Consultation' },
      { id: 'preview-5', startsAt: at(0, 14, 30), endsAt: at(0, 15, 30), status: 'CONFIRMED', patientDisplayName: 'Olivia Davis', serviceName: 'Teeth Whitening' }
    ],
    recentBookings: [
      { id: 'preview-6', startsAt: at(1, 9, 30), endsAt: at(1, 10), status: 'CONFIRMED', patientDisplayName: 'Liam Anderson', serviceName: 'Consultation' },
      { id: 'preview-7', startsAt: at(1, 11), endsAt: at(1, 11, 30), status: 'CONFIRMED', patientDisplayName: 'Ava Thompson', serviceName: 'Dental Cleaning' },
      { id: 'preview-8', startsAt: at(2, 14), endsAt: at(2, 15), status: 'CONFIRMED', patientDisplayName: 'Noah Williams', serviceName: 'Dental Filling' },
      { id: 'preview-9', startsAt: at(3, 10, 30), endsAt: at(3, 11), status: 'CONFIRMED', patientDisplayName: 'Isabella Garcia', serviceName: 'Consultation' }
    ],
    treatmentMix: [
      { name: 'Preventive', appointmentCount: 18, percentage: 45 },
      { name: 'Restorative', appointmentCount: 10, percentage: 25 },
      { name: 'Cosmetic', appointmentCount: 6, percentage: 15 },
      { name: 'Oral Surgery', appointmentCount: 4, percentage: 10 },
      { name: 'Other', appointmentCount: 2, percentage: 5 }
    ],
    location: { id: 'preview-location', name: 'Main Clinic', city: 'San Francisco', region: 'CA', timezone: 'America/Los_Angeles' },
    subscription: { plan: 'PRO', status: 'ACTIVE' }
  }
};
