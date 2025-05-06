import React, { useEffect, useState } from 'react'
import moment from 'moment'

import { AnchorLink, Chip } from '../../components'

import { calculateFullValue } from '../../utils/calculateValue'

import { OriginalTxData, Transaction, TransactionSearchType, TransactionType } from '../../../types'
import { Table } from '../../components/TableComp'
import { IColumnProps } from '../../components/TableComp/Table'
import { NetworkAccountId } from '../../../config'
import { toEthereumAddress } from '../../utils/transformAddress'

interface ITransactionTable {
  data: (Transaction | OriginalTxData)[]
  loading?: boolean
  txType?: TransactionSearchType
}

const tempHeader: IColumnProps<Transaction | OriginalTxData>[] = [
  {
    key: 'txId',
    value: 'Txn ID',
    render: (val: string) => (
      <AnchorLink href={`/transaction/${val}`} label={val as string} size="small" ellipsis width={150} />
    ),
  },
  {
    key: 'transactionType',
    value: 'Txn Type',
    render: (val: string, item: Transaction | OriginalTxData) => (
      <Chip
        title={val}
        color={'data' in item ? (item?.data?.success ? 'success' : 'error') : 'info'}
        size="medium"
      />
    ),
  },
  {
    key: 'cycleNumber',
    value: 'Cycle',
  },
  {
    key: 'timestamp',
    value: 'Timestamp',
    render: (val: string | TransactionType) => moment(val as string).fromNow(),
  },
  {
    key: 'txFrom',
    value: 'From',
    render: (val: string) => (
      <AnchorLink
        href={`/account/${val || NetworkAccountId}`}
        label={(val as string) ? toEthereumAddress(val) : NetworkAccountId}
        size="small"
        ellipsis
        width={150}
      />
    ),
  },
  {
    key: 'txTo',
    value: 'To',
    render: (val: string) => (
      <AnchorLink
        href={`/account/${val || NetworkAccountId}`}
        label={(val as string) ? toEthereumAddress(val) : NetworkAccountId}
        size="small"
        ellipsis
        width={150}
      />
    ),
  },
]

export const TransactionTable: React.FC<ITransactionTable> = (props) => {
  const { data, txType = TransactionType.transfer } = props

  const [header, setHeader] = useState<IColumnProps<Transaction | OriginalTxData>[]>([])

  useEffect(() => {
    let tHeader: IColumnProps<Transaction | OriginalTxData>[] = []

    if (
      txType === TransactionType.transfer ||
      txType === TransactionType.message ||
      txType === TransactionType.deposit_stake ||
      txType === TransactionType.withdraw_stake
    ) {
      tHeader = []
      if (txType === TransactionType.transfer) {
        tHeader.push({
          key: 'originalTxData.tx.amount',
          value: 'Value',
          render: (val: string | TransactionType) => calculateFullValue(`${val}` as string),
        })
      }
      if (txType === TransactionType.message) {
        tHeader.push({
          key: 'originalTxData.tx.amount',
          value: 'Toll',
          render: (val: string | TransactionType) => calculateFullValue(`${val}` as string),
        })
      }
      if (txType === TransactionType.deposit_stake) {
        tHeader.push({
          key: 'originalTxData.tx.stake',
          value: 'Stake Amount',
          render: (val: string | TransactionType) => calculateFullValue(`${val}` as string),
        })
      }
    }

    // if (txType === TransactionSearchParams.pending) {
    //   tHeader = [
    //     {
    //       key: 'originalTxData.txFrom',
    //       value: 'From',
    //       render: (val: string) => (
    //         <AnchorLink href={`/account/${val}`} label={val as string} size="small" ellipsis width={150} />
    //       ),
    //     },
    //     {
    //       key: 'originalTxData.txTo',
    //       value: 'To',
    //       render: (val: string) => (
    //         <AnchorLink href={`/account/${val}`} label={val as string} size="small" ellipsis width={150} />
    //       ),
    //     },
    //   ]
    // }
    tHeader.push({
      key: 'data.transactionFee',
      value: 'Txn Fee',
      render: (val: string | TransactionType) => calculateFullValue(`${val}` as string),
    })

    setHeader([...tempHeader, ...tHeader])
  }, [txType])

  if (!header) return null

  return <Table data={data} columns={header} />
}
