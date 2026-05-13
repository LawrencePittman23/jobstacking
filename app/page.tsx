import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Dashboard from "./dashboard";
import SignIn from "./signin";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return <SignIn />;
  return <Dashboard userEmail={session.user.email} userName={session.user.name ?? ""} />;
}
