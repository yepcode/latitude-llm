// NOTE:: About CSS for DataGrid component
//
// Whenever you use `@latitude-data/web-ui/data-grid`,
// you must also import the CSS file from the library we use.
// I would rather prefer collocated CSS, but sometimes life is not perfect.
//
// If we found ourselves using data grid a lot maybe move this import
// to root layout. But I think it's a shame to always load this CSS.
import 'react-data-grid/lib/styles.css'

import { getCurrentUser } from '$/services/auth/getCurrentUser'
import {
  DatasetRowsRepository,
  DatasetsRepository,
  DatasetsV2Repository,
} from '@latitude-data/core/repositories'
import { notFound } from 'next/navigation'
import { getFeatureFlagsForWorkspaceCached } from '$/components/Providers/FeatureFlags/getFeatureFlagsForWorkspace'
import { DatasetDetailTable } from './DatasetDetailTable'
import Layout from '../_components/Layout'
import {
  Dataset,
  DatasetV2,
  DatasetRow,
  Workspace,
} from '@latitude-data/core/browser'
import { Result, TypedResult } from '@latitude-data/core/lib/Result'
import { DatasetV1DetailTable } from '$/app/(private)/datasets/_v1DeprecatedComponents/DatasetDetailTable'

type GetDataResult =
  | { isV2: false; dataset: Dataset }
  | { isV2: true; dataset: DatasetV2; rows: DatasetRow[]; count: number }

const ROWS_PAGE_SIZE = '100'
async function getData({
  workspace,
  datasetId,
  page,
  pageSize,
}: {
  workspace: Workspace
  datasetId: string
  page: string | undefined
  pageSize: string | undefined
}): Promise<TypedResult<GetDataResult, Error>> {
  const flags = getFeatureFlagsForWorkspaceCached({ workspace })
  const isV1 = !flags.datasetsV2.enabled

  if (isV1) {
    const scope = new DatasetsRepository(workspace.id)
    const result = await scope.find(datasetId)
    if (result.error) return Result.error(result.error)

    return Result.ok({ dataset: result.value, isV2: false })
  }

  const scope = new DatasetsV2Repository(workspace.id)
  const result = await scope.find(Number(datasetId))

  if (result.error) return Result.error(result.error)

  const dataset = result.value
  const rowsRepo = new DatasetRowsRepository(workspace.id)
  const size = pageSize ?? ROWS_PAGE_SIZE
  const resultCount = await rowsRepo.getCountByDataset(dataset.id)
  const count = !resultCount[0] ? 0 : resultCount[0].count
  const rows = await rowsRepo.findByDatasetPaginated({
    datasetId: dataset.id,
    page,
    pageSize: size,
  })

  return Result.ok({ dataset, rows, count, isV2: true })
}

export default async function DatasetDetail({
  params,
  searchParams,
}: {
  params: Promise<{ datasetId: string }>
  searchParams: Promise<{
    isProcessing?: string
    pageSize: string
    page?: string
  }>
}) {
  const {
    pageSize,
    page: pageString,
    isProcessing: isProcessingString,
  } = await searchParams
  const isProcessing = isProcessingString === 'true'
  const { datasetId } = await params
  const { workspace } = await getCurrentUser()
  const result = await getData({
    workspace,
    datasetId,
    page: pageString,
    pageSize,
  })

  if (result.error) return notFound()

  const isV1 = !result.value.isV2

  if (isV1) {
    return <DatasetV1DetailTable dataset={result.value.dataset} />
  }
  return (
    <Layout size='full'>
      <DatasetDetailTable
        dataset={result.value.dataset}
        rows={result.value.rows}
        count={result.value.count}
        initialRenderIsProcessing={isProcessing}
      />
    </Layout>
  )
}
