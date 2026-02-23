# Download Error Webhook Worker

This worker listens for **AFTER_DOWNLOAD_ERROR** events and triggers an external webhook for each download error. (The platform does not send HTTP status in the event payload, so filtering by 403 is not possible in the worker.)

## JFrog Worker CLI (`jf worker`)

| Command | Description |
|--------|-------------|
| `jf worker init <action> <worker-name>` | Initialize a worker (e.g. `AFTER_DOWNLOAD_ERROR`) |
| `jf worker list-event` | List available events |
| `jf worker test-run`, `dry-run`, `dr`, `tr` | Dry run a worker |
| `jf worker deploy`, `d` | Deploy a worker |
| `jf worker execute`, `exec`, `e` | Execute a GENERIC_EVENT worker |
| `jf worker undeploy`, `rm` | Undeploy a worker |
| `jf worker list`, `ls` | List workers (CSV: name, action, description, enabled) |
| `jf worker add-secret`, `as` | Add a secret to a worker |
| `jf worker list-event`, `le` | List available events |
| `jf worker edit-schedule`, `es` | Edit schedule for SCHEDULED_EVENT workers |
| `jf worker execution-history`, `exec-hist`, `eh` | Show execution history |

## Triggering a webhook (this worker)

On each **AFTER_DOWNLOAD_ERROR**, this worker sends an HTTP **POST** to your webhook URL with a JSON body:

```json
{
  "event": "AFTER_DOWNLOAD_ERROR",
  "repo": "<repo key>",
  "path": "<artifact path>",
  "user": "<user/token id>",
  "timestamp": "<ISO8601>"
}
```

### Setup

1. **Add the webhook URL as a secret** (required):

   ```bash
   jf worker add-secret download-error-webhook-worker WEBHOOK_URL "https://your-server.com/webhook"
   ```

2. **Optional – webhook auth** (e.g. Bearer token):

   ```bash
   jf worker add-secret download-error-webhook-worker WEBHOOK_AUTH "your-bearer-token"
   ```

3. **Configure repo filter** (optional): Edit `manifest.json` and set `filterCriteria.artifactFilterCriteria.repoKeys` to the repos you care about.

4. **Deploy the worker**:

   ```bash
   npm run deploy
   # or: jf worker deploy
   ```

5. **Enable the worker** in the JFrog Platform UI (Admin → Workers) or via API after deployment.

## JFrog official documentation – webhooks via API

- **Create a webhook subscription (REST API)**  
  [Create a new webhook subscription](https://jfrog.com/help/r/jfrog-rest-apis/create-a-new-webhook-subscription)  
  Use this to create and manage webhook subscriptions that send events to a URL.

- **Webhooks REST API support**  
  [Webhooks REST API support](https://jfrog.com/help/r/jfrog-platform-administration-documentation/webhooks-rest-api-support)  
  Overview of webhook configuration and API support.

- **Configuring and testing webhooks**  
  [Configuring webhooks](https://jfrog.com/help/r/artifactory-how-to-test-webhooks-in-artifactory-and-check-its-request-payload/configuring-webhooks)  
  How to configure and test webhooks in Artifactory.

To **trigger** a webhook from this worker we simply **POST** to your URL (stored in the `WEBHOOK_URL` secret). For **creating** or **managing** Artifactory webhook subscriptions programmatically, use the REST API described in the links above.

## Xray – last scan result for the failing package

Yes. You can get the result of the last scan for that artifact using the **Xray Artifact Summary** API (official JFrog REST API).

### Endpoint

- **Artifact Summary (last scan result)**  
  [Summary Artifact](https://jfrog.com/help/r/xray-rest-apis/summary-artifact)  
  `POST /xray/api/v1/summary/artifact`

### Request

Send either **paths** (repo + path) or **checksums** (SHA256). Using checksums is more reliable than paths.

```json
{
  "paths": ["<repo-key>/<path>"]
}
```

or

```json
{
  "checksums": ["<SHA256>"]
}
```

Example with the worker’s `repo` and `path`:  
`"paths": ["my-repo/foo/bar/package.tgz"]`

### Response

The response is the last scan summary for that artifact:

- **Issues** – vulnerabilities (e.g. severity, CVE, component)
- **Licenses** – license info for the artifact

So you get the “result of the last scan” of the failing package from this single call.

### How to use it

1. **From your webhook backend**  
   When you receive the webhook with `repo` and `path`, call your JFrog platform with the same credentials you use for Xray:

   ```bash
   curl -X POST -u user:password -H "Content-Type: application/json" \
     -d '{"paths":["<repo>/<path>"]}' \
     "https://<platform>/xray/api/v1/summary/artifact"
   ```

2. **From the worker**  
   You can call the same API inside the worker with `context.clients.platformHttp.post('/xray/api/v1/summary/artifact', { paths: [...] })`, then add the response (or a summary) to the webhook payload. The worker runs in the platform and can use the same auth.

### Caveats

- The artifact must be **indexed in Xray**. If it has never been scanned (e.g. never successfully downloaded/indexed), the API can return that the artifact doesn’t exist or isn’t indexed.
- **Paths**: some setups report that `paths` can fail with “Artifact doesn’t exist or not indexed/cached in Xray”; **checksums** (SHA256) are more reliable. To use checksums from the worker you’d need the artifact’s SHA256 (e.g. from Artifactory file info `GET /artifactory/api/storage/<repo>/<path>`), which may not exist if the download failed.
