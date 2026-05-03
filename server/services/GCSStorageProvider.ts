import { Storage } from '@google-cloud/storage';
import { IStorageProvider, StorageMetadata } from './IStorageProvider.js';

export class GCSStorageProvider implements IStorageProvider {
  private storage: Storage;
  private bucketName: string;

  constructor(bucketName: string, credentialsPath?: string) {
    this.storage = new Storage({
      keyFilename: credentialsPath,
    });
    this.bucketName = bucketName;
  }

  private get bucket() {
    return this.storage.bucket(this.bucketName);
  }

  async upload(file: Buffer | string | NodeJS.ReadableStream, destination: string, mimeType?: string, signal?: AbortSignal): Promise<string> {
    // Remove leading slash if present
    const cleanPath = destination.startsWith('/') ? destination.slice(1) : destination;
    
    const gcsFile = this.bucket.file(cleanPath);
    
    if (file instanceof Buffer || typeof file === 'string') {
      await gcsFile.save(file, {
        contentType: mimeType,
        resumable: true, // Enabled for large files
      });
    } else {
      // Handle streaming upload
      await new Promise((resolve, reject) => {
        const writeStream = gcsFile.createWriteStream({
          contentType: mimeType,
          resumable: true,
        });

        const onAbort = () => {
          writeStream.destroy();
          reject(new Error('Upload cancelled'));
        };

        signal?.addEventListener('abort', onAbort);

        (file as NodeJS.ReadableStream).pipe(writeStream)
          .on('finish', () => {
            signal?.removeEventListener('abort', onAbort);
            resolve(true);
          })
          .on('error', (err: any) => {
            signal?.removeEventListener('abort', onAbort);
            reject(err);
          });
      });
    }
    
    if (signal?.aborted) throw new Error('Backup cancelled');
    
    return `gs://${this.bucketName}/${cleanPath}`;
  }

  async download(path: string, signal?: AbortSignal): Promise<Buffer> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    if (signal?.aborted) throw new Error('Operation cancelled');
    const [content] = await this.bucket.file(cleanPath).download();
    return content;
  }

  async downloadStream(path: string, signal?: AbortSignal): Promise<NodeJS.ReadableStream> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    if (signal?.aborted) throw new Error('Operation cancelled');
    
    const readStream = this.bucket.file(cleanPath).createReadStream();
    
    if (signal) {
      signal.addEventListener('abort', () => readStream.destroy());
    }
    
    return readStream;
  }

  async list(directory: string): Promise<StorageMetadata[]> {
    const cleanDir = directory.startsWith('/') ? directory.slice(1) : directory;
    const prefix = cleanDir === '' || cleanDir.endsWith('/') ? cleanDir : `${cleanDir}/`;
    
    const [files, , apiResponse]: [any, any, any] = await this.bucket.getFiles({ 
      prefix, 
      delimiter: '/' 
    });
    
    const metadata: StorageMetadata[] = [];

    // Add virtual folders (prefixes)
    if (apiResponse.prefixes) {
      apiResponse.prefixes.forEach((p: string) => {
        metadata.push({
          id: p,
          name: p.split('/').filter(Boolean).pop()!,
          mimeType: 'application/x-directory',
          isDir: true,
          fullPath: p,
        });
      });
    }

    // Add files
    files.forEach((f: any, index: number) => {
      if (index === 0) console.log('[GCS] Sample file metadata:', Object.keys(f.metadata));
      // Don't include the directory placeholder itself
      if (f.name === prefix) return;

      metadata.push({
        id: f.id || f.name,
        name: f.name.split('/').pop()!,
        mimeType: f.metadata.contentType || 'application/octet-stream',
        size: f.metadata.size?.toString(),
        modifiedTime: f.metadata.updated,
        createdTime: f.metadata.timeCreated,
        isDir: false,
        fullPath: f.name,
      });
    });

    return metadata;
  }

  async getQuota(): Promise<{ used: number; total: number }> {
    // GCS is pay-as-you-go, so there is no fixed limit.
    // Calculating usage requires iterating all files which is expensive.
    return { used: 0, total: -1 }; 
  }

  async delete(path: string): Promise<void> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    try {
      // 1. Delete the exact object (could be a file or a 0-byte folder marker)
      try {
        await this.bucket.file(cleanPath).delete();
      } catch (err: any) {
        // Ignore 404s (e.g., if it's purely a virtual folder with no marker object)
        if (err.code !== 404) throw err;
      }

      // 2. Delete all nested contents (recursive delete)
      const prefix = cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
      await this.bucket.deleteFiles({ prefix });
      
    } catch (err: any) {
      console.error(`[GCS] Failed to delete ${cleanPath}:`, err);
      throw err;
    }
  }

  async deleteBulk(paths: string[]): Promise<void> {
    await Promise.all(paths.map(p => this.delete(p)));
  }

  async createFolder(name: string, parentId?: string): Promise<string> {
    // GCS doesn't have real folders, just prefixes. 
    // We create a 0-byte object with a trailing slash to simulate a folder.
    let folderPath = parentId ? `${parentId}/${name}` : name;
    if (!folderPath.endsWith('/')) folderPath += '/';
    
    const cleanPath = folderPath.startsWith('/') ? folderPath.slice(1) : folderPath;
    await this.bucket.file(cleanPath).save('');
    return cleanPath;
  }

  async getDownloadUrl(path: string): Promise<string> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const [url] = await this.bucket.file(cleanPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    return url;
  }
}
