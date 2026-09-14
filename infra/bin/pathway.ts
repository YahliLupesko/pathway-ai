#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';
import { WebStack } from '../lib/web-stack';
import { ObservabilityStack } from '../lib/observability-stack';
import { CiStack } from '../lib/ci-stack';

const app = new cdk.App();

const envName: string = app.node.tryGetContext('env') ?? 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? 'us-west-2';
const env: cdk.Environment = { account, region };

// Google IdP is stubbed by default. Once the Google OAuth 2.0 client exists and its
// credentials are stored in Secrets Manager ('pathway/google-oauth' -> {clientId, clientSecret}),
// deploy with:  cdk deploy --context enableGoogleIdp=true
const enableGoogleIdp = (app.node.tryGetContext('enableGoogleIdp') ?? 'false') === 'true';

// Dev uses localhost + the eventual prod URL; adjust per environment as hosting lands (Phase 5).
const callbackUrls = ['http://localhost:5173/', 'https://pathway-ai.org/'];
const logoutUrls = ['http://localhost:5173/', 'https://pathway-ai.org/'];

const prefix = `pathway-${envName}`;

const data = new DataStack(app, `${prefix}-data`, { env, envName });

const auth = new AuthStack(app, `${prefix}-auth`, {
  env,
  envName,
  enableGoogleIdp,
  callbackUrls,
  logoutUrls,
});

const api = new ApiStack(app, `${prefix}-api`, {
  env,
  envName,
  table: data.table,
  key: data.key,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
});

// Written and synthesizable, but NOT part of the initial dev deploy (heavier / lower priority).
new WebStack(app, `${prefix}-web`, { env, envName });
new ObservabilityStack(app, `${prefix}-observability`, { env, envName, helloFn: api.helloFn });

// Security-sensitive (creates a GitHub-assumable IAM role). Written for review; deploy explicitly.
new CiStack(app, `${prefix}-ci`, { env, envName });

cdk.Tags.of(app).add('project', 'pathway-ai');
cdk.Tags.of(app).add('env', envName);
