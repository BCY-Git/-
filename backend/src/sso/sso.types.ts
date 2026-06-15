export type LocalSsoRole = 'admin' | 'user'
// SSO 返回的用户信息
export interface SsoProfileAttributes {
  email?: string
  gender?: string
  identityCardNo?: string
  initials?: string
  loginName?: string
  nameSpelling?: string
  roleUuid?: string
  telephone?: string
  unitName?: string
  unitUuid?: string
  userName?: string
  userUuid?: string
}
// SSO 返回的用户信息响应
export interface SsoProfileResponse {
  service?: string
  attributes?: SsoProfileAttributes
  id?: string
  client_id?: string
}

// SSO 同步用户信息输入
export interface SsoUserSyncInput {
  provider: string
  loginName: string
  userUuid: string
  userName?: string
  email?: string
  telephone?: string
  unitUuid?: string
  unitName?: string
  role: LocalSsoRole
  roleUuid?: string
}
