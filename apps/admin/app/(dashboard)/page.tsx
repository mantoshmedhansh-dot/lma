import { redirect } from 'next/navigation';

export default function DashboardPage() {
  // Redirect to orders page as the default dashboard view
  redirect('/orders');
}
