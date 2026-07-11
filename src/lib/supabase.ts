import { createClient } from '@supabase/supabase-js'
import type {
  CreateTestimonialInput,
  SaveTestimonialGalleryItemInput,
  SaveTestimonialInput,
  Testimonial,
  TestimonialGalleryItem,
  Order,
  Profile,
  PublicProfileAvailability,
} from '@/types/database'

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

export function getTestimonials() {
  return supabase
    .from('testimonials')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: Testimonial[] | null; error: Error | null }>
}

export function getTestimonialGallery() {
  return supabase
    .from('testimonial_gallery')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at') as unknown as Promise<{ data: TestimonialGalleryItem[] | null; error: Error | null }>
}

export function createTestimonial(input: CreateTestimonialInput) {
  return supabase
    .from('testimonials')
    .insert({
      name: input.is_anonymous ? null : input.name,
      is_anonymous: input.is_anonymous,
      quote: input.quote,
      rating: input.rating,
      sort_order: 0,
      is_active: true,
    }) as unknown as Promise<{ error: Error | null }>
}

function deadlineMs(endDate: string, logoutTime?: string | null) {
  return new Date(`${endDate}T${(logoutTime ?? '23:59').slice(0, 5)}:00`).getTime()
}

export async function getPublicProfileAvailability(): Promise<{ data: PublicProfileAvailability[] | null; error: Error | null }> {
  const [profilesRes, ordersRes] = await Promise.all([
    supabase.from('profiles').select('id, name, is_rentable').eq('is_rentable', true).order('name'),
    supabase.from('orders').select('profile_id, end_date, logout_time').eq('status', 'booked'),
  ]) as [
    { data: Pick<Profile, 'id' | 'name' | 'is_rentable'>[] | null; error: Error | null },
    { data: Pick<Order, 'profile_id' | 'end_date' | 'logout_time'>[] | null; error: Error | null },
  ]

  if (profilesRes.error) return { data: null, error: profilesRes.error }
  if (ordersRes.error) return { data: null, error: ordersRes.error }

  const now = Date.now()
  const booked = new Map<string, Pick<Order, 'end_date' | 'logout_time'>>()
  for (const order of ordersRes.data ?? []) {
    if (deadlineMs(order.end_date, order.logout_time) <= now) continue
    const current = booked.get(order.profile_id)
    if (!current || deadlineMs(order.end_date, order.logout_time) < deadlineMs(current.end_date, current.logout_time)) {
      booked.set(order.profile_id, order)
    }
  }

  return {
    data: (profilesRes.data ?? []).map((profile): PublicProfileAvailability => {
      const currentOrder = booked.get(profile.id)
      return {
        id: profile.id,
        name: profile.name,
        status: currentOrder ? 'booked' : 'available',
        currentOrder: currentOrder && {
          end_date: currentOrder.end_date,
          logout_time: currentOrder.logout_time,
        },
      }
    }),
    error: null,
  }
}

export function getAdminTestimonials() {
  return supabase
    .from('testimonials')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: Testimonial[] | null; error: Error | null }>
}

export function saveTestimonial(input: SaveTestimonialInput, id?: string) {
  const payload = {
    name: input.is_anonymous ? null : input.name,
    is_anonymous: input.is_anonymous,
    quote: input.quote,
    rating: input.rating,
    is_active: input.is_active,
  }

  return (id
    ? supabase.from('testimonials').update(payload).eq('id', id)
    : supabase.from('testimonials').insert({ ...payload, sort_order: 0 })
  ) as unknown as Promise<{ error: Error | null }>
}

export function deleteTestimonial(id: string) {
  return supabase
    .from('testimonials')
    .delete()
    .eq('id', id) as unknown as Promise<{ error: Error | null }>
}

export function toggleTestimonialActive(id: string, isActive: boolean) {
  return supabase
    .from('testimonials')
    .update({ is_active: isActive })
    .eq('id', id) as unknown as Promise<{ error: Error | null }>
}

export function getAdminTestimonialGallery() {
  return supabase
    .from('testimonial_gallery')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false }) as unknown as Promise<{ data: TestimonialGalleryItem[] | null; error: Error | null }>
}

export function saveTestimonialGalleryItem(input: SaveTestimonialGalleryItemInput, id?: string) {
  const payload = {
    image_url: input.image_url,
    alt: input.alt,
    is_active: input.is_active,
  }

  return (id
    ? supabase.from('testimonial_gallery').update(payload).eq('id', id)
    : supabase.from('testimonial_gallery').insert({ ...payload, sort_order: 0 })
  ) as unknown as Promise<{ error: Error | null }>
}

export function deleteTestimonialGalleryItem(id: string) {
  return supabase
    .from('testimonial_gallery')
    .delete()
    .eq('id', id) as unknown as Promise<{ error: Error | null }>
}

export function toggleTestimonialGalleryActive(id: string, isActive: boolean) {
  return supabase
    .from('testimonial_gallery')
    .update({ is_active: isActive })
    .eq('id', id) as unknown as Promise<{ error: Error | null }>
}
