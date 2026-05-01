import { drive_v3, google } from 'googleapis';
import { IStorageProvider, StorageMetadata } from './IStorageProvider.js';
import { Readable } from 'stream';

export class GoogleDriveStorageProvider implements IStorageProvider {
  private drive: drive_v3.Drive;

  constructor(credentialsPath?: string) {
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Helper to find a file/folder by name within a parent
   */
  private async findInParent(name: string, parentId: string = 'root'): Promise<string | null> {
    let q = `name = '${name}' and '${parentId}' in parents and trashed = false`;
    
    let res = await this.drive.files.list({
      q,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    // If not found in root, and we are looking at the root level, 
    // search broadly (for shared folders or items shared with the service account)
    if ((!res.data.files || res.data.files.length === 0) && parentId === 'root') {
      q = `name = '${name}' and trashed = false`;
      res = await this.drive.files.list({
        q,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
    }

    return res.data.files?.[0]?.id || null;
  }

  /**
   * Helper to resolve a path like "My Drive/AppSuite/backups" to a folder ID.
   * If folders don't exist, it can optionally create them or throw.
   */
  private async resolvePathToId(path: string, createIfMissing: boolean = false): Promise<string> {
    const parts = path.split('/').filter(p => p.length > 0);
    let currentId = 'root';

    for (const part of parts) {
      // Skip the root aliases if they are at the start of the path
      if ((part === 'root' || part === 'My Drive') && currentId === 'root') continue;
      
      let id = await this.findInParent(part, currentId);
      
      if (!id) {
        if (createIfMissing) {
          id = await this.createFolder(part, currentId);
        } else {
          throw new Error(`Path not found: ${path} (missing ${part})`);
        }
      }
      currentId = id!;
    }
    return currentId;
  }

  async upload(file: Buffer | string, destination: string, mimeType?: string): Promise<string> {
    const parts = destination.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');
    
    const parentId = await this.resolvePathToId(dirPath, true);

    const media = {
      mimeType,
      body: Buffer.isBuffer(file) ? Readable.from(file) : Readable.from(Buffer.from(file)),
    };

    const res = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentId],
      },
      media,
      fields: 'id',
      supportsAllDrives: true,
    });

    return res.data.id!;
  }

  async download(path: string): Promise<Buffer> {
    const id = await this.resolvePathToId(path);
    const res = await this.drive.files.get(
      { fileId: id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  async list(directory: string): Promise<StorageMetadata[]> {
    const parentId = await this.resolvePathToId(directory);
    const res = await this.drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, modifiedTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    return (res.data.files || []).map(f => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      size: f.size || undefined,
      modifiedTime: f.modifiedTime || undefined,
      isDir: f.mimeType === 'application/vnd.google-apps.folder',
    }));
  }

  async getQuota(): Promise<{ used: number; total: number }> {
    const res = await this.drive.about.get({ fields: 'storageQuota' });
    const quota = res.data.storageQuota;
    return {
      used: parseInt(quota?.usage || '0'),
      total: parseInt(quota?.limit || '0'),
    };
  }

  async delete(path: string): Promise<void> {
    const id = await this.resolvePathToId(path);
    await this.drive.files.delete({ fileId: id, supportsAllDrives: true });
  }

  async deleteBulk(paths: string[]): Promise<void> {
    await Promise.all(paths.map(p => this.delete(p)));
  }

  async createFolder(name: string, parentId: string = 'root'): Promise<string> {
    const res = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    return res.data.id!;
  }

  async getDownloadUrl(path: string): Promise<string> {
    const id = await this.resolvePathToId(path);
    const res = await this.drive.files.get({
      fileId: id,
      fields: 'webContentLink',
      supportsAllDrives: true,
    });
    
    const url = res.data.webContentLink;
    if (!url) {
      // Fallback for folders or files without a webContentLink
      return `https://drive.google.com/open?id=${id}`;
    }
    return url;
  }
}
