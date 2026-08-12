// Multi-tenant: sem seed global. Cada workspace nasce vazio no cadastro
// (provisionamento em lib/provision.ts). Este seed é intencionalmente no-op.
async function main() {
  console.log("Seed no-op (multi-tenant): ambientes são criados por workspace no cadastro.");
}
main();
