import { scenario as simpleQuery } from './simple-query';
import { scenario as searchEmbeddings } from './search-embeddings';
import { scenario as createNode } from './create-node';
import { scenario as hardModeQuery } from './hard-mode-query';
import { scenario as workflowIntegrate } from './workflow-integrate';
import { scenario as updateNode } from './update-node';
import { scenario as createEdge } from './create-edge';
import { scenario as queryDimensions } from './query-dimensions';
import { scenario as getDimension } from './get-dimension';
import { scenario as dimensionLifecycle } from './dimension-lifecycle';
import { scenario as youtubeExtract } from './youtube-extract';
import { scenario as websiteExtract } from './website-extract';
import { scenario as paperExtract } from './paper-extract';

export const scenarios = [
  simpleQuery,
  searchEmbeddings,
  createNode,
  updateNode,
  createEdge,
  queryDimensions,
  getDimension,
  dimensionLifecycle,
  hardModeQuery,
  workflowIntegrate,
  youtubeExtract,
  websiteExtract,
  paperExtract,
];
