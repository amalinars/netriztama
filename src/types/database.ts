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
  is_rentable: boolean
  created_at: string
}

export type ProfileWithAccount = Profile & {
  accounts: Pick<Account, 'id' | 'name'>
}

export type Order = {
  id: string
  profile_id: string
  customer_name: string
  package: PackageType
  price: number
  start_date: string
  end_date: string
  status: 'booked' | 'done'
  notes: string | null
  created_at: string
}

export type OrderWithProfile = Order & {
  profiles: ProfileWithAccount
}

export type PackageType = '1_hari' | '2_hari' | '3_hari' | '1_minggu' | '1_bulan'
