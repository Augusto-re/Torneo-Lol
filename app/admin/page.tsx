import AdminLogin from "@/components/AdminLogin";
import AdminPanel from "@/components/AdminPanel";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="container narrow">
        <h1>Admin</h1>
        <div className="card">
          <AdminLogin />
        </div>
      </main>
    );
  }
  return (
    <main className="container">
      <AdminPanel />
    </main>
  );
}
