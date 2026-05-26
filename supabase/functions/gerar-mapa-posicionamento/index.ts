import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM = `Voce e a Polia. Devolva o mapa de posicionamento da marca: declaracao de posicionamento, diferencial, o que os concorrentes nao alcancam e o angulo unico. Portugues do Brasil, sem emojis, sem traco longo. Use o que a usuaria escreveu como materia-prima.`

const TOOL = {
  type: 'function',
  function: {
    name: 'gerar_mapa_posicionamento',
    description: 'Retorna o mapa de posicionamento estruturado.',
    parameters: {
      type: 'object',
      properties: {
        declaracao: { type: 'string', description: 'Declaracao de posicionamento em uma frase clara.' },
        diferencial: { type: 'string', description: 'O diferencial real da marca em uma frase.' },
        naoAlcancam: { type: 'string', description: 'O que os concorrentes citados nao alcancam, em uma frase.' },
        anguloUnico: { type: 'string', description: 'O angulo unico da marca, em uma frase memoravel.' },
      },
      required: ['declaracao', 'diferencial', 'naoAlcancam', 'anguloUnico'],
      additionalProperties: false,
    },
  },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json()
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY nao configurada')

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Respostas da usuaria (JSON):\n${JSON.stringify(body)}` },
        ],
        tools: [TOOL],
        tool_choice: { type: 'function', function: { name: TOOL.function.name } },
      }),
    })

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: 'Limite de uso atingido. Tente novamente em instantes.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: 'Creditos esgotados no workspace Lovable.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!aiRes.ok) { const t = await aiRes.text(); throw new Error(`AI gateway error: ${aiRes.status} ${t}`) }

    const ai = await aiRes.json()
    const toolCall = ai.choices?.[0]?.message?.tool_calls?.[0]
    if (!toolCall) throw new Error('IA nao retornou saida estruturada')
    const resultado = JSON.parse(toolCall.function.arguments)
    return new Response(JSON.stringify(resultado), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
