'use client'

import { useState, useEffect } from 'react'
// TODO: Supabase 클라이언트 임시 비활성화 - NextAuth useSession으로 변경 필요
// import { useSupabase } // TODO: Supabase 클라이언트 임시 비활성화
// from '@/lib/supabase/client'
// import type { User } from '@supabase/supabase-js'

// TODO: NextAuth useSession 사용으로 변경 필요
export function useUser() {
  // TODO: NextAuth의 useSession으로 교체
  // import { useSession } from 'next-auth/react'
  // const { data: session, status } = useSession()
  // return { user: session?.user, loading: status === 'loading' }

  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Temporary - always return null until NextAuth migration
    setUser(null)
    setLoading(false)
  }, [])

  return { user, loading }

  /* TODO: 아래 코드는 Supabase 의존성 제거 후 재활성화
  const supabase = useSupabase()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return { user, loading }
  */
}