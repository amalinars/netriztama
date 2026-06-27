import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { db: { schema: 'netflix' } },
)

export function completeOrder(orderId: string) {
  return (supabase as never as { rpc: (name: string, args: Record<string, string>) => Promise<{ error: Error | null }> }).rpc('complete_order_and_rotate_pin', { p_order_id: orderId })
}

let _completed = false
export async function autoCompleteOrders() {
  if (_completed) return
  _completed = true
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const time = now.toTimeString().slice(0, 5)
  const { data } = await supabase.from('orders').select('id').eq('status', 'booked').or(`end_date.lt.${today},and(end_date.eq.${today},logout_time.lte.${time})`)

  await Promise.all(((data ?? []) as { id: string }[]).map(o => completeOrder(o.id)))
}
