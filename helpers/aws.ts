import {SSMClient} from "@aws-sdk/client-ssm"
import {fromEnv} from '@aws-sdk/credential-provider-env'
import { DynamoDBClient } from  "@aws-sdk/client-dynamodb";
import {LambdaClient} from "@aws-sdk/client-lambda"

export const ssmClient = new SSMClient({ region: process.env.AWS_REGION , credentials : fromEnv() })
export const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION , credentials : fromEnv() })
export const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION , credentials : fromEnv() })