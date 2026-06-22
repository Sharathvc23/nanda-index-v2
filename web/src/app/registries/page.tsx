import { redirect } from "next/navigation";

// Browse has been merged into the Overview page (/). Keep this route as a
// permanent redirect so existing links and bookmarks continue to work.
export default function RegistriesPage() {
  redirect("/");
}
