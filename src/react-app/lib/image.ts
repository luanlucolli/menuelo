const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const TARGET_BYTES = 600 * 1024

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível converter a imagem.')), 'image/webp', quality))
}

export async function prepareImage(file: File): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Use uma imagem JPEG, PNG ou WebP. HEIC ainda não é suportado.')
  const bitmap = await createImageBitmap(file)
  let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  let result: Blob | null = null

  for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Seu navegador não conseguiu processar a imagem.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
      result = await canvasBlob(canvas, quality)
      if (result.size <= TARGET_BYTES) {
        bitmap.close()
        return result
      }
    }
    scale *= 0.82
  }

  bitmap.close()
  if (!result || result.size > 800 * 1024) throw new Error('A imagem continua muito grande. Escolha um arquivo menor.')
  return result
}
