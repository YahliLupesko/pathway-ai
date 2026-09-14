# Pathway AI — Infrastructure (AWS CDK)

CDK (TypeScript) app for the Base44 → AWS migration. See [`../MIGRATION.md`](../MIGRATION.md).

## Stacks

| Stack | Contents | Deployed in dev? |
|---|---|---|
| `pathway-<env>-data` | DynamoDB single table (on-demand, PITR, CMK, TTL) + GSI1 | ✅ yes |
| `pathway-<env>-auth` | Cognito user pool + Hosted UI + PKCE web client; Google IdP (gated) | ✅ yes |
| `pathway-<env>-api` | HTTP API + Cognito JWT authorizer + hello Lambda (Node 22) | ✅ yes |
| `pathway-<env>-web` | S3 + CloudFront (OAC) SPA hosting | ⬜ written, not deployed (Phase 5) |
| `pathway-<env>-observability` | CloudWatch alarms + dashboard | ⬜ written, not deployed |
| `pathway-<env>-ci` | GitHub Actions OIDC provider + deploy role | ⬜ written, not deployed (security review) |

## Prerequisites
- Node 22+, an AWS profile named `pathway` (region `us-west-2`).
- Bootstrap once: `npx cdk bootstrap aws://<account>/us-west-2 --profile pathway`.

## Commands
```bash
npm install
npm run synth                              # cdk synth (no cloud changes)
# Deploy the core dev environment:
npx cdk deploy pathway-dev-data pathway-dev-auth pathway-dev-api \
  --require-approval never --context env=dev --profile pathway
```

## Google IdP (stubbed)
The Cognito Google IdP is OFF until:
1. A Google OAuth 2.0 client is created (redirect URI = the Hosted UI callback
   `https://<HostedUiDomain>/oauth2/idpresponse`).
2. Its creds are stored in Secrets Manager as `pathway/google-oauth`:
   ```bash
   aws secretsmanager create-secret --name pathway/google-oauth \
     --secret-string '{"clientId":"...","clientSecret":"..."}' \
     --profile pathway --region us-west-2
   ```
3. Redeploy auth: `npx cdk deploy pathway-dev-auth --context env=dev --context enableGoogleIdp=true --profile pathway`

## CI (GitHub Actions, OIDC)
`.github/workflows/deploy.yml` deploys the core stacks on push to `main`. It needs the
`pathway-<env>-ci` stack deployed and the `AWS_DEPLOY_ROLE_ARN` Actions secret set to its
`DeployRoleArn` output. Left un-deployed pending review of the IAM trust policy.
