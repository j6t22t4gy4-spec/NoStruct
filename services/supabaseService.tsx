'use client'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pdutvjchnfuoenotkeot.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_WjmRWWGDurJfKQ6A2H-wDQ_vK-9_Ses'

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL 또는 Publishable Key가 설정되지 않았습니다.')
}

// 서버 측에서 실수로 import 방지
if (typeof window === 'undefined') {
  throw new Error('supabaseService.ts는 클라이언트 측에서만 사용해야 합니다.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signOut() {
  await supabase.auth.signOut()
}