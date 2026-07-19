import type { Context } from 'hono'
import { z, type ZodType } from 'zod'
import type { ApiErrorBody } from '../../shared/schemas'

export class ApiError extends Error {
  readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 500 | 502 | 503
  readonly code: string
  readonly fieldErrors?: Record<string, string[]>

  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 500 | 502 | 503,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export function errorJson(c: Context, error: ApiError): Response {
  const body: ApiErrorBody = { code: error.code, message: error.message }
  if (error.fieldErrors) body.fieldErrors = error.fieldErrors
  return c.json(body, error.status)
}

export async function parseJson<T>(request: Request, schema: ZodType<T>, maxBytes = 1_000_000): Promise<T> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envie o corpo como application/json.')
  }
  const text = new TextDecoder().decode(await readBytesLimited(request, maxBytes, 'O arquivo ou payload é grande demais.'))

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'O JSON enviado é inválido.')
  }

  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Revise os campos informados.', result.error.flatten().fieldErrors as Record<string, string[]>)
  }
  return result.data
}

export async function readBytesLimited(request: Request, maxBytes: number, message: string): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', message)
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', message)
    }
    chunks.push(value)
  }
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

export function requireId(value: string): string {
  const result = z.string().trim().min(1).max(100).safeParse(value)
  if (!result.success) throw new ApiError(400, 'INVALID_ID', 'Identificador inválido.')
  return result.data
}
