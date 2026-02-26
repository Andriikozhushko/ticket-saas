import { redirect } from "next/navigation";

export default function MyTicketsRedirect(): never {
  redirect("/my-tickets");
}
