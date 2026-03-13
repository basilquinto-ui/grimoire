import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, system } = await req.json()
  if (!messages || !Array.isArray(messages)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: system || 'You are a helpful assistant.',
      messages,
    })
    return NextResponse.json({
      content: response.content[0].type === 'text' ? response.content[0].text : '',
    })
  } catch (error: any) {
    console.error('Anthropic error:', error)
    return NextResponse.json({ error: 'AI error', detail: error.message }, { status: 500 })
  }
}
