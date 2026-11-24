const maxBytes = 5 * 1024 * 1024

export function imageDataUrl(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes.length > maxBytes) throw new Error('Choose an image of 5 MiB or less.')
  let mime: string
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) mime = 'image/png'
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg'
  else throw new Error('Choose a JPEG or PNG image.')
  let base64: string
  if (typeof btoa === 'function') {
    const chunks: string[] = []
    for (let start = 0; start < bytes.length; start += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(start, start + 8192)))
    }
    base64 = btoa(chunks.join(''))
  } else {
    base64 = uni.arrayBufferToBase64(buffer)
  }
  return `data:${mime};base64,${base64}`
}

export function choosePostImages(count: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count, sizeType: ['original'], sourceType: ['album', 'camera'],
      success: async result => {
        try {
          const paths = Array.isArray(result.tempFilePaths) ? result.tempFilePaths : [result.tempFilePaths]
          const files = Array.isArray(result.tempFiles) ? result.tempFiles : [result.tempFiles]
          if (paths.length > count) throw new Error('Attach up to nine images per post.')
          const images: string[] = []
          for (const [index, path] of paths.entries()) {
            const file = files[index]
            if (file && file.size > maxBytes) throw new Error('Choose an image of 5 MiB or less.')
            // #ifdef H5
            const blob = file as unknown as Blob
            images.push(imageDataUrl(await blob.arrayBuffer()))
            // #endif
            // #ifdef MP-WEIXIN
            const buffer = await new Promise<ArrayBuffer>((done, fail) => {
              uni.getFileSystemManager().readFile({
                filePath: path, success: data => done(data.data as ArrayBuffer), fail,
              })
            })
            images.push(imageDataUrl(buffer))
            // #endif
          }
          resolve(images)
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Could not read the selected image.'))
        }
      },
      fail: error => /cancel/i.test(error.errMsg) ? resolve([]) : reject(new Error('Could not open the image picker.')),
    })
  })
}
