import type { ApiErrorBody } from '../../../shared/schemas'

export class ApiClientError extends Error {
  readonly status: number
  readonly body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.body = body
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof Blob) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    let body: ApiErrorBody = { code: 'REQUEST_FAILED', message: 'Não foi possível concluir a solicitação.' }
    try { body = await response.json() as ApiErrorBody } catch { /* resposta sem JSON */ }
    throw new ApiClientError(response.status, body)
  }
  return response.json() as Promise<T>
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value)
}

export function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
}
