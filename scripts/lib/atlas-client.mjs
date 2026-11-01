// Minimal Atlas Cloud client: submit a generation, poll it to completion,
// upload local media and download results.
// API reference: https://www.atlascloud.ai/docs

import { createWriteStream, openAsBlob } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE_URL = 'https://api.atlascloud.ai/api/v1';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;
// Failure reported while an uploaded reference is still being processed.
const ASSET_NOT_READY = /still being prepared/i;

class AssetNotReadyError extends Error {}

// A failed fetch() carries no status; the reason (a reset connection, a DNS
// failure) is in its cause.
const describeNetworkError = (error) =>
  error.cause ? `${error.message} (${error.cause.code ?? error.cause.message})` : error.message;

// Network failures have no response, so only reads are retried: a POST may
// already have reached Atlas and started a paid generation.
async function fetchWithRetry(url, init, label) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      const method = init?.method ?? 'GET';
      if (method !== 'GET' || attempt >= MAX_ATTEMPTS) {
        throw new Error(`${label} failed: ${describeNetworkError(error)}`, { cause: error });
      }
      await sleep(2 ** attempt * 1000);
    }
  }
}

export class AtlasClient {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('ATLASCLOUD_API_KEY is not set. Copy .env.example to .env and add your key.');
    }
    this.apiKey = apiKey;
  }

  // Sends a request, retrying rate limits, transient server errors and (for
  // reads) network failures with exponential backoff.
  async request(method, endpoint, body) {
    const isForm = body instanceof FormData;
    for (let attempt = 1; ; attempt++) {
      const response = await fetchWithRetry(
        `${BASE_URL}${endpoint}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body && !isForm ? JSON.stringify(body) : body,
        },
        `Atlas Cloud ${method} ${endpoint}`,
      );

      if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS) {
        await sleep(2 ** attempt * 1000);
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Atlas Cloud ${method} ${endpoint} failed: HTTP ${response.status} ${text}`);
      }
      const payload = JSON.parse(text);
      if (!payload.data) {
        throw new Error(`Atlas Cloud ${method} ${endpoint} returned no data: ${text}`);
      }
      return payload.data;
    }
  }

  // Runs a generation (`generateImage` or `generateVideo`) and returns the
  // output URLs once it completes. A freshly uploaded reference can still be
  // processing when the prediction starts; Atlas then fails it and asks for a
  // retry, so those predictions are resubmitted with backoff.
  async generate(kind, input) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.runPrediction(kind, input);
      } catch (error) {
        if (!(error instanceof AssetNotReadyError) || attempt >= MAX_ATTEMPTS) throw error;
        await sleep(2 ** attempt * 1000);
      }
    }
  }

  async runPrediction(kind, input) {
    const { id } = await this.request('POST', `/model/${kind}`, input);
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const prediction = await this.request('GET', `/model/prediction/${id}`);
      if (prediction.status === 'completed' || prediction.status === 'succeeded') {
        if (!prediction.outputs?.length) {
          throw new Error(`Prediction ${id} completed without outputs`);
        }
        return prediction.outputs;
      }
      if (prediction.status === 'failed') {
        const message = `Prediction ${id} failed: ${prediction.error ?? 'unknown error'}`;
        throw ASSET_NOT_READY.test(prediction.error ?? '')
          ? new AssetNotReadyError(message)
          : new Error(message);
      }
      await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(`Prediction ${id} did not finish within ${POLL_TIMEOUT_MS / 60000} minutes`);
  }

  // Uploads a local file to Atlas Cloud storage and returns its URL.
  async upload(filePath) {
    const form = new FormData();
    form.append('file', await openAsBlob(filePath), path.basename(filePath));
    const { download_url: url } = await this.request('POST', '/model/uploadMedia', form);
    if (!url) {
      throw new Error(`Upload of ${filePath} returned no download_url`);
    }
    return url;
  }
}

export async function download(url, destination) {
  const response = await fetchWithRetry(url, undefined, `Download of ${url}`);
  if (!response.ok || !response.body) {
    throw new Error(`Download of ${url} failed: HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}
