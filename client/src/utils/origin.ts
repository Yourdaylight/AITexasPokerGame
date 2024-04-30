const getUrls = () => {
  if (process.env.NODE_ENV === 'production') {
    return [window.location.origin];
  }

  const baseUrl = 'http://' + (process.env.VUE_APP_API_IP || '192.168.1.6');
  const port = process.env.VUE_APP_API_PORT || 5002;
  const urls = [`${baseUrl}:${port}`];
  return urls;
};

export default {
  urls: getUrls(),
  res: location.href.split('#')[0] + '#',
};
