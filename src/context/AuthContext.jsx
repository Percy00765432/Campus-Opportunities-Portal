import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Supabase auth user + profile merged
  const [loading, setLoading] = useState(true) // true while checking existing session
  const [error, setError] = useState(null)

  // Fetch profile row and merge with auth user
  async function loadProfile(authUser) {
    if (!authUser) { setUser(null); return }
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()
    setUser(profile ? { ...authUser, ...profile } : authUser)
  }

  // Restore session on mount + listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadProfile(session?.user ?? null).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      return false
    }
    return true
  }, [])

  // signUp creates the auth user; the DB trigger auto-inserts into profiles
  const signUp = useCallback(async ({ email, password, name, role, department, year, title }) => {
    setError(null)
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, department, year: year ?? null, title: title ?? null },
      },
    })
    if (authError) {
      setError(authError.message)
      return false
    }
    return true
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthContext.Provider value={{ user, login, signUp, logout, loading, error, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
