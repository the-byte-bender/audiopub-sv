export interface ClientsideUser {
  id: string;
  name: string;
  displayName: string;
  isBanned: boolean;
  isVerified: boolean;
}

export interface ClientsideAudio {
  id: string;
  title: string;
  description: string;
  extension: string;
  path: string;
  transcodedPath: string;
  url: string;
  plays: number;
  playsString: string;
  createdAt: number;
  user?: ClientsideUser;
}

export interface ClientsideComment {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  user: ClientsideUser;
  audio?: ClientsideAudio;
}
