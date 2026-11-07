import { PatientRecords } from './records';

export const metadata = { title: 'My care records', robots: { index: false, follow: false } };
export default function PatientRecordsPage() { return <PatientRecords />; }
