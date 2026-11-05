// GitHub dispatch acceptance is separate from successful data refresh/deployment.
const workflowURL = 'https://api.github.com/repos/169956576-cloud/kuaika-daily/actions/workflows/publish.yml/dispatches';

export async function dispatchUpdate(env, {request = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
  if (!env.GITHUB_DISPATCH_TOKEN) throw new Error('Missing GITHUB_DISPATCH_TOKEN secret');
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await request(workflowURL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'kuaika-cloud-scheduler',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ref: 'main'}),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      if (attempt === 3) throw new Error('GitHub dispatch network request failed after 3 attempts');
      await sleep(attempt * 5000);
      continue;
    }
    if (response.status === 204) return {accepted: true, attempts: attempt};
    const status = response.status;
    await response.body?.cancel();
    if (attempt === 3 || !(status === 429 || status >= 500)) {
      // Do not log response bodies or the authorization header.
      throw new Error(`GitHub rejected dispatch (HTTP ${status})`);
    }
    await sleep(attempt * 5000);
  }
}

export default {
  async scheduled(event, env) {
    const scheduledAt = new Date(event.scheduledTime).toISOString();
    try {
      const result = await dispatchUpdate(env);
      console.log(JSON.stringify({scheduledAt, ...result}));
    } catch (error) {
      console.error(JSON.stringify({scheduledAt, accepted: false, error: error.message}));
      throw error;
    }
  },
  // Public requests cannot trigger the authenticated GitHub operation.
  fetch() {
    return new Response('Not found', {status: 404});
  },
};
