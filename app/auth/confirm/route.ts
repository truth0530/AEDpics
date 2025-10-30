// Email verification route - currently disabled
// This route was previously used for Supabase email OTP verification
// Migration to NextAuth email verification is pending
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

// Define EmailOtpType locally since Supabase is removed
type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';

export async function GET(request: NextRequest) {
  // This route is temporarily disabled during migration from Supabase to NextAuth
  // Email verification should be handled through NextAuth's built-in email provider

  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Log the attempt for debugging
  console.warn('Email confirmation attempted but route is disabled:', { token_hash: !!token_hash, type });

  // Redirect to signin page with message
  redirect('/auth/signin?message=Email verification is being migrated. Please contact support if you need assistance.');
}
