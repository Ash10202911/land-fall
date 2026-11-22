import { redirect } from "next/navigation";

/**
 * The Dashboard tab was removed in v2. Its parts now live where they are used: needs-attention and the
 * job scorecard on My requests, the quote scorecard and lane demand on My quotes, and marketplace health
 * on the admin page. Old links and emails land on the jobs page.
 */
export default function DashboardPage() {
  redirect("/jobs");
}
