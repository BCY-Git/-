export interface CurrentUserEntity {
  id: number
  username: string
  role: string
  displayName: string | null
  email: string | null
  ssoProvider?: string | null
  ssoUserUuid?: string | null
  ssoLoginName?: string | null
  ssoUnitUuid?: string | null
  ssoUnitName?: string | null
  ssoTelephone?: string | null
  isActive: boolean
  createdAt: Date
  tokenVersion: number
}

export interface JwtPayload {
  sub: number
  username: string
  tokenVersion: number
}
