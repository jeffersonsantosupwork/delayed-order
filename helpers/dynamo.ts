import {dynamoDbClient} from './aws'
import {QueryCommand} from '@aws-sdk/client-dynamodb'
import { serializeDynamoDbPayload } from '.'

const DELAY_TABLE_NAME = `traputaris-transact-${process.env.NODE_ENV}-delayedRequests`

export const getConfigSiteByOffer = async (offer: string , account: string) => {

    const command = new QueryCommand({
        TableName: `traputaris-sites-${process.env.NODE_ENV}-configs`,
        ExpressionAttributeValues: {
            ":account": {S: account},
            ':offer': {S: offer}
        },
        KeyConditionExpression: 'account = :account and offer = :offer'

    })

    const { Items = [] } = await dynamoDbClient.send(command)
    const payload = serializeDynamoDbPayload(Items , ["_updateHistory" ])?.[0]
    return payload?.domain ?? ""
}

export async function getRequestData(requestID: string) {
    console.info("Requesting Data ", requestID)
    console.info("DELAY_TABLE_NAME ", DELAY_TABLE_NAME)

    if(!requestID){
        return null
    }

    const command = new QueryCommand({
        TableName: DELAY_TABLE_NAME,
        ExpressionAttributeValues: {
            ":id": {S : requestID}
        },
        KeyConditionExpression: 'id = :id'
    })


    const { Items: requestData = [] } = await dynamoDbClient.send(command)

    if (!requestData?.[0]) {
        console.info("No Request Data Found!!")
        return
    }
    console.log("SerializeDynamoDbPayload Calling")
    const data =  serializeDynamoDbPayload(requestData?.[0] , ["_updateHistory" ])
    console.log(`Data ${JSON.stringify(data)}`)
    return data;
}