
export interface ILoginResponse {
    accessToken: string,
    refreshToken: string
}

export interface IAuthFormInput {
    email: string,
    password: string
}

export interface IAccessTokenPayload {
    userId: string,
    role: string
}

export interface IRefreshTokenPayload {
    userId: string,
    tokenversion: number
}
