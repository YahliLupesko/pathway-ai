import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface CiStackProps extends cdk.StackProps {
  envName: string;
}

const GITHUB_REPO = 'YahliLupesko/pathway-ai';

/**
 * GitHub Actions OIDC → a role that can run `cdk deploy` (MIGRATION.md §6: "no static keys").
 *
 * SECURITY-SENSITIVE: creates an account-level OIDC provider and a role assumable from GitHub.
 * Deploy explicitly and review the trust policy before enabling CI:
 *   cdk deploy pathway-<env>-ci
 * Then set the repo/Actions secret AWS_DEPLOY_ROLE_ARN to the DeployRoleArn output.
 */
export class CiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CiStackProps) {
    super(scope, id, props);

    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const role = new iam.Role(this, 'DeployRole', {
      roleName: `pathway-${props.envName}-gha-deploy`,
      description: 'Assumed by GitHub Actions (OIDC) to run cdk deploy',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        // Scoped to the main branch only (not any ref/PR) to limit blast radius.
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${GITHUB_REPO}:ref:refs/heads/main`,
        },
      }),
    });

    // Least-privilege for CDK: only assume the bootstrap roles, which hold the real deploy perms.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );

    new cdk.CfnOutput(this, 'DeployRoleArn', { value: role.roleArn });
  }
}
