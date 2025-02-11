import {
  QueryResult,
  QueryHookOptions,
  useApolloClient,
  useQuery as useApolloQuery,
  QueryOptions,
} from "@apollo/client"
import { useCallback, useState } from "react"

import accountDefaultWallet from "./queries/account-default-wallet"
import btcPriceList from "./queries/btc-price-list"
import businessMapMarkers from "./queries/business-map-markers"
import contacts from "./queries/contacts"
import getWalletCsvTransactions from "./queries/get-wallet-csv-transactions"
import main from "./queries/main"
import onChainTxFee from "./queries/on-chain-tx-fee"
import quizQuestions from "./queries/quiz-questions"
import transactionList from "./queries/transaction-list"
import transactionListForContact from "./queries/transaction-list-for-contact"
import transactionListForDefaultAccount from "./queries/transaction-list-for-default-account"
import userDefaultWalletId from "./queries/user-default-wallet-id"
import usernameAvailable from "./queries/username-available"
import currencyList from "./queries/currency-list"

import { GaloyGQL, joinErrorsMessages } from "../index"

export const QUERIES = {
  accountDefaultWallet,
  btcPriceList,
  businessMapMarkers,
  contacts,
  getWalletCsvTransactions,
  main,
  onChainTxFee,
  quizQuestions,
  transactionList,
  transactionListForContact,
  transactionListForDefaultAccount,
  userDefaultWalletId,
  usernameAvailable,
  currencyList,
}

type QueryHelpers = {
  errorsMessage?: string
}

const useQueryWrapper = <TData = unknown, TVars = unknown>(
  queryName: keyof typeof QUERIES,
  config?: QueryHookOptions<TData, TVars>,
): QueryResult<TData, TVars> & QueryHelpers => {
  const result = useApolloQuery<TData, TVars>(QUERIES[queryName], config)

  const { data, error } = result
  const errors = (data as any)?.[queryName]?.errors
  const errorsMessage = error?.message || joinErrorsMessages(errors)

  return { ...result, errorsMessage }
}

const onChainTxFeeQuery = (
  config?: QueryHookOptions<
    GaloyGQL.OnChainTxFeeQuery,
    GaloyGQL.OnChainTxFeeQueryVariables
  >,
): QueryResult<GaloyGQL.OnChainTxFeeQuery, GaloyGQL.OnChainTxFeeQueryVariables> &
  QueryHelpers => {
  return useQueryWrapper<GaloyGQL.OnChainTxFeeQuery, GaloyGQL.OnChainTxFeeQueryVariables>(
    "onChainTxFee",
    config,
  )
}

const mainQuery = (
  config?: QueryHookOptions<GaloyGQL.MainQuery, GaloyGQL.MainQueryVariables>,
): QueryResult<GaloyGQL.MainQuery, GaloyGQL.MainQueryVariables> & QueryHelpers => {
  return useQueryWrapper<GaloyGQL.MainQuery, GaloyGQL.MainQueryVariables>("main", config)
}

const accountDefaultWalletQuery = (
  config?: QueryHookOptions<
    GaloyGQL.AccountDefaultWalletQuery,
    GaloyGQL.AccountDefaultWalletQueryVariables
  >,
): QueryResult<
  GaloyGQL.AccountDefaultWalletQuery,
  GaloyGQL.AccountDefaultWalletQueryVariables
> &
  QueryHelpers => {
  return useQueryWrapper<
    GaloyGQL.AccountDefaultWalletQuery,
    GaloyGQL.AccountDefaultWalletQueryVariables
  >("accountDefaultWallet", config)
}

const transactionListQuery = (
  config?: QueryHookOptions<
    GaloyGQL.TransactionListQuery,
    GaloyGQL.TransactionListQueryVariables
  >,
): QueryResult<GaloyGQL.TransactionListQuery> & QueryHelpers => {
  return useQueryWrapper<
    GaloyGQL.TransactionListQuery,
    GaloyGQL.TransactionListQueryVariables
  >("transactionList", config)
}

const transactionListForDefaultAccountQuery = (
  config?: QueryHookOptions<
    GaloyGQL.TransactionListForDefaultAccountQuery,
    GaloyGQL.TransactionListForDefaultAccountQueryVariables
  >,
): QueryResult<GaloyGQL.TransactionListForDefaultAccountQuery> & QueryHelpers => {
  return useQueryWrapper<
    GaloyGQL.TransactionListForDefaultAccountQuery,
    GaloyGQL.TransactionListForDefaultAccountQueryVariables
  >("transactionListForDefaultAccount", config)
}

const contactsQuery = (
  config?: QueryHookOptions<GaloyGQL.ContactsQuery, GaloyGQL.ContactsQueryVariables>,
): QueryResult<GaloyGQL.ContactsQuery, GaloyGQL.ContactsQueryVariables> &
  QueryHelpers => {
  return useQueryWrapper<GaloyGQL.ContactsQuery, GaloyGQL.ContactsQueryVariables>(
    "contacts",
    config,
  )
}

const transactionListForContactQuery = (
  config?: QueryHookOptions<
    GaloyGQL.TransactionListForContactQuery,
    GaloyGQL.TransactionListForContactQueryVariables
  >,
): QueryResult<
  GaloyGQL.TransactionListForContactQuery,
  GaloyGQL.TransactionListForContactQueryVariables
> &
  QueryHelpers => {
  return useQueryWrapper<
    GaloyGQL.TransactionListForContactQuery,
    GaloyGQL.TransactionListForContactQueryVariables
  >("transactionListForContact", config)
}

export const useQuery = {
  accountDefaultWallet: accountDefaultWalletQuery,
  contacts: contactsQuery,
  main: mainQuery,
  onChainTxFee: onChainTxFeeQuery,
  transactionList: transactionListQuery,
  transactionListForContact: transactionListForContactQuery,
  transactionListForDefaultAccount: transactionListForDefaultAccountQuery,
}

// ********** DELAYED QUERIES ********** //

const useDelayedQueryWrapper = <TData = unknown, TVars = unknown>(
  queryName: keyof typeof QUERIES,
  config?: Omit<QueryOptions<TVars, TData>, "query" | "variables">,
): [
  (variables?: TVars) => Promise<QueryResult<TData> & QueryHelpers>,
  { loading: boolean },
] => {
  const client = useApolloClient()
  const [loading, setLoading] = useState<boolean>(false)

  const sendQuery = useCallback(
    async (variables: TVars) => {
      setLoading(true)
      try {
        const result = await client.query({
          query: QUERIES[queryName],
          variables,
          ...config,
        })
        setLoading(false)
        const { data, error } = result
        const errors = (data as any)?.[queryName]?.errors
        const errorsMessage = error?.message || joinErrorsMessages(errors)

        return { ...result, loading, errorsMessage }
      } catch (err: any) {
        setLoading(false)
        return Promise.resolve({
          networkStatus: "ERROR",
          data: undefined,
          error: err,
          loading,
          errorsMessage: err?.message || "Something went wrong",
        })
      }
    },
    [client, queryName],
  )

  return [
    sendQuery as unknown as (
      variables?: TVars,
    ) => Promise<QueryResult<TData> & QueryHelpers>,
    { loading },
  ]
}

const userDefaultWalletIdDelayedQuery = (
  config?: QueryOptions<
    GaloyGQL.UserDefaultWalletIdQuery,
    GaloyGQL.UserDefaultWalletIdQueryVariables
  >,
) => {
  return useDelayedQueryWrapper<
    GaloyGQL.UserDefaultWalletIdQuery,
    GaloyGQL.UserDefaultWalletIdQueryVariables
  >("userDefaultWalletId", config)
}

const accountDefaultWalletDelayedQuery = (
  config?: QueryOptions<
    GaloyGQL.AccountDefaultWalletQuery,
    GaloyGQL.AccountDefaultWalletQueryVariables
  >,
) => {
  return useDelayedQueryWrapper<
    GaloyGQL.AccountDefaultWalletQuery,
    GaloyGQL.AccountDefaultWalletQueryVariables
  >("accountDefaultWallet", config)
}

const contactsDelayedQuery = (
  config?: QueryOptions<GaloyGQL.ContactsQuery, GaloyGQL.ContactsQueryVariables>,
) => {
  return useDelayedQueryWrapper<GaloyGQL.ContactsQuery, GaloyGQL.ContactsQueryVariables>(
    "contacts",
    config,
  )
}

const transactionListDelayedQuery = (
  config?: QueryOptions<
    GaloyGQL.TransactionListQuery,
    GaloyGQL.TransactionListQueryVariables
  >,
) => {
  return useDelayedQueryWrapper<
    GaloyGQL.TransactionListQuery,
    GaloyGQL.TransactionListQueryVariables
  >("transactionList", config)
}

const transactionListForContactDelayedQuery = (
  config?: QueryOptions<
    GaloyGQL.TransactionListForContactQuery,
    GaloyGQL.TransactionListForContactQueryVariables
  >,
) => {
  return useDelayedQueryWrapper<
    GaloyGQL.TransactionListForContactQuery,
    GaloyGQL.TransactionListForContactQueryVariables
  >("transactionListForContact", config)
}

const onChainTxFeeDelayedQuery = (
  config?: QueryOptions<GaloyGQL.OnChainTxFeeQuery, GaloyGQL.OnChainTxFeeQueryVariables>,
) => {
  return useDelayedQueryWrapper<
    GaloyGQL.OnChainTxFeeQuery,
    GaloyGQL.OnChainTxFeeQueryVariables
  >("onChainTxFee", config)
}

export const useDelayedQuery = {
  accountDefaultWallet: accountDefaultWalletDelayedQuery,
  onChainTxFee: onChainTxFeeDelayedQuery,
  transactionList: transactionListDelayedQuery,
  transactionListForContact: transactionListForContactDelayedQuery,
  userDefaultWalletId: userDefaultWalletIdDelayedQuery,
  contacts: contactsDelayedQuery,
}
