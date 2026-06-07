const getUrls = () => {
  if (process.env.NODE_ENV === 'production') {
    return [window.location.origin];
  }

  // Use current host for API when accessed via LAN/IP, fallback to localhost for direct dev
  const currentHost = window.location.hostname;
  const baseUrl = 'http://' + (process.env.VUE_APP_API_IP || currentHost);
  const port = process.env.VUE_APP_API_PORT || '5002';
  const urls = [`${baseUrl}:${port}`];
  return urls;
};

export default {
  urls: getUrls(),
  res: location.href.split('#')[0] + '#',
};
