import {
  createCapacitorFileSystemGateway,
  type FileSystemGateway,
} from './fileSystemGateway';


let currentGateway: FileSystemGateway | null = null;

export function getFileSystemGateway(): FileSystemGateway {
  if (!currentGateway) {
    currentGateway = createCapacitorFileSystemGateway();
  }
  return currentGateway;
}

export function setFileSystemGateway(gateway: FileSystemGateway | null): void {
  currentGateway = gateway;
}
