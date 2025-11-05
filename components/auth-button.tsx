import Link from "next/link";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';

/**
 * Auth Button Component
 *
 * NextAuth 기반 인증 버튼 (NCP 마이그레이션 완료)
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
