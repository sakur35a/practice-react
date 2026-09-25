import ky from 'ky'

export const api = ky.create({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
})
