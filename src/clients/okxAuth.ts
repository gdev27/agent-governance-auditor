import { createHmac } from 'node:crypto';
import { AuditorConfig } from '../config.js';

interface OkxEnvelope<T> {
  code: string;
  msg: string;
  data: T;
}

export function buildOkxHeaders(
  config: AuditorConfig,
  method: 'GET' | 'POST',
  requestPathWithQuery: string,
  body = ''
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${method}${requestPathWithQuery}${body}`;
  const signature = createHmac('sha256', config.okxSecretKey).update(prehash).digest('base64');

  return {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': config.okxApiKey,
    'OK-ACCESS-PASSPHRASE': config.okxPassphrase,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-SIGN': signature
  };
}

export async function parseOkxResponse<T>(response: Response, apiName: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${apiName} failed: ${response.status} ${response.statusText}`);
  }

  const envelope = (await response.json()) as Partial<OkxEnvelope<T>>;
  if (envelope.code !== '0') {
    throw new Error(`${apiName} failed: ${envelope.code ?? 'unknown'} ${envelope.msg ?? ''}`.trim());
  }
  if (envelope.data === undefined) {
    throw new Error(`${apiName} failed: empty data`);
  }

  return envelope.data;
}

