import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { db: { schema: 'netflix' } },
)

let _completed = false
export async function autoCompleteOrders() {
  if (_completed) return
  _completed = true
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('orders').update({ status: 'done' }).eq('status', 'booked').lt('end_date', today)
}
