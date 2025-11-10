"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const logout = async () => {
    try {
      // signOut 완료를 기다림
      await signOut({
        redirect: false
      });
    } catch (error) {
      console.error('로그아웃 처리 중 오류:', error);
      // 실패해도 로그인 페이지로 이동하여 사용자를 갇히게 하지 않음
    }

    // 성공/실패 여부와 관계없이 로그인 페이지로 이동
    window.location.href = '/auth/signin';
  };

  return <Button onClick={logout}>Logout</Button>;
}
