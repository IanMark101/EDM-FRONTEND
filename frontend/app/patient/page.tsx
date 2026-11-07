import { Login } from '../login/sign-in';

export const metadata = { title: 'Patient sign-in', robots: { index: false, follow: false } };
export default function PatientSignInPage() { return <Login patient />; }
