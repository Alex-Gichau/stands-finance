import http from 'http';
import https from 'https';

const getRedirectUrl = (url: string) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      resolve(res.headers.location);
    }).on('error', reject);
  });
};

(async () => {
  console.log(await getRedirectUrl('https://wjftrnergydgosatyuzo.supabase.co/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000'));
})();
