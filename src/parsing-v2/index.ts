import bolt11 from "bolt11"
import url from "url"
import { networks, address } from "bitcoinjs-lib"
import { utils } from "lnurl-pay"

export const getDescription = (decoded: bolt11.PaymentRequestObject) => {
  const data = decoded.tags.find((value) => value.tagName === "description")?.data
  if (data) {
    return data as string
  }
}

export const getDestination = (
  decoded: bolt11.PaymentRequestObject,
): string | undefined => decoded.payeeNodeKey

export const getHashFromInvoice = (invoice: string): string | undefined => {
  const decoded = bolt11.decode(invoice)
  const data = decoded.tags.find((value) => value.tagName === "payment_hash")?.data
  if (data) {
    return data as string
  }
}

export type Network = "mainnet" | "testnet" | "regtest"
export enum PaymentType {
  Lightning = "lightning",
  Intraledger = "intraledger",
  Onchain = "onchain",
  Lnurl = "lnurl",
  Unknown = "unknown",
}

export type UnknownPaymentDestination = {
  paymentType: PaymentType.Unknown
}

export enum InvalidLnurlPaymentDestinationReason {
  Unknown = "Unknown",
}

export type LnurlPaymentDestination =
  | {
      paymentType: PaymentType.Lnurl
      valid: true
      lnurl: string
    }
  | {
      paymentType: PaymentType.Lnurl
      valid: false
      invalidReason: InvalidLnurlPaymentDestinationReason
    }

export enum InvalidLightningDestinationReason {
  InvoiceExpired = "InvoiceExpired",
  WrongNetwork = "WrongNetwork",
  Unknown = "Unknown",
}

export type LightningPaymentDestination =
  | {
      paymentType: PaymentType.Lightning
      valid: true
      paymentRequest: string
      amount?: number | undefined
      memo?: string | undefined
      sameNode: boolean
    }
  | {
      paymentType: PaymentType.Lightning
      valid: false
      invalidReason: InvalidLightningDestinationReason
    }

export enum InvalidOnchainDestinationReason {
  WrongNetwork = "WrongNetwork",
  Unknown = "Unknown",
  InvalidAmount = "InvalidAmount",
}

export type OnchainPaymentDestination =
  | {
      paymentType: PaymentType.Onchain
      valid: true
      address: string
      amount?: number | undefined
      memo?: string | undefined
    }
  | {
      paymentType: PaymentType.Onchain
      valid: false
      invalidReason: InvalidOnchainDestinationReason
    }

export type IntraledgerPaymentDestination = {
  paymentType: PaymentType.Intraledger
  handle: string
}

export type ParsedPaymentDestination =
  | UnknownPaymentDestination
  | LnurlPaymentDestination
  | LightningPaymentDestination
  | OnchainPaymentDestination
  | IntraledgerPaymentDestination

export const lightningInvoiceHasExpired = (
  payReq: bolt11.PaymentRequestObject,
): boolean => {
  return Boolean(payReq?.timeExpireDate && payReq.timeExpireDate < Date.now() / 1000)
}

export const getLightningInvoiceExpiryTime = (
  payReq: bolt11.PaymentRequestObject,
): number => {
  return payReq?.timeExpireDate || NaN
}

export const decodeInvoiceString = (invoice: string): bolt11.PaymentRequestObject => {
  return bolt11.decode(invoice)
}

// from https://github.com/bitcoin/bips/blob/master/bip-0020.mediawiki#Transfer%20amount/size
const reAmount = /^(([\d.]+)(X(\d+))?|x([\da-f]*)(\.([\da-f]*))?(X([\da-f]+))?)$/iu
const parseAmount = (txt: string): number => {
  const match = txt.match(reAmount)
  if (!match) {
    return NaN
  }
  return Math.round(
    match[5]
      ? (parseInt(match[5], 16) +
          (match[7] ? parseInt(match[7], 16) * Math.pow(16, -match[7].length) : 0)) *
          (match[9] ? Math.pow(16, parseInt(match[9], 16)) : 0x10000)
      : Number(match[2]) * (match[4] ? Math.pow(10, Number(match[4])) : 1e8),
  )
}

type ParsePaymentDestinationArgs = {
  destination: string
  network: Network
  pubKey: string
  lnAddressDomains: string[]
}

const inputDataToObject = (data: string): any => {
  return url.parse(data, true)
}

const getLNParam = (data: string): string | undefined => {
  return inputDataToObject(data)?.query?.lightning
}

const getProtocolAndData = (
  destination: string,
): { protocol: string; destinationText: string } => {
  // input might start with 'lightning:', 'bitcoin:'
  const split = destination.split(":")
  const protocol = split[1] ? split[0].toLocaleLowerCase() : ""
  const destinationText = split[1] ?? split[0]
  return { protocol, destinationText }
}

const getPaymentType = ({
  protocol,
  destinationText,
}: {
  protocol: string
  destinationText: string
}): PaymentType => {
  // As far as the client is concerned, lnurl is the same as lightning address
  if (utils.isLnurl(destinationText) || utils.isLightningAddress(destinationText)) {
    return PaymentType.Lnurl
  }
  if (
    protocol === "lightning" ||
    destinationText.match(/^ln(bc|tb).{50,}/iu) ||
    (destinationText && getLNParam(destinationText) !== undefined)
  ) {
    return PaymentType.Lightning
  }
  if (protocol === "onchain" || destinationText.match(/^(1|3|bc1|tb1|bcrt1)/iu)) {
    return PaymentType.Onchain
  }

  const handle = protocol.match(/^(http|\/\/)/iu)
    ? destinationText.split("/")[destinationText.split("/").length - 1]
    : destinationText

  if (handle?.match(/(?!^(1|3|bc1|lnbc1))^[0-9a-z_]{3,50}$/iu)) {
    return PaymentType.Intraledger
  }

  return PaymentType.Unknown
}

const getIntraLedgerPayResponse = ({
  protocol,
  destinationText,
}: {
  protocol: string
  destinationText: string
}): IntraledgerPaymentDestination | UnknownPaymentDestination => {
  const paymentType = PaymentType.Intraledger

  const handle = protocol.match(/^(http|\/\/)/iu)
    ? destinationText.split("/")[destinationText.split("/").length - 1]
    : destinationText

  if (handle?.match(/(?!^(1|3|bc1|lnbc1))^[0-9a-z_]{3,50}$/iu)) {
    return {
      paymentType,
      handle,
    }
  }

  return {
    paymentType: PaymentType.Unknown,
  }
}

const getLNURLPayResponse = ({
  destinationText,
  lnAddressDomains,
}: {
  destinationText: string
  lnAddressDomains: string[]
}):
  | LnurlPaymentDestination
  | IntraledgerPaymentDestination
  | UnknownPaymentDestination => {
  // handle internal lightning addresses
  for (const domain of lnAddressDomains) {
    if (destinationText.includes(domain)) {
      const handle = destinationText.split("@")[0]
      return getIntraLedgerPayResponse({
        protocol: "",
        destinationText: handle,
      })
    }
  }

  return {
    valid: true,
    paymentType: PaymentType.Lnurl,
    lnurl: destinationText,
  }
}

const getLightningPayResponse = ({
  destination,
  network,
  pubKey,
}: {
  destination: string
  network: Network
  pubKey: string
}): LightningPaymentDestination => {
  const paymentType = PaymentType.Lightning
  const { destinationText } = getProtocolAndData(destination)
  const lnProtocol =
    getLNParam(destination)?.toLowerCase() || destinationText.toLowerCase()

  if (
    (network === "mainnet" &&
      !(lnProtocol.match(/^lnbc/iu) && !lnProtocol.match(/^lnbcrt/iu))) ||
    (network === "testnet" && !lnProtocol.match(/^lntb/iu)) ||
    (network === "regtest" && !lnProtocol.match(/^lnbcrt/iu))
  ) {
    return {
      valid: false,
      paymentType,
      invalidReason: InvalidLightningDestinationReason.WrongNetwork,
    }
  }

  let payReq: bolt11.PaymentRequestObject | undefined = undefined
  try {
    payReq = bolt11.decode(lnProtocol)
  } catch (err) {
    return {
      valid: false,
      paymentType,
      invalidReason: InvalidLightningDestinationReason.Unknown,
    }
  }

  const sameNode = pubKey === getDestination(payReq)

  const amount =
    payReq.satoshis || payReq.millisatoshis
      ? payReq.satoshis ?? Number(payReq.millisatoshis) / 1000
      : undefined

  if (lightningInvoiceHasExpired(payReq)) {
    return {
      valid: false,
      paymentType,
      invalidReason: InvalidLightningDestinationReason.InvoiceExpired,
    }
  }

  const memo = getDescription(payReq)
  return {
    valid: true,
    paymentRequest: lnProtocol,
    sameNode,
    amount,
    memo,
    paymentType,
  }
}

const getOnChainPayResponse = ({
  destinationText,
  network,
}: {
  destinationText: string
  network: Network
}): OnchainPaymentDestination => {
  const paymentType = PaymentType.Onchain
  try {
    const decodedData = inputDataToObject(destinationText)

    // some apps encode addresses in UPPERCASE
    const path = decodedData?.pathname as string
    if (!path) {
      throw new Error("No address detected in decoded destination")
    }

    let amount: number | undefined = undefined
    try {
      amount = decodedData?.query?.amount
        ? parseAmount(decodedData.query.amount as string)
        : undefined
    } catch (err) {
      console.debug("[Parse error: amount]:", err)
      return {
        valid: false,
        paymentType,
        invalidReason: InvalidOnchainDestinationReason.InvalidAmount,
      }
    }

    // will throw if address is not valid
    address.toOutputScript(path, networks[network === "mainnet" ? "bitcoin" : network])
    return {
      valid: true,
      paymentType,
      address: path,
      amount,
    }
  } catch (err) {
    console.debug("[Parse error: onchain]:", err)
    return {
      valid: false,
      invalidReason: InvalidOnchainDestinationReason.Unknown,
      paymentType,
    }
  }
}

export const parsePaymentDestination = ({
  destination,
  network,
  pubKey,
  lnAddressDomains,
}: ParsePaymentDestinationArgs): ParsedPaymentDestination => {
  if (!destination) {
    return { paymentType: PaymentType.Unknown }
  }

  const { protocol, destinationText } = getProtocolAndData(destination)

  const paymentType = getPaymentType({ protocol, destinationText })

  switch (paymentType) {
    case PaymentType.Lnurl:
      return getLNURLPayResponse({ destinationText, lnAddressDomains })
    case PaymentType.Lightning:
      return getLightningPayResponse({ destination, network, pubKey })
    case PaymentType.Onchain:
      return getOnChainPayResponse({ destinationText, network })
    case PaymentType.Intraledger:
      return getIntraLedgerPayResponse({ protocol, destinationText })
    case PaymentType.Unknown:
      return { paymentType: PaymentType.Unknown }
  }
}
