const getUrls = () => {
  if (process.env.NODE_ENV === 'production') {
    return [window.location.origin];
  }

  const baseUrl = 'http://' + (process.env.VUE_APP_API_IP || '101.35.53.113');
  const port = process.env.VUE_APP_API_PORT || 8888;
  const urls = [`${baseUrl}:${port}`];
  return urls;
};

export default {
  urls: getUrls(),
  res: location.href.split('#')[0] + '#',
};
