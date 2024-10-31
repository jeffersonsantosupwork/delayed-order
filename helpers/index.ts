import axios from 'axios'
import { ssmClient } from './aws'
import {GetParameterCommand} from "@aws-sdk/client-ssm"
import * as AESJS from "aes-js"
import * as pbkdf2 from "pbkdf2"

const COUNT = 5


export const defaultConfig = {
  executablePath: '/usr/bin/google-chrome',
  headless: false,
  slowMo: 200
}

export const delay = async (time: number) => {
  return new Promise((resolve, _) => {
    setTimeout(resolve, time)
  })
}

export const getConfigBySite = async (domain: string, offer: string) => {
  return axios.get(`${process.env.CONFIG_URL}/${domain}/${offer}`).then((res: any) => res?.data)
}

export const checkBinBlock = async (token: string, bin: string) => {
  return axios.post(`${process.env.BASE_URL}/transact/smartBins/getById`, {
    bin
  }, {
    headers: {
      authorization: token
    }
  }).then((res: any) => res?.data)
}

export const getVerifiedProductAmount = (options: any, verify3dsData: any) => {


  const { selectedProduct, isBinBlocked, isSmartBinEnabled } = options

  const verify3dsInitial = verify3dsData ? parseFloat(verify3dsData?.initialAmount || undefined) : undefined
  const verify3dsRebill = verify3dsData ? parseFloat(verify3dsData?.rebillAmount || undefined) : undefined

  const initialAmount = isSmartBinEnabled
    ? isBinBlocked
      ? parseFloat(selectedProduct?.transactionData?.prepaid?.verify3dsData?.initialAmount || verify3dsInitial)
      : parseFloat(selectedProduct?.transactionData?.normal?.verify3dsData?.initialAmount || verify3dsInitial)
    : parseFloat(selectedProduct?.transactionData?.normal?.verify3dsData?.initialAmount || verify3dsInitial)

  const rebillAmount = isSmartBinEnabled
    ? isBinBlocked
      ? parseFloat(selectedProduct?.transactionData?.prepaid?.verify3dsData?.rebillAmount || verify3dsRebill)
      : parseFloat(selectedProduct?.transactionData?.normal?.verify3dsData?.rebillAmount || verify3dsRebill)
    : parseFloat(selectedProduct?.transactionData?.normal?.verify3dsData?.rebillAmount || verify3dsRebill)

    console.log("InitialAmount" , initialAmount)
    console.log("Rebill" , rebillAmount)


  return [initialAmount, rebillAmount]
}


export const wait_for_browser = (browser_handler: any) => new Promise((resolve, reject) => {
  const browser_check = setInterval(() => {
    if (browser_handler?.browser !== false) {
      clearInterval(browser_check);
      resolve(true);
    }
  }, 100);
});

type GetRandomPortsListType = {
  interval?: number,
  initial?: number,
  end?: number
}
export const getRandomPortsList = ({ interval = 50, initial = 9000, end = 9999 }: GetRandomPortsListType) => {
  const loops = end - initial
  const arrayLength = Math.floor(loops / interval)


  return Array(arrayLength).fill(0).map((val) => {

    initial += interval;

    return String(initial)
  });
}

export const removeDelay = (data: any) => {

  const payload = {
    ...data
  }

  const products = data?.products?.map((product: any) => {

    if (product.delay) delete product.delay
    return product

  })

  payload.products = products

  return payload

}

const getAesKey = async () => {
  const command = new GetParameterCommand({
    Name: `/traputaris/global/${process.env.NODE_ENV}/declineOrderKey`,
    WithDecryption : true
  })
  const { Parameter } = await ssmClient.send(command)

  const key = pbkdf2.pbkdf2Sync(Parameter?.Value ?? "", "salt", 1, 128 / 8, "sha512")
  return key
}

export const getCreditCardInfo = async (hex: string) => {


  const key = await getAesKey()
  const encryptedBytes = AESJS.utils.hex.toBytes(hex)
  const decryptBytes = new AESJS.ModeOfOperation.ctr(key, new AESJS.Counter(COUNT)).decrypt(encryptedBytes)
  return AESJS.utils.utf8.fromBytes(decryptBytes)
}

export const serializeDynamoDbPayload = (payload : any , ignoreList?: string[]) : any => {

  if(Array.isArray(payload)){
    return payload.map(item => serializeDynamoDbPayload(item , ignoreList))
  }

  if(typeof payload === "object" && !Array.isArray(payload)){
    const item: any = {}
    for (const key of Object.keys(payload)) {

      if(ignoreList?.includes(key)) continue;

      const val = Object.values(payload[key])[0]


      if(Array.isArray(val) || typeof val === "object")
      item[key] =  serializeDynamoDbPayload(val , ignoreList)
      else {
        item[key] = val;
      }
    }
    return item

  }
  


  return payload
}