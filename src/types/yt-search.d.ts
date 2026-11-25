declare module 'yt-search' {
  interface SearchResult {
    videos: Array<{ videoId: string }>;
  }

  function search(query: string): Promise<SearchResult>;

  export = search;
}
