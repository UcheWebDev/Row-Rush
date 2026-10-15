import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const sb = url && key && url.startsWith('http') ? createClient(url, key) : null

let userId = null
export const getUserId = () => userId

export async function ensureAuth() {
  if (!sb) throw new Error('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.')
  const { data: { session } } = await sb.auth.getSession()
  if (session) return (userId = session.user.id)
  const r = await sb.auth.signInAnonymously()
  if (r.error) throw r.error
  return (userId = r.data.session.user.id)
}

// Saves the player's name to the profiles table (update first, insert if no row exists yet).
export async function saveUsername(name) {
  const id = await ensureAuth()
  const { data, error } = await sb.from('profiles').update({ username: name }).eq('id', id).select('id')
  if (error) throw error
  if (!data || !data.length) {
    const ins = await sb.from('profiles').insert({ id, username: name })
    if (ins.error) throw ins.error
  }
  return id
}

export async function loadUsername() {
  const id = await ensureAuth()
  const { data } = await sb.from('profiles').select('username').eq('id', id).maybeSingle()
  return data?.username || ''
}

export const getLocalName = () => { try { return localStorage.getItem('rr_name') || '' } catch { return '' } }
export const setLocalName = (v) => { try { localStorage.setItem('rr_name', v) } catch {} }
