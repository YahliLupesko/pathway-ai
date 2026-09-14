import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface AuthStackProps extends cdk.StackProps {
  envName: string;
  enableGoogleIdp: boolean;
  callbackUrls: string[];
  logoutUrls: string[];
}

/**
 * Cognito user pool with open self-signup + Hosted UI (MIGRATION.md §6).
 *
 * The Google IdP is gated behind `enableGoogleIdp`. It is OFF until a Google OAuth 2.0
 * client is created and its credentials are stored in Secrets Manager as
 * 'pathway/google-oauth' => { "clientId": "...", "clientSecret": "..." }.
 * Then deploy the auth stack with `--context enableGoogleIdp=true`.
 */
export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly domainPrefix: string;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const isProd = props.envName === 'prod';

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `pathway-${props.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const supportedIdps: cognito.UserPoolClientIdentityProvider[] = [
      cognito.UserPoolClientIdentityProvider.COGNITO,
    ];

    if (props.enableGoogleIdp) {
      // TODO(Phase 1): create the Google OAuth client and store creds in Secrets Manager first.
      const secret = secretsmanager.Secret.fromSecretNameV2(this, 'GoogleOauth', 'pathway/google-oauth');
      const google = new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
        userPool: this.userPool,
        clientId: secret.secretValueFromJson('clientId').unsafeUnwrap(),
        clientSecretValue: secret.secretValueFromJson('clientSecret'),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        },
      });
      this.userPool.registerIdentityProvider(google);
      supportedIdps.push(cognito.UserPoolClientIdentityProvider.GOOGLE);
    }

    // Hosted UI domain prefix must be globally unique; scope it by account + env.
    this.domainPrefix = `pathway-${props.envName}-${this.account}`.toLowerCase();
    this.userPool.addDomain('HostedUI', {
      cognitoDomain: { domainPrefix: this.domainPrefix },
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `pathway-${props.envName}-web`,
      generateSecret: false, // public SPA client -> Authorization Code + PKCE
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: props.callbackUrls,
        logoutUrls: props.logoutUrls,
      },
      supportedIdentityProviders: supportedIdps,
      preventUserExistenceErrors: true,
    });

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'HostedUiDomain', {
      value: `${this.domainPrefix}.auth.${this.region}.amazoncognito.com`,
    });
    new cdk.CfnOutput(this, 'Issuer', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
    });
    new cdk.CfnOutput(this, 'GoogleIdpEnabled', { value: String(props.enableGoogleIdp) });
  }
}
