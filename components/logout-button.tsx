"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const logout = async () => {
    // redirect: false로 설정하여 NextAuth의 기본 signout 페이지를 거치지 않도록 함
    await signOut({
      redirect: false
    });
    // 수동으로 로그인 페이지로 리다이렉트
    window.location.href = '/auth/signin';
  };

  return <Button onClick={logout}>Logout</Button>;
}
