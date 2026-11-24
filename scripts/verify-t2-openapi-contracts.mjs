import { readFile } from 'node:fs/promises'

const baseUrl = process.env.CODE_STRIKE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const repoRoot = new URL('../', import.meta.url)
const capturedPath = new URL(
  'docs/evidence/assignment5-alpha/sprint-new/openapi.json',
  repoRoot,
)
const dtoSourcePaths = [
  new URL('packages/api-contracts/src/api/dto.ts', repoRoot),
  new URL('packages/api-contracts/src/api/community.ts', repoRoot),
  new URL('packages/api-contracts/src/api/notifications.ts', repoRoot),
  new URL('packages/api-contracts/src/types.ts', repoRoot),
]

/** Shared DTO name -> served OpenAPI schema name. */
const MAPPING = {
  HealthResponse: 'HealthResponse',
  CompetitionDetailDto: 'CompetitionDetail',
  TeamDto: 'TeamOut',
  SkillDto: 'SkillOut',
  ApplicationDto: 'ApplicationOut',
  ApplicantPreviewDto: 'ApplicantPreview',
  ReviewDto: 'ReviewOut',
  MemberDto: 'MemberOut',
  ContactDto: 'ContactOut',
  UserDto: 'UserOut',
  TokenDto: 'TokenOut',
  PlannerItemDto: 'ItemOut',
  PlannerItemPageDto: 'ItemPage',
  PlannerCreateResultDto: 'CreateResult',
  PlannerSkippedOccurrenceDto: 'SkippedOccurrence',
  NotificationReadRequest: 'ReadState',
  CommunityPostDto: 'PostOut',
  CommunityCommentDto: 'CommentOut',
  PostInteractionsDto: 'InteractionState',
}

/** Reads the property names of every exported interface in the shared contract sources. */
async function readDtoContracts() {
  const contracts = new Map()
  const interfacePattern = /export interface (\w+)(?:\s+extends\s+(\w+))?\s*\{([\s\S]*?)\n\}/g
  for (const sourcePath of dtoSourcePaths) {
    const source = await readFile(sourcePath, 'utf8')
    let match
    while ((match = interfacePattern.exec(source)) !== null) {
      const [, name, parent, body] = match
      const properties = [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((entry) => entry[1])
      contracts.set(name, { properties, parent })
    }
  }
  for (const contract of contracts.values()) {
    const inherited = contract.parent ? contracts.get(contract.parent) : undefined
    contract.properties = [...(inherited?.properties ?? []), ...contract.properties]
  }
  return contracts
}

function countOperations(paths) {
  let total = 0
  for (const operations of Object.values(paths)) {
    for (const method of Object.keys(operations)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) total += 1
    }
  }
  return total
}

const served = await (await fetch(`${baseUrl}/openapi.json`)).json()
const captured = JSON.parse(await readFile(capturedPath, 'utf8'))
const schemas = served.components.schemas
const contracts = await readDtoContracts()

const failures = []
const lines = []

lines.push(`openapi version : ${served.openapi}`)
lines.push(`paths / ops     : ${Object.keys(served.paths).length} / ${countOperations(served.paths)}`)
lines.push(`schemas         : ${Object.keys(schemas).length}`)
lines.push('--- shared DTO against the served schema ---')

for (const [dtoName, schemaName] of Object.entries(MAPPING)) {
  const schema = schemas[schemaName]
  if (!schema) {
    failures.push(`served schema ${schemaName} is missing`)
    continue
  }
  const contract = contracts.get(dtoName)
  if (!contract) {
    failures.push(`shared DTO ${dtoName} is missing from the contract sources`)
    continue
  }
  const properties = schema.properties ?? {}
  const required = schema.required ?? []
  const problems = []

  for (const property of required) {
    if (!contract.properties.includes(property)) {
      problems.push(`required property ${property} is not carried by ${dtoName}`)
    }
  }
  for (const property of Object.keys(properties)) {
    if (!contract.properties.includes(property)) {
      problems.push(`served property ${property} is not carried by ${dtoName}`)
    }
  }

  lines.push(`${problems.length === 0 ? 'PASS' : 'FAIL'}: ${dtoName} <-> ${schemaName} (${contract.properties.length} properties)`)
  for (const problem of problems) {
    lines.push(`      ${problem}`)
    failures.push(`${dtoName} <-> ${schemaName}: ${problem}`)
  }
}

lines.push('--- captured document against the served document ---')
const capturedPaths = Object.keys(captured.paths).length
const capturedSchemas = Object.keys(captured.components.schemas).length
const servedPaths = Object.keys(served.paths).length
const servedSchemas = Object.keys(schemas).length
// Preserve the original sprint capture. Check names and methods, including the
// new personal interaction endpoint, so a missing route cannot be masked by an addition.
const expectedPaths = { ...captured.paths, '/api/v1/posts/{post_id}/interactions': { get: {} } }
for (const [path, operations] of Object.entries(expectedPaths)) {
  for (const method of Object.keys(operations)) {
    if (!served.paths[path]?.[method]) failures.push(`missing ${method.toUpperCase()} ${path}`)
  }
}
if (Object.keys(expectedPaths).length !== servedPaths) failures.push('unexpected path count')
const expectedSchemas = [...Object.keys(captured.components.schemas), 'InteractionState']
for (const name of expectedSchemas) if (!schemas[name]) failures.push(`missing schema ${name}`)
if (expectedSchemas.length !== servedSchemas) failures.push('unexpected schema count')
lines.push(`captured paths/schemas : ${capturedPaths}/${capturedSchemas}`)
lines.push(`served   paths/schemas : ${servedPaths}/${servedSchemas}`)

console.log(lines.join('\n'))
console.log(`RESULT: ${failures.length === 0 ? 'PASS' : 'FAIL'} (${failures.length} failures)`)
for (const failure of failures) console.log(`  - ${failure}`)
process.exit(failures.length === 0 ? 0 : 1)
