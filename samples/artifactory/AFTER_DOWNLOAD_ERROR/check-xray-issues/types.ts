export interface AfterDownloadErrorRequest {
    metadata: DownloadMetadata;
    userContext: UserContext;
    requestHeaders: { [key: string]: Header };
}

export interface AfterDownloadErrorResponse {
    message: string;
    executionStatus?: Status;
    size?: number;
    responseMessage?: string;
    statusCode?: number;
}

export interface DownloadMetadata {
    /** The repoPath object of the request */
    repoPath:
            | RepoPath
            | undefined;
    /** The original repo path in case a virtual repo is involved */
    originalRepoPath:
            | RepoPath
            | undefined;
    /** The file name from path */
    name: string;
    /** Is it a head request */
    headOnly: boolean;
    /** Is it a checksum request */
    checksum: boolean;
    /** Is it a recursive request */
    recursive: boolean;
    /** When a modification has occurred */
    modificationTime: number;
    /** Is it a directory request */
    directoryRequest: boolean;
    /** Is it a metadata request */
    metadata: boolean;
    /** Last modification time that occurred */
    lastModified: number;
    /** If a modification happened since the last modification time */
    ifModifiedSince: number;
    /** The url that points to artifactory */
    servletContextUrl: string;
    /** The request URI */
    uri: string;
    /** The client address */
    clientAddress: string;
    /** The resource path of the requested zip */
    zipResourcePath: string;
    /** Is the request a zip resource request */
    zipResourceRequest: boolean;
    /** should replace the head request with get */
    replaceHeadRequestWithGet: boolean;
    /** Repository type */
    repoType: RepoType;
}

export interface RepoPath {
    /** The repo key */
    key: string;
    /** The path itself */
    path: string;
    /** The key:path combination */
    id: string;
    /** Is the path the root */
    isRoot: boolean;
    /** Is the path a folder */
    isFolder: boolean;
}

export interface Header {
    value: string[];
}

export interface UserContext {
    /** The username or subject */
    id: string;
    /** Is the context an accessToken */
    isToken: boolean;
    /** The realm of the user */
    realm: string;
}

export enum RepoType {
    REPO_TYPE_UNSPECIFIED = 0,
    REPO_TYPE_LOCAL = 1,
    REPO_TYPE_REMOTE = 2,
    REPO_TYPE_FEDERATED = 3,
    UNRECOGNIZED = -1,
}

export enum ActionStatus {
    UNSPECIFIED = 0,
    PROCEED = 1,
    STOP = 2,
    WARN = 3,
    UNRECOGNIZED = -1,
}
