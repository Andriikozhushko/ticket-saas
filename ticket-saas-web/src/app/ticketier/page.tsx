import { redirect } from "next/navigation";
import { getTicketierSessionFromCookie } from "@/lib/auth";
import TicketierPanel from "./ticketier-panel";

export default async function TicketierPage() {
  const session = await getTicketierSessionFromCookie();
  if (!session) redirect("/ticketier/login");
  return <TicketierPanel />;
}
