import Link from "next/link";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Auth Button Component
 *
 * TODO: Supabase에서 NextAuth로 전환 완료
 */
export async function AuthButton() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/signin">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/signup">Sign up</Link>
      </Button>
    </div>
  );
}
