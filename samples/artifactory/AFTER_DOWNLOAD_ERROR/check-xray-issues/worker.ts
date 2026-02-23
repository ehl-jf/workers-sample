import { PlatformContext } from 'jfrog-workers';
import { AfterDownloadErrorRequest, AfterDownloadErrorResponse } from './types';

const XRAY_SUMMARY_ENDPOINT = '/xray/api/v1/summary/artifact';

/** Secret key for the webhook URL (e.g. WEBHOOK_URL). */
const WEBHOOK_URL_SECRET = 'WEBHOOK_URL';
/** Optional secret for webhook auth header (e.g. Bearer token). */
const WEBHOOK_AUTH_SECRET = 'WEBHOOK_AUTH';

/** Returns true if the Xray artifact summary reports at least one issue (vulnerability). */
function scanHasIssues(summaryData: unknown): boolean {
    if (!summaryData || typeof summaryData !== 'object') return false;
    const data = summaryData as Record<string, unknown>;
    const artifacts = data.artifacts;
    if (!Array.isArray(artifacts) || artifacts.length === 0) return false;
    for (const art of artifacts) {
        if (!art || typeof art !== 'object') continue;
        const a = art as Record<string, unknown>;
        const issues = a.issues;
        if (Array.isArray(issues) && issues.length > 0) return true;
        const components = a.components;
        if (Array.isArray(components)) {
            for (const comp of components) {
                const c = comp as Record<string, unknown>;
                if (Array.isArray(c.issues) && (c.issues as unknown[]).length > 0) return true;
            }
        }
    }
    return false;
}

export default async (context: PlatformContext, data: AfterDownloadErrorRequest): Promise<AfterDownloadErrorResponse> => {
    const repoPath = data.metadata?.repoPath;
    const repo = repoPath?.key;
    const path = repoPath?.path;
    if (!repo || path == null) {
        return { message: 'proceed' };
    }
    const artifactPath = `${repo}/${path}`;

    let xrayRes: { status: number; data: unknown };
    try {
        xrayRes = await context.clients.platformHttp.post(
            XRAY_SUMMARY_ENDPOINT,
            { paths: [artifactPath] },
            { 'Content-Type': 'application/json' }
        );
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.warn(`Xray summary request failed for ${artifactPath}: ${err.message ?? error}`);
        return { message: 'proceed' };
    }

    if (xrayRes.status < 200 || xrayRes.status >= 300) {
        return { message: 'proceed' };
    }

    if (!scanHasIssues(xrayRes.data)) {
        return { message: 'proceed' };
    }

    let webhookUrl: string | undefined;
    try {
        webhookUrl = context.secrets.get(WEBHOOK_URL_SECRET);
    } catch {
        console.error(`Missing secret: ${WEBHOOK_URL_SECRET}. Add it with: jf worker add-secret download-error-webhook-worker ${WEBHOOK_URL_SECRET} <url>`);
        return { message: 'proceed' };
    }

    if (!webhookUrl?.startsWith('http://') && !webhookUrl?.startsWith('https://')) {
        console.error('WEBHOOK_URL must be a valid HTTP(S) URL.');
        return { message: 'proceed' };
    }

    const payload = {
        event: 'AFTER_DOWNLOAD_ERROR',
        repo,
        path,
        user: data.userContext?.id,
        timestamp: new Date().toISOString(),
        xray_summary: xrayRes.data,
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
        const auth = context.secrets.get(WEBHOOK_AUTH_SECRET);
        if (auth) headers['Authorization'] = `Bearer ${auth}`;
    } catch {
        // Optional secret
    }

    try {
        const res = await context.clients.axios.post(webhookUrl, payload, { headers, timeout: 10000 });
        if (res.status >= 200 && res.status < 300) {
            console.log('Webhook triggered: package scanned and has issues.');
        } else {
            console.warn(`Webhook returned status ${res.status}`);
        }
    } catch (error: unknown) {
        const err = error as { message?: string; response?: { status?: number } };
        console.error(`Webhook request failed: ${err.message ?? error}${err.response?.status != null ? ` (response ${err.response.status})` : ''}`);
    }

    return { message: 'proceed' };
};
