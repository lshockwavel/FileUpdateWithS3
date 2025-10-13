import { S3Client, DeleteObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import path from "path"
import { randomUUID } from "crypto"
import fs from "fs"
import { imageProcessingHelper } from "./ImageProcessingHelper.js"


class FileUploaderService {
  constructor(config = process.env) {
    this.bucket = config.BUCKET_NAME
    this.region = config.REGION
    this.accessKeyId = config.AWS_IAM_ACCESS_KEY
    this.secretAccessKey = config.AWS_SECRET_KEY
    this.basePath = `https://${this.bucket}.s3.${this.region}.amazonaws.com`

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      }
    })
  }

  /**
   * Upload a file to S3, optionally converting images to .webp
   * @param {import("express-fileupload").UploadedFile} file
   * @param {string} folder
   * @returns {Promise<string>} Public URL
   */
  async uploadAsync(file, folder = "") {
    const originalExt = path.extname(file.name).toLowerCase()
    const isImage = imageProcessingHelper.isImage(originalExt)
    const filename = imageProcessingHelper.sanitizeFileName(file.name)
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "")
    const finalExt = isImage ? ".webp" : originalExt
    //REVIEW: This was original (with 2 \\ in the replace) but didn't like so updated below? `${folder.replace(/\\/$/, "")}/${filename}-${timestamp}${finalExt}`
    const key = `${folder.replace(/\/$/, "")}/${filename}-${timestamp}${finalExt}`


    let buffer = file.data

    if (imageProcessingHelper.isImage(originalExt)) {
      let buffer = file.data
      buffer = await imageProcessingHelper.resizeImageIfNeeded(buffer)
      buffer = await imageProcessingHelper.encodeWebP(buffer)
    }

    const uploadCommand = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: isImage ? "image/webp" : file.mimetype
    })

    await this.s3Client.send(uploadCommand)
    return `${this.basePath}/${key}`
  }

  /**
   * List uploaded files in a given folder
   * @param {string} folder
   * @returns {Promise<string[]>}
   */
  async getUploads(folder = "") {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: folder
    })

    const response = await this.s3Client.send(command)
    const contents = response.Contents || []
    return contents.map((obj) => `${this.basePath}/${obj.Key}`)
  }

  /**
   * Delete file from S3
   * @param {string} filepath
   * @returns {Promise<object>}
   */
  async deleteFile(filepath) {
    const key = filepath.replace(`${this.basePath}/`, "")

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    })

    const result = await this.s3Client.send(command)
    return { message: `Deleted ${key}`, response: result }
  }
}

export const fileUploaderService = new FileUploaderService()