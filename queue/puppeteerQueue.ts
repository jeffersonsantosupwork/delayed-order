import { Job, DoneCallback } from 'bull'
import { Browser } from 'puppeteer';
import { checkBinBlock, getConfigBySite, getCreditCardInfo, getVerifiedProductAmount, wait_for_browser } from '../helpers';
import { getConfigSiteByOffer, getRequestData } from '../helpers/dynamo';
import createPuppeteerPool, { DEFAULTS } from '../helpers/puppeteer-pool'
import logger from '../helpers/winston';


const pool = createPuppeteerPool({
    min: DEFAULTS.min,
    max: DEFAULTS.max,
    maxWaitingClients: 0,
    idleTimeoutMillis: 1000 * 60 * 60 * 5, // 30mins
    puppeteerLaunchArgs: [{
        headless: true,
        args: [
            "--no-sandbox",
            '--remote-debugging-address=0.0.0.0',
        ],
        timeout: 60000,
        slowMo: 250, // slow down by 500ms
        // executablePath: '/usr/bin/google-chrome'
    }]
});



const runPuppeteer = async (browser: Browser, delayedProduct: any) => {
    if (delayedProduct) {
        logger.info(`DEBUG: Delay ID ${delayedProduct?.id}`)
        try {
            const offer = delayedProduct?.config
            const params = JSON.parse(delayedProduct?.params)
            const account = delayedProduct?.accountid
            let creditCard = null

            try {
                // decrypt the card info
                creditCard = JSON.parse(await getCreditCardInfo(params?.transactionDetails)) || params?.creditCard
                logger.info(`DEBUG: card info decrypted successfully`)
            }
            catch (err) {
                logger.info(`Error While decrypt creditcard ${JSON.stringify(err)}`)
                creditCard = params?.creditCard
            }

            const product = params?.products[0]
            const domain = await getConfigSiteByOffer(offer, account)
            const config = await getConfigBySite(domain, offer)
                .catch(err => {
                    throw err
                })
            logger.info(`DEBUG: config fetch success`)


            const { verify3ds = "" } = config
            let verifyKey = verify3ds
            let formID = "billing-form"

            const page = await browser.newPage();
            page.setDefaultTimeout(60000)
            logger.info(`Default TimeOut ${page.getDefaultTimeout()}`)

            await page.authenticate({
                username: String(process.env.PROXY_USERNAME),
                password: String(process.env.PROXY_PASSWORD),
            });

            logger.info(`Page Authenticated and Redirected to Port ${process.env.PORT}`)
            await page.goto(`http://localhost:${process.env.PORT}`);

            const options = {
                formID,
                verifyKey,
                cc: creditCard?.number,
                month: creditCard?.expirationMonth,
                year: creditCard?.expirationYear,
                cvv: creditCard?.cvv,
                config: config,
                product,
                placeOrderParams: params,
                _id: delayedProduct.id,
                _STAGE: process.env.NODE_ENV,
                BASE_URL: process.env.BASE_URL
            }

            await page.type("#credit-card", options?.cc)
            await page.type("#month", options?.month)
            await page.type("#year", options?.year)
            await page.type("#cvv", options?.cvv)

            await page.exposeFunction(getVerifiedProductAmount.name, getVerifiedProductAmount)
            await page.exposeFunction(checkBinBlock.name, checkBinBlock)


            await page.evaluate(async (options: any) => {

                const { cc, month: cardMonth, year: cardYear, formID, verifyKey, _STAGE } = options

                delete options._STAGE
                // @ts-expect-error
                window.options = options


                let _options: any = {
                    autoSubmit: false,
                    allowRetry: false,
                    forcedTimeout: "8",
                    protocolVersion: "2.1.0",
                    showChallenge: false,
                    addResultToForm: false,
                    start: () => console.log("Verify Start!!"),
                    resolve: () => console.info("Verify Resolve!!"),
                    reject: () => logger.error("Verify Reject!!"),
                    prompt: () => console.log("Prompt"),
                    authorizationComplete: () => console.log("authorized"),
                };

                if (!["production", "live"].includes(_STAGE)) {
                    _options.endpoint = 'https://api-sandbox.3dsintegrator.com/v2';
                    _options.verbose = true;
                }

                const form3ds = document.createElement('form')
                form3ds.id = formID


                const input1 = document.createElement('input')
                input1.type = 'text'
                input1.name = 'x_card_num'
                input1.value = ''
                input1.setAttribute('data-threeds', 'pan');


                const input2 = document.createElement('input')
                input2.type = 'text'
                input2.name = 'x_exp_month'
                input2.value = ''
                input2.setAttribute('data-threeds', 'month');

                const input3 = document.createElement('input')
                input3.type = 'text'
                input3.name = 'x_exp_year'
                input3.value = ''
                input3.setAttribute('data-threeds', 'year');



                form3ds.appendChild(input1)
                form3ds.appendChild(input2)
                form3ds.appendChild(input3)

                document.body.appendChild(form3ds)


                const [card, expMonth, expYear] = document.querySelectorAll('[data-threeds]');


                // @ts-ignore
                card.value = cc
                // @ts-ignore
                expMonth.value = cardMonth
                // @ts-ignore
                expYear.value = cardYear


                try {
                    // @ts-ignore
                    window.TDS = new window.ThreeDS(
                        formID,
                        verifyKey,
                        null,
                        _options
                    );
                } catch (err) {
                    console.error("Error in initializing 3ds to browser", err)
                }

                console.log("Fetching ip address...")
                try {
                    // Logging Client Ip address 
                    await fetch(`${options.BASE_URL}/transact/getClientIp` , {
                        method : "POST",
                        mode: "cors",
                    }).then(() => console.log("Ip Fetched")).catch((err) => console.error(err))
                }
                catch {
                    console.error("Unable to fetch getClientIp")
                }

            }, options);

            logger.info(`DEBUG: 3ds initialize to browser`);


            const submitButton = await page.$('#submitBtn')
            await submitButton?.evaluate(async () => {
                function stripUndefined(obj: any) {
                    let newObj = { ...obj };

                    for (const key in newObj) {
                        if (newObj[key] === undefined) {
                            delete newObj[key];
                        }
                    }

                    return newObj;
                }


                const { binOptions = "binBlock", binBlockCheck = false } = options.config
                const { verify3dsData = null } = options.product

                const isSmartBinEnabled = (binOptions === "smartBinBlock" && binBlockCheck);

                const bin = options.cc.slice(0, 6)
                console.log("Before Check bin")
                // @ts-expect-error
                const checkBin = await window.checkBinBlock(options.config.token, bin)

                console.log(`DEBUG: bin-blocked checked ${checkBin}`)
                console.log(`DEBUG: smart-bin checked ${isSmartBinEnabled}`)

                // @ts-expect-error
                const [initialAmount, rebillAmount] = await window.getVerifiedProductAmount({
                    selectedProduct: options.product,
                    isSmartBinEnabled,
                    isBinBlocked: !!checkBin?.bin ?? false
                }, verify3dsData)

                console.log(`DEBUG: 3ds verified amount ${JSON.stringify({
                    initialAmount, rebillAmount
                })}`)

                return new Promise(async (resolve, reject) => {

                    const placeOrderCall = async () => {
                        // prepare payload for place order
                        console.log(`DEBUG: delayId ${options._id}`)

                        try {
                            const res = await fetch(`${options.BASE_URL}/transact/delayed/addOnTrigger`, {
                                mode: "cors",
                                method: 'POST',
                                headers: {
                                    authorization: options.config.token
                                },
                                body: JSON.stringify({
                                    requestID: options._id
                                })
                            }).then(_res => {
                                if (!_res.ok) {
                                    throw new Error('Network error');
                                }

                                return _res.json()
                            })

                            resolve(res)
                        }
                        catch (err) {
                            reject(err)
                        }
                    }

                    const verifyResolve = (res: any, type: string, callback?: any) => {
                        let result = {
                            acsTransId: res.acsTransId,
                            authenticationValue: res.authenticationValue,
                            cavv: res.cavv,
                            dsTransId: res.dsTransId,
                            eci: res.eci,
                            protocolVersion: res.protocolVersion,
                            status: res.status,
                            xid: res.xid,
                        }

                        result = stripUndefined(result);

                        if (callback) {
                            callback();
                        }
                        else {
                            placeOrderCall()
                        }
                    }

                    const verifyReject = (callback?: any) => {
                        console.log("Verify-Reject", callback)
                        if (callback) {
                            callback();
                        }
                        else {
                            placeOrderCall()
                        }
                    }

                    if (initialAmount && !rebillAmount) {
                        // @ts-expect-error
                        TDS.verify((res: any) => verifyResolve(res, 'initial'), () => verifyReject(), { amount: initialAmount });

                    } else if (rebillAmount && !initialAmount) {
                        // @ts-expect-error
                        TDS.verify((res: any) => verifyResolve(res, 'rebill'), () => verifyReject(), { amount: rebillAmount });
                    } else if (initialAmount && rebillAmount) {
                        let callback = async () => {
                            // @ts-expect-error
                            TDS.verify((res) => verifyResolve(res, 'rebill'), () => verifyReject(), { amount: rebillAmount });
                        }
                        // @ts-expect-error
                        TDS.verify((res: any) => verifyResolve(res, 'initial', callback), () => verifyReject(callback), { amount: initialAmount });
                    }
                    else {
                        console.log(`DEBUG: Falling In Else Block`)
                        placeOrderCall()
                    }



                })

            })

            await page.close()


        }
        catch (err: any) {
            throw err
        }
    }

}


async function main(done: DoneCallback, delayRequestId: string) {
    try {

        let browserHandler: any = null
        try {
            browserHandler = await pool.acquire();
            logger.info(`DEBUG: browser acquired`)
        } catch (e) {
            //   continue;
            logger.warn("Acquire Error", e)
        }


        await wait_for_browser(browserHandler)

        const delayedProduct = await getRequestData(delayRequestId)
        logger.info(`DEBUG: delay product fetched successfully`)
        runPuppeteer(browserHandler.browser, delayedProduct)
            .then(async () => {
                // pool.drain()
                //     .then(function () {
                //         console.log("POOL CLEAR")
                //         return pool.clear();
                //     });
                logger.info(`DEBUG: Completed pool`)
                done()
            })
            .catch(async (e) => {
                logger.error("ERROR:: ", e);
                done(e)

            })
            .finally(async () => {
                await pool.destroy(browserHandler);
                if (browserHandler.browser) {
                    await browserHandler.browser.close();

                }
            });
    } catch (e: any) {
        logger.error("ERROR:: ", e);
        done(e)
        throw e
    }
}


const puppeteerQueueProcess = async (job: Job, done: DoneCallback) => {

    logger.info(`Running JOB #${job.id}`)
    logger.info(`JOB DATA #${job.data}`)


    try {

        await main(done, job.data?.id)
    }
    catch (err) {
        logger.error(err)
    }

}

export default puppeteerQueueProcess