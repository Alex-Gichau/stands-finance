import https from 'https';
const targetUrl = 'https://wjftrnergydgosatyuzo.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://ais-dev-km4p5ah2577oq3ir42cgsq-261596193432.europe-west2.run.app';

https.get(targetUrl, (res) => {
  console.log("Status:", res.statusCode);
  console.log("Location:", res.headers.location);
});
