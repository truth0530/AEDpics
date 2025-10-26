// TODO: Temporarily disabled - Supabase server
// import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // const next = searchParams.get("next") ?? "/auth/complete-profile";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    
    if (!error) {
      // 이메일 인증 성공
      // 사용자 프로필 확인
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // 프로필 존재 여부 확인
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (!profile) {
          // 프로필이 없으면 프로필 완성 페이지로
          redirect('/auth/complete-profile');
        } else if (profile.role === 'pending_approval') {
          // 승인 대기 중이면 대기 페이지로
          redirect('/auth/pending-approval');
        } else {
          // 정상적으로 인증된 사용자는 대시보드로
          redirect('/dashboard');
        }
      } else {
        redirect('/auth/signin');
      }
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${error?.message}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=No token hash or type`);
}
