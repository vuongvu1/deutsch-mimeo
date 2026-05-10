import type { UserId, UserRow } from '@/types/db'

const USERS: readonly UserRow[] = [
  { id: 'mi', display_name: 'Mi', emoji: '🐷' },
  { id: 'meo', display_name: 'Meo', emoji: '🐱' },
]

const USERS_BY_ID: Record<UserId, UserRow> = {
  mi: USERS[0],
  meo: USERS[1],
}

export function useUsers() {
  return { data: USERS as UserRow[], isLoading: false, error: null }
}

export function useUser(userId: UserId | undefined) {
  return {
    data: userId ? USERS_BY_ID[userId] : undefined,
    isLoading: false,
    error: null,
  }
}
