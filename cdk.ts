#!/usr/bin/env node
import 'source-map-support/register'

import * as apigateway from '@aws-cdk/aws-apigateway'
import * as dynamodb from '@aws-cdk/aws-dynamodb'
import * as lambda from '@aws-cdk/aws-lambda'
import * as cdk from '@aws-cdk/core'

export class OpenPollStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const votesTable = new dynamodb.Table(this, 'Votes', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const oauthTable = new dynamodb.Table(this, 'Auth', {
      partitionKey: { name: 'teamId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const installLambda = new lambda.Function(this, 'InstallHandler', {
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromAsset('dist'),
      handler: 'lambda.installHandler',
      environment: {
        SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || 'it is a secret',
        SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || 'it is a secret',
      },
    })

    const oauthLambda = new lambda.Function(this, 'OAuthHandler', {
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromAsset('dist'),
      handler: 'lambda.oauthHandler',
      environment: {
        OAUTH_TABLE_NAME: oauthTable.tableName,
        SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || 'it is a secret',
        SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || 'it is a secret',
      },
    })
    oauthTable.grantReadWriteData(oauthLambda)

    const slackCommandLambda = new lambda.Function(this, 'CommandHandler', {
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromAsset('dist'),
      handler: 'lambda.commandHandler',
      environment: {
        OAUTH_TABLE_NAME: oauthTable.tableName,
        VOTES_TABLE_NAME: votesTable.tableName,
        SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || 'it is a secret',
      },
    })
    votesTable.grantReadWriteData(slackCommandLambda)
    oauthTable.grantReadWriteData(slackCommandLambda)

    const slackInteractionsLambda = new lambda.Function(this, 'InteractionsHandler', {
      runtime: lambda.Runtime.NODEJS_10_X,
      code: lambda.Code.fromAsset('dist'),
      handler: 'lambda.interactionsHandler',
      environment: {
        OAUTH_TABLE_NAME: oauthTable.tableName,
        VOTES_TABLE_NAME: votesTable.tableName,
        SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || 'it is a secret',
      },
    })
    votesTable.grantReadWriteData(slackInteractionsLambda)
    oauthTable.grantReadWriteData(slackInteractionsLambda)

    const api = new apigateway.RestApi(this, 'ApiGateway', {})
    api.root.addResource('install').addMethod('GET', new apigateway.LambdaIntegration(installLambda))
    api.root.addResource('oauth').addMethod('GET', new apigateway.LambdaIntegration(oauthLambda))
    api.root.addResource('poll').addMethod('POST', new apigateway.LambdaIntegration(slackCommandLambda))
    api.root.addResource('interactions').addMethod('POST', new apigateway.LambdaIntegration(slackInteractionsLambda))
  }
}

const app = new cdk.App()
new OpenPollStack(app, 'OpenPollStack')
