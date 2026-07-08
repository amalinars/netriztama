export type Account = {
  id: string
  name: string
  password: string | null
  subscription_cost: number
  created_at: string
}

export type Profile = {
  id: string
  account_id: string
  name: string
  pin: string | null
  old_pin: string | null
  pin_change_pending: boolean
  pin_changed_at: string | null
  is_rentable: boolean
  created_at: string
}

export type ProfileWithAccount = Profile & {
  accounts: Pick<Account, 'id' | 'name'> & { password?: string | null }
}

export type Order = {
  id: string
  profile_id: string
  customer_name: string
  package: PackageType
  price: number
  start_date: string
  end_date: string
  logout_time: string
  status: 'booked' | 'done'
  notes: string | null
  created_at: string
}

export type OrderWithProfile = Order & {
  profiles: ProfileWithAccount
}

export type PackageType = '1_hari' | '2_hari' | '3_hari' | '1_minggu' | '1_bulan'

export type CronLog = {
  runid: number
  status: string
  return_message: string
  start_time: string
  end_time: string
}

export type Testimonial = {
  id: string
  name: string | null
  is_anonymous: boolean
  quote: string
  rating: number
  sort_order: number
  is_active: boolean
  created_at: string
}

export type TestimonialGalleryItem = {
  id: string
  image_url: string
  alt: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export type CreateTestimonialInput = {
  name: string | null
  is_anonymous: boolean
  quote: string
  rating: number
}

export type SaveTestimonialInput = {
  name: string | null
  is_anonymous: boolean
  quote: string
  rating: number
  is_active: boolean
}

export type SaveTestimonialGalleryItemInput = {
  image_url: string
  alt: string
  is_active: boolean
}

