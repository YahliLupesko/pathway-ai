import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';

export interface DataStackProps extends cdk.StackProps {
  envName: string;
}

/**
 * DynamoDB single-table store (MIGRATION.md §4.2) with a customer-managed key,
 * point-in-time recovery, and a TTL attribute for QUOTA#/ephemeral items.
 */
export class DataStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly key: kms.Key;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const isProd = props.envName === 'prod';

    this.key = new kms.Key(this, 'DataKey', {
      alias: `pathway-${props.envName}-data`,
      description: `Pathway AI (${props.envName}) DynamoDB encryption key`,
      enableKeyRotation: true,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: `pathway-${props.envName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.key,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Generic inverted index for single-table access patterns (e.g. lookups by entity type).
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    new cdk.CfnOutput(this, 'TableName', { value: this.table.tableName });
    new cdk.CfnOutput(this, 'TableArn', { value: this.table.tableArn });
    new cdk.CfnOutput(this, 'KeyArn', { value: this.key.keyArn });
  }
}
