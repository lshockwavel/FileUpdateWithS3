import BaseController from "../utils/BaseController.js"
import fileUpload from "express-fileupload"
import { fileUploaderService } from "../services/fileUploaderService.js"

export class UploadController extends BaseController {
  constructor() {
    super('api/upload')
    this.router
      .get('', this.getUploads)
      .use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 }, useTempFiles: true }))
      .post('', this.uploadFiles)
      .delete('', this.deleteFile)
  }

  async getUploads(request, response, next) {
    try {
      const folder = request.query.folder || 'uploads'
      const uploadedImages = await fileUploaderService.getUploads(folder)
      response.send(uploadedImages)
    } catch (error) {
      next(error)
    }
  }

  async uploadFiles(request, response, next) {
    try {
      if (!request.files || !request.files.files) {
        throw new Error('No files were sent to upload')
      }

      // Normalize array of files
      const files = Array.isArray(request.files.files)
        ? request.files.files
        : [request.files.files]

      const { entityType, entityId } = request.body
      const folder =
        entityType && entityId
        //REVIEW: This was original (with 2 \\ in the replace) but didn't like so updated below? `${entityType.trim().replace(/\\/$/, '')}/${entityId}`
          ? `${entityType.trim().replace(/\/$/, '')}/${entityId}`
          : 'uploads'

      const uploadTasks = files.map(async (file) => {
        const result = {
          filename: file.name,
          contentType: file.mimetype,
          size: file.size,
        }

        try {
          const url = await fileUploaderService.uploadAsync(file, folder)
          result.success = true
          result.url = url
        } catch (ex) {
          result.success = false
          result.error = ex.message
        }

        return result
      })

      const results = await Promise.all(uploadTasks)
      response.send(results)
    } catch (error) {
      next(error)
    }
  }

  async deleteFile(request, response, next) {
    try {
      const filename = request.query.filename
      if (!filename) throw new Error('Missing filename to delete')

      const result = await fileUploaderService.deleteFile(filename)
      response.send({ message: `Deleted ${filename}`, result })
    } catch (error) {
      next(error)
    }
  }
}