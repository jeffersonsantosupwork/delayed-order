import {InvokeCommand} from '@aws-sdk/client-lambda'
import {lambdaClient} from "./aws"

export const invokeLambda = async(bin : string) => {

    const command = new InvokeCommand({
        FunctionName : `traputaris-transact-${process.env.NODE_ENV}-checkBinBlock`,
        // @ts-ignore
        Payload:JSON.stringify({
            body: {
             bin : bin
            }
         }),
        
    })


    const {Payload}  = await lambdaClient.send(command)

    // @ts-expect-error
    return Payload?.body ? JSON.parse(Payload?.body) : Payload ? Payload : null
}