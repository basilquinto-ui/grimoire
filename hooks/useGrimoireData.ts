'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Ritual = {
  id: string; user_id?: string; title: string; intent_type: string; date: string;
  moon_phase: string; planet_day: string; ingredients: string[]; tools: string[];
  duration: number; success_rating: number; outcome_flag: string;
  manifestation_date: string | null; outcome: string; energy_conditions: string;
  version: number; parent_id: string | null;
}
export type TarotLog = {
  id: string; user_id?: string; date: string; spread: string; moon_phase: string;
  question: string; cards: string[]; notes: string; ai_reading?: string;
}
export type Sigil = {
  id: string; user_id?: string; name: string; intent: string; symbol: string;
  color: string; activation_date: string; recharge_date: string | null;
  manifestation_date: string | null; status: string; notes: string;
}

export function useGrimoireData(userId: string, initial: { rituals: Ritual[]; tarotLogs: TarotLog[]; sigils: Sigil[] }) {
  const supabase = createClient()
  const [rituals, setRituals] = useState<Ritual[]>(initial.rituals)
  const [tarotLogs, setTarotLogs] = useState<TarotLog[]>(initial.tarotLogs)
  const [sigils, setSigils] = useState<Sigil[]>(initial.sigils)

  const addRitual = useCallback(async (ritual: Omit<Ritual, 'id'>) => {
    const { data, error } = await supabase.from('rituals').insert({ ...ritual, user_id: userId, ingredients: ritual.ingredients || [], tools: ritual.tools || [] }).select().single()
    if (data) setRituals(rs => [data, ...rs])
    return { data, error }
  }, [userId])

  const updateRitual = useCallback(async (id: string, updates: Partial<Ritual>) => {
    const { data, error } = await supabase.from('rituals').update(updates).eq('id', id).select().single()
    if (data) setRituals(rs => rs.map(r => r.id === id ? data : r))
    return { data, error }
  }, [])

  const deleteRitual = useCallback(async (id: string) => {
    const { error } = await supabase.from('rituals').delete().eq('id', id)
    if (!error) setRituals(rs => rs.filter(r => r.id !== id))
    return { error }
  }, [])

  const addTarotLog = useCallback(async (log: Omit<TarotLog, 'id'>) => {
    const { data, error } = await supabase.from('tarot_logs').insert({ ...log, user_id: userId, cards: log.cards || [] }).select().single()
    if (data) setTarotLogs(ls => [data, ...ls])
    return { data, error }
  }, [userId])

  const updateTarotLog = useCallback(async (id: string, updates: Partial<TarotLog>) => {
    const { data, error } = await supabase.from('tarot_logs').update(updates).eq('id', id).select().single()
    if (data) setTarotLogs(ls => ls.map(l => l.id === id ? data : l))
    return { data, error }
  }, [])

  const addSigil = useCallback(async (sigil: Omit<Sigil, 'id'>) => {
    const { data, error } = await supabase.from('sigils').insert({ ...sigil, user_id: userId }).select().single()
    if (data) setSigils(ss => [data, ...ss])
    return { data, error }
  }, [userId])

  const updateSigil = useCallback(async (id: string, updates: Partial<Sigil>) => {
    const { data, error } = await supabase.from('sigils').update(updates).eq('id', id).select().single()
    if (data) setSigils(ss => ss.map(s => s.id === id ? data : s))
    return { data, error }
  }, [])

  const deleteSigil = useCallback(async (id: string) => {
    const { error } = await supabase.from('sigils').delete().eq('id', id)
    if (!error) setSigils(ss => ss.filter(s => s.id !== id))
    return { error }
  }, [])

  const callAI = useCallback(async (messages: any[], system: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, system }),
    })
    if (!res.ok) throw new Error('AI call failed')
    const d = await res.json()
    return d.content as string
  }, [])

  return { rituals, tarotLogs, sigils, addRitual, updateRitual, deleteRitual, addTarotLog, updateTarotLog, addSigil, updateSigil, deleteSigil, callAI }
}
