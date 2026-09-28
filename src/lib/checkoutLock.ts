import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export const CHECKOUT_LOCK_DURATION_MS = 10 * 60 * 1000 // 10 minutes reservation
export const CHECKOUT_CHANNEL_NAME = 'netflix-checkout-presence'

export type CheckoutLock = {
  profileId: string
  profileName: string
  sessionId: string
  lockedAt: number
  expiresAt: number
  customerName?: string
}

/**
 * Returns a persistent session ID for the current browser tab.
 */
export function getCheckoutSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = sessionStorage.getItem('netriz_checkout_session_id')
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem('netriz_checkout_session_id', id)
  }
  return id
}

/**
 * Hook to manage real-time checkout locks across all users.
 * Uses Supabase Realtime Presence & Broadcast to prevent double checkout.
 */
export function useCheckoutLocks(activeProfile?: { id: string; name: string } | null, onOrderChange?: () => void) {
  const [locks, setLocks] = useState<Record<string, CheckoutLock>>({})
  const [now, setNow] = useState(Date.now())
  const mySessionId = useRef(getCheckoutSessionId()).current
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isSubscribedRef = useRef(false)

  // Keep internal now ticker for countdown & pruning expired locks
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Process presence state into Record<profileId, CheckoutLock>
  const parsePresenceState = useCallback((state: Record<string, unknown[]>) => {
    const currentMs = Date.now()
    const activeMap: Record<string, CheckoutLock> = {}

    for (const key of Object.keys(state)) {
      const presences = state[key] as Array<Partial<CheckoutLock>>
      if (!Array.isArray(presences)) continue

      for (const p of presences) {
        if (!p.profileId || !p.sessionId || !p.expiresAt) continue
        // Ignore expired locks
        if (p.expiresAt <= currentMs) continue

        const existing = activeMap[p.profileId]
        // If multiple presences for same profile, keep the earliest valid lock
        if (!existing || p.lockedAt! < existing.lockedAt) {
          activeMap[p.profileId] = {
            profileId: p.profileId,
            profileName: p.profileName || '',
            sessionId: p.sessionId,
            lockedAt: p.lockedAt || currentMs,
            expiresAt: p.expiresAt,
            customerName: p.customerName,
          }
        }
      }
    }

    setLocks(activeMap)
  }, [])

  // Setup Realtime Channel
  useEffect(() => {
    const channel = supabase.channel(CHECKOUT_CHANNEL_NAME, {
      config: {
        presence: {
          key: mySessionId,
        },
      },
    })
    channelRef.current = channel

    // 1. Presence Sync (when users join/leave/update)
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        parsePresenceState(state as Record<string, unknown[]>)
      })
      .on('presence', { event: 'join' }, () => {
        const state = channel.presenceState()
        parsePresenceState(state as Record<string, unknown[]>)
      })
      .on('presence', { event: 'leave' }, () => {
        const state = channel.presenceState()
        parsePresenceState(state as Record<string, unknown[]>)
      })

    // 2. Broadcast: Order Completed Notification
    channel.on('broadcast', { event: 'order_completed' }, (payload) => {
      if (onOrderChange) {
        onOrderChange()
      }
      // Also remove lock for the completed profile immediately
      if (payload?.payload?.profileId) {
        setLocks((prev) => {
          const next = { ...prev }
          delete next[payload.payload.profileId]
          return next
        })
      }
    })

    // 3. Broadcast: Lock Released Notification
    channel.on('broadcast', { event: 'lock_released' }, (payload) => {
      if (payload?.payload?.profileId) {
        setLocks((prev) => {
          const next = { ...prev }
          delete next[payload.payload.profileId]
          return next
        })
      }
    })

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribedRef.current = true
        // If we currently have an active profile to lock, track it now
        if (activeProfile?.id) {
          await channel.track({
            profileId: activeProfile.id,
            profileName: activeProfile.name,
            sessionId: mySessionId,
            lockedAt: Date.now(),
            expiresAt: Date.now() + CHECKOUT_LOCK_DURATION_MS,
          })
        }
      }
    })

    // Handle tab closing or navigation
    const handleBeforeUnload = () => {
      if (channelRef.current && isSubscribedRef.current) {
        channelRef.current.untrack()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      isSubscribedRef.current = false
      if (channelRef.current) {
        channelRef.current.untrack()
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [mySessionId, parsePresenceState, onOrderChange])

  // Track / untrack active profile if it changes dynamically
  useEffect(() => {
    if (!channelRef.current || !isSubscribedRef.current) return

    if (activeProfile?.id) {
      channelRef.current.track({
        profileId: activeProfile.id,
        profileName: activeProfile.name,
        sessionId: mySessionId,
        lockedAt: Date.now(),
        expiresAt: Date.now() + CHECKOUT_LOCK_DURATION_MS,
      })
    } else {
      channelRef.current.untrack()
    }
  }, [activeProfile?.id, activeProfile?.name, mySessionId])

  // Manually release lock (e.g. after order success or cancel)
  const releaseLock = useCallback(async (profileId?: string) => {
    if (channelRef.current) {
      await channelRef.current.untrack()
      if (profileId) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'lock_released',
          payload: { profileId },
        })
      }
    }
    if (profileId) {
      setLocks((prev) => {
        const next = { ...prev }
        delete next[profileId]
        return next
      })
    }
  }, [])

  // Broadcast to all clients that an order was completed
  const broadcastOrderCompleted = useCallback(async (profileId: string) => {
    if (channelRef.current) {
      await channelRef.current.untrack()
      await channelRef.current.send({
        type: 'broadcast',
        event: 'order_completed',
        payload: { profileId, completedAt: Date.now() },
      })
    }
    setLocks((prev) => {
      const next = { ...prev }
      delete next[profileId]
      return next
    })
  }, [])

  // Helper: check if a profile is locked by ANOTHER user
  const isLockedByOther = useCallback((profileId: string) => {
    const lock = locks[profileId]
    if (!lock) return false
    if (lock.expiresAt <= now) return false
    return lock.sessionId !== mySessionId
  }, [locks, now, mySessionId])

  // Helper: check if a profile is locked by ME (current tab/session)
  const isLockedByMe = useCallback((profileId: string) => {
    const lock = locks[profileId]
    if (!lock) return false
    if (lock.expiresAt <= now) return false
    return lock.sessionId === mySessionId
  }, [locks, now, mySessionId])

  // Helper: get lock details for a profile
  const getLock = useCallback((profileId: string) => {
    const lock = locks[profileId]
    if (!lock) return undefined
    if (lock.expiresAt <= now) return undefined
    return lock
  }, [locks, now])

  return {
    locks,
    mySessionId,
    now,
    isLockedByOther,
    isLockedByMe,
    getLock,
    releaseLock,
    broadcastOrderCompleted,
  }
}
