import sharp from "sharp"
import path from "path"

/**
 * Uses Sharp for resizing and WebP encoding
 */
class ImageProcessingHelper {
  constructor() {
    this.resizeTarget = { width: 1920, height: 1080 }
  }

  /**
   * Determines if an image should be resized
   * @param {import("sharp").Metadata} metadata
   * @returns {boolean}
   */
  shouldResize(metadata) {
    return (
      metadata.width > this.resizeTarget.width ||
      metadata.height > this.resizeTarget.height
    )
  }

  /**
   * Resize an image buffer if needed
   * @param {Buffer} buffer
   * @returns {Promise<Buffer>} resized buffer
   */
  async resizeImageIfNeeded(buffer) {
    const image = sharp(buffer)
    const metadata = await image.metadata()
    if (this.shouldResize(metadata)) {
      return image
        .resize({
          width: this.resizeTarget.width,
          height: this.resizeTarget.height,
          fit: "inside", // equivalent to ResizeMode.Max
        })
        .toBuffer()
    }
    return buffer
  }

  /**
   * Checks if a file extension is a supported image type
   * @param {string} ext
   * @returns {boolean}
   */
  isImage(ext) {
    return [".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase())
  }

  /**
   * Determines if image has alpha channel
   * @param {import("sharp").Metadata} metadata
   * @returns {boolean}
   */
  hasAlpha(metadata) {
    return metadata.hasAlpha === true
  }

  /**
   * Encodes a buffer to WebP format using near-lossless compression
   * @param {Buffer} buffer
   * @returns {Promise<Buffer>}
   */
  async encodeWebP(buffer) {
    const image = sharp(buffer)
    const metadata = await image.metadata()
    const hasAlpha = this.hasAlpha(metadata)

    return image
      .webp({
        quality: 75,
        nearLossless: true,
        lossless: hasAlpha,
      })
      .toBuffer()
  }

  /**
   * Sanitizes a filename for safe S3 storage
   * @param {string} originalName
   * @returns {string}
   */
  sanitizeFileName(originalName) {
    let name = path.parse(originalName).name.toLowerCase()
    name = name
      .replace(/[^a-z0-9._-]+/g, "-") // remove unsafe characters
      .replace(/-+/g, "-") // trim multiple dashes
      .replace(/^-|-$/g, "") // trim start/end dashes
    return name
  }

  /**
   * Main helper to process an image buffer to .webp and resize if needed
   * @param {Buffer} buffer
   * @returns {Promise<Buffer>} processed image buffer
   */
  async processImage(buffer) {
    let resized = await this.resizeImageIfNeeded(buffer)
    return await this.encodeWebP(resized)
  }
}

export const imageProcessingHelper = new ImageProcessingHelper()