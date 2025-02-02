import React, { useEffect, useState } from 'react'
import moment from 'moment'

import { AnchorLink } from '../../components'

import { calculateFullValue } from '../../utils/calculateValue'

import {
  OriginalTxData,
  Transaction,
  TransactionSearchParams,
  TransactionSearchType,
  TransactionType,
} from '../../../types'
import { Table } from '../../components/TableComp'
import { IColumnProps } from '../../components/TableComp/Table'

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
      <AnchorLink
        href={`/transaction/${val}`}
        label={val as string}
        size="small"
        ellipsis
        width={150}
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
      tHeader = [
        {
          key: 'txFrom',
          value: 'From',
          render: (val: string | TransactionType) => (
            <AnchorLink href={`/account/${val}`} label={val as string} size="small" ellipsis width={150} />
          ),
        },
        {
          key: 'txTo',
          value: 'To',
          render: (val: string) => (
            <AnchorLink href={`/account/${val}`} label={val} size="small" ellipsis width={150} />
          ),
        },
      ]
      if (txType === TransactionType.transfer) {
        tHeader.push({
          key: 'originalTxData.tx.amount',
          value: 'Value',
          render: (val: string | TransactionType) => calculateFullValue(`${val}` as string),
        },
        {
          key: 'originalTxData.tx.fee',
          value: 'Txn Fee',
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

    

    if (txType === TransactionSearchParams.pending) {
      tHeader = [
        {
          key: 'originalTxData.readableReceipt.from',
          value: 'From',
          render: (val: string) => (
            <AnchorLink href={`/account/${val}`} label={val as string} size="small" ellipsis width={150} />
          ),
        },
        {
          key: 'originalTxData.readableReceipt.to',
          value: 'To',
          render: (val: string) =>
            val ? (
              <AnchorLink href={`/account/${val}`} label={val} size="small" ellipsis width={150} />
            ) : (
              'Contract Creation'
            ),
        },
        {
          key: 'originalTxData.readableReceipt.value',
          value: 'Value',
          render: (val: string) => calculateValue(`${val}` as string),
        },
      ]
    }

    setHeader([...tempHeader, ...tHeader])
  }, [txType])

  if (!header) return null

  return <Table data={data} columns={header} />
}
