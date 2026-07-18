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

export function uploadBlob<T>(path: string, blob: Blob, onProgress?: (percentage: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', path)
    request.setRequestHeader('Content-Type', blob.type || 'application/octet-stream')
    request.responseType = 'json'
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        resolve(request.response as T)
        return
      }
      const body = request.response && typeof request.response === 'object'
        ? request.response as ApiErrorBody
        : { code: 'REQUEST_FAILED', message: 'Não foi possível enviar a foto.' }
      reject(new ApiClientError(request.status, body))
    })
    request.addEventListener('error', () => reject(new TypeError('Network request failed')))
    request.addEventListener('abort', () => reject(new DOMException('Upload cancelado.', 'AbortError')))
    request.send(blob)
  })
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value)
}

export function messageFromError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  if (error instanceof TypeError) return 'Não foi possível conectar. Verifique sua internet e tente novamente.'
  if (error instanceof DOMException && error.name === 'AbortError') return 'A operação demorou demais. Tente novamente.'
  if (error instanceof Error && error.message) return error.message
  return 'Ocorreu um erro inesperado. Tente novamente.'
}

export function fieldErrorsFromError(error: unknown): Record<string, string[]> {
  return error instanceof ApiClientError ? error.body.fieldErrors ?? {} : {}
}
