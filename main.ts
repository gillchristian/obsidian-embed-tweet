import {Plugin} from 'obsidian';

type Cache = Record<string, Result>;

export default class TweetEmbedPlugin extends Plugin {
  loadCache(): Promise<Cache> {
    return this.loadData()
      .then((data) => data ?? {})
      .catch(() => ({}));
  }

  async onload() {
    this.registerTweetProcessor();

    this.addCommand({
      id: 'reset-tweet-cache',
      name: 'Reset cache',
      callback: () => {
        this.saveData({});
      },
    });
  }

  registerTweetProcessor() {
    this.registerMarkdownCodeBlockProcessor('tweet', async (source, el, _ctx) => {
      const cache = await this.loadCache();

      const rows = source
        .split('\n')
        .map((r) => r.trim())
        .filter((row) => row.length > 0);

      const updatedCache = await rows.reduce(
        (acc, tweet) => acc.then((cache) => insertTweetOnCacheIfMissing(cache, tweet)),
        Promise.resolve(cache),
      );

      this.saveData(updatedCache);

      rows.forEach((tweetUrl) => {
        const tweet = updatedCache[tweetUrl];

        if (!tweet) {
          return;
        }

        const div = el.createEl('div');

        if (tweet.success) {
          div.innerHTML = tweet.html;
        } else {
          console.error(`Failed to fetch tweet: ${tweet.url}, Reason: ${tweet.error}`);
          if (tweet.data) {
            console.error(tweet.data);
          }

          div.innerHTML = `<pre>Failed to fetch tweet: ${tweet.url}</pre>`;
        }
      });
    });
  }
}

const insertTweetOnCacheIfMissing = (cache: Cache, tweet: string): Promise<Cache> =>
  cache[tweet] && cache[tweet].success
    ? Promise.resolve(cache)
    : fetchTweet(tweet).then((result) => ({...cache, [tweet]: result}));

type FailedResult = {error: string; url: string; data?: unknown; success: false};
type SuccessResult = {html: string; success: true};

type Result = SuccessResult | FailedResult;

const fetchTweet = async (tweet: string): Promise<Result> => {
  try {
    const url = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweet)}&hide_thread=false`;

    const res = await fetch('https://cors-henna-seven.vercel.app/api/cors', {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url}),
      method: 'POST',
    });

    if (!res.ok) {
      return {error: 'Failed to fetch', url: tweet, success: false};
    }

    const data = await res.json();

    return typeof data.html === 'string'
      ? {html: data.html, success: true}
      : {error: 'Invalid response', url: tweet, data, success: false};
  } catch (e) {
    return {error: 'Failed to fetch', url: tweet, success: false};
  }
};
