import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export interface ObservabilityStackProps extends cdk.StackProps {
  envName: string;
  helloFn: lambda.IFunction;
}

/**
 * Baseline monitoring (MIGRATION.md §11). Alarms + a dashboard for the API Lambda.
 * Expands in Phase 3/4 (LLM budget alarms, SES bounce/complaint rates).
 * NOT deployed in the initial dev rollout.
 */
export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const errors = props.helloFn.metricErrors({ period: cdk.Duration.minutes(5) });

    new cloudwatch.Alarm(this, 'HelloFnErrors', {
      alarmName: `pathway-${props.envName}-hello-errors`,
      metric: errors,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `pathway-${props.envName}`,
    });
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Hello Lambda — invocations & errors',
        left: [props.helloFn.metricInvocations(), errors],
      }),
      new cloudwatch.GraphWidget({
        title: 'Hello Lambda — duration',
        left: [props.helloFn.metricDuration()],
      }),
    );
  }
}
