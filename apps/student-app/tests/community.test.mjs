import assert from 'node:assert/strict'
import test from 'node:test'

const published = { id: 'post', revisionId: 'old', competitionId: 'contest', username: 'alice', status: 'Approved', likes: 13, favorites: 2 }
const pending = { ...published, revisionId: 'new', status: 'Pending' }
const apiModule = new URL('../src/api/community.ts', import.meta.url)

test('edit and delete controls require the signed-in student who owns the revision', async () => {
  const { ownsContent } = await import(apiModule)
  assert.equal(ownsContent(null, published), false)
  assert.equal(ownsContent({ role: 'Student', username: 'bob' }, published), false)
  assert.equal(ownsContent({ role: 'Student', username: 'alice' }, published), true)
  assert.equal(ownsContent({ role: 'Admin', username: 'alice' }, pending), false)
})

test('editing a post preserves existing image bytes and rejects a blank or invalid link-only revision', async () => {
  const { postPayload } = await import(apiModule)
  assert.deepEqual(postPayload(' body ', 'https://example.edu\n', ['data:image/png;base64,abcd']), {
    text:'body', links:['https://example.edu'], images:[{dataBase64:'abcd'}],
  })
  assert.throws(() => postPayload('', ' ', []), /text|link|image/i)
  assert.throws(() => postPayload('', 'javascript:alert(1)', []), /https?/i)
})

async function client(routes) {
  const { createCommunityApi } = await import(apiModule)
  return createCommunityApi({
    async request(request) {
      const key = [request.method ?? 'GET', request.path].join(' ')
      assert.ok(Object.hasOwn(routes, key), 'unexpected request ' + key)
      return typeof routes[key] === 'function' ? routes[key](request) : routes[key]
    },
  })
}

test('competition feed keeps public and private revisions distinct after reload, including later pages', async () => {
  const api = await client({
    'GET /competitions/contest/posts': [published],
    'GET /me/posts': ({ auth, query }) => {
      assert.equal(auth, 'required')
      return query.offset === 0 ? Array.from({length: query.limit}, (_, i) => ({ ...pending, id: String(i), competitionId: 'elsewhere' })) : [pending]
    },
  })
  assert.deepEqual(await api.feed('contest', true), { published: [published], personal: [pending] })
  assert.deepEqual(await api.feed('contest', false), { published: [published], personal: [] })
})

test('private pending detail comes from the latest server revision and has no public thread yet', async () => {
  const api = await client({ 'GET /me/posts': [pending] })
  const detail = await api.thread('post', true, true)
  assert.deepEqual(detail, {post: pending, comments: [], interactions: null})
})

test('fresh public detail restores exactly this viewer’s toggles and guests skip private reads', async () => {
  const states = { liked: false, favorited: true }
  const routes = {
    'GET /posts/post': published,
    'GET /posts/post/comments': [{ id: 'reply', parentId: 'comment' }],
    'GET /posts/post/interactions': ({auth}) => { assert.equal(auth, 'required'); return {...states} },
    'PUT /posts/post/interactions/Like': () => {states.liked = true; return {kind: 'Like', active: true}},
    'DELETE /posts/post/interactions/Favorite': () => {states.favorited = false; return {kind: 'Favorite', active: false}},
  }
  const api = await client(routes)
  assert.deepEqual((await api.thread('post', false, true)).interactions, states)
  await api.interact('post', 'Like', true)
  await api.interact('post', 'Favorite', false)
  const fresh = await client(routes)
  assert.deepEqual((await fresh.thread('post', false, true)).interactions, {liked: true, favorited: false})
  delete routes['GET /posts/post/interactions']
  assert.equal((await fresh.thread('post', false, false)).interactions, null)
})

test('post, reply and comment mutations send authenticated backend payloads and propagate denials', async () => {
  const body = { text: 'hello', links: [], images: [{ dataBase64: 'AA==' }] }
  function check(expected, response) {
    return ({auth, body}) => { assert.equal(auth, 'required'); assert.deepEqual(body, expected); return response }
  }
  const api = await client({
    'POST /competitions/contest/posts': check(body, pending),
    'PATCH /posts/post': check(body, pending),
    'DELETE /posts/post': check(undefined),
    'POST /posts/post/comments': check({text:'a reply', parentId:'parent'}, {id:'child'}),
    'PATCH /comments/child': check({text:'updated'}, {id:'child'}),
    'DELETE /comments/child': () => {throw new Error('Only the author may delete content.')},
  })
  assert.deepEqual(await api.createPost('contest', body), pending)
  await api.editPost('post', body)
  await api.deletePost('post')
  assert.equal((await api.comment('post', 'a reply', 'parent')).id, 'child')
  await api.editComment('child', 'updated')
  await assert.rejects(api.deleteComment('child'), /Only the author/)
})

test('server image bytes become a preview and edit payload, invalid media fails before rendering', async () => {
  const jpeg = Uint8Array.of(255,216,255,224).buffer
  const api = await client({
    'GET /images/im': ({headers}) => { assert.match(headers.Accept, /image/); return jpeg },
    'GET /images/bad': new ArrayBuffer(3),
  })
  const image = await api.image('im')
  assert.equal(image, 'data:image/jpeg;base64,/9j/4A==')
  await assert.rejects(api.image('bad'), /image|JPEG|PNG/i)
})

test('submissions read the signed-in list, revise the original id and withdraw from server', async () => {
  const content = {title:'Robotics', maxTeamSize:3}
  const row = {id:'proposal', content, status:'Pending', competitionId:null, deleted:false}
  const calls = []
  const save = ({body,auth}) => {assert.equal(auth,'required'); assert.deepEqual(body,content); calls.push(body); return row}
  const api = await client({
    'POST /competition-submissions': save, 'PATCH /competition-submissions/proposal': save,
    'GET /competition-submissions/me': [row],
    'DELETE /competition-submissions/proposal': ({auth}) => {assert.equal(auth,'required')},
  })
  await api.saveSubmission(content)
  await api.saveSubmission(content,'proposal')
  assert.equal(calls.length,2)
  assert.deepEqual(await api.submissions(),[row])
  await api.withdrawSubmission('proposal')
})
