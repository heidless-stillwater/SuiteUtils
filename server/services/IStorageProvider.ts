export interface StorageMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  isDir: boolean;
  fullPath?: string;
}

export interface IStorageProvider {
  upload(file: Buffer | string, destination: string, mimeType?: string, signal?: AbortSignal): Promise<string>;
  download(path: string, signal?: AbortSignal): Promise<Buffer>;
  list(directory: string): Promise<StorageMetadata[]>;
  getQuota(): Promise<{ used: number; total: number }>;
  delete(path: string): Promise<void>;
  deleteBulk(paths: string[]): Promise<void>;
  createFolder(name: string, parentId?: string): Promise<string>;
  getDownloadUrl(path: string): Promise<string>;
}
