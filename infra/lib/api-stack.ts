import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

export interface ApiStackProps extends cdk.StackProps {
  envName: string;
  table: dynamodb.ITable;
  key: kms.IKey;
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
}

/**
 * HTTP API (API Gateway v2) with a Cognito JWT authorizer (MIGRATION.md §1).
 * `GET /hello` is protected; `GET /health` is public for smoke tests.
 * The hello Lambda proves DB access + the auth path end-to-end.
 */
export class ApiStack extends cdk.Stack {
  public readonly httpApi: HttpApi;
  public readonly helloFn: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const isProd = props.envName === 'prod';

    const helloLogs = new logs.LogGroup(this, 'HelloFnLogs', {
      logGroupName: `/aws/lambda/pathway-${props.envName}-hello`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.helloFn = new lambda.Function(this, 'HelloFn', {
      functionName: `pathway-${props.envName}-hello`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/hello'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logGroup: helloLogs,
      environment: { TABLE_NAME: props.table.tableName },
    });
    props.table.grantReadWriteData(this.helloFn);
    props.key.grantEncryptDecrypt(this.helloFn);

    const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`;
    const authorizer = new HttpJwtAuthorizer('JwtAuthorizer', issuer, {
      jwtAudience: [props.userPoolClient.userPoolClientId],
    });

    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `pathway-${props.envName}`,
      corsPreflight: {
        allowOrigins: ['http://localhost:5173', 'https://pathway-ai.org'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['authorization', 'content-type'],
      },
    });

    const integration = new HttpLambdaIntegration('HelloIntegration', this.helloFn);

    this.httpApi.addRoutes({
      path: '/hello',
      methods: [HttpMethod.GET],
      integration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/health',
      methods: [HttpMethod.GET],
      integration,
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
  }
}
