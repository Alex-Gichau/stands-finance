import dns from 'dns';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const project = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || "";
if (!project) {
  console.error("❌ SUPABASE_URL is not set or project reference cannot be parsed!");
  process.exit(1);
}
const regions = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-northeast-3", "ap-south-1",
  "sa-east-1", "ca-central-1", "me-central-1", "af-south-1"
];

function resolveHost(host: string): Promise<string | null> {
  return new Promise((resolve) => {
    dns.resolve(host, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve(null);
      } else {
        resolve(addresses[0]);
      }
    });
  });
}

async function run() {
  console.log(`Scanning DNS for pooler addresses of project '${project}'...`);
  let found = false;
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const ip = await resolveHost(host);
    if (ip) {
      console.log(`🟢 Region found: ${region} => Host: ${host} (IP: ${ip})`);
      found = true;
    }
  }
  if (!found) {
    console.log(`❌ No regional pooler resolved. Checking db.${project}.supabase.co DNS...`);
    const directIp = await resolveHost(`db.${project}.supabase.co`);
    if (directIp) {
      console.log(`🟢 Direct Host resolves! db.${project}.supabase.co => IP: ${directIp}`);
    } else {
      console.log("❌ Direct host does not resolve either.");
    }
  }
}

run();
